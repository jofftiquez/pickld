-- 0041 — Moderator decisions, appeals, strikes and suspension (M3-23; FR-MOD-04, FR-MOD-05, FR-SAF-05,
-- FR-SAF-06; D-10, D-11, D-22). Additive: one column on profiles, one on moderation_items, a check on
-- appeals.status and new functions. No column is dropped or renamed.
--
-- Every decision goes through mod_decide(), owned by pickld_moderation (the only role that may set a
-- moment live or removed, 0011) and callable by signed-in moderators: it checks is_moderator(), takes the
-- actor from auth.uid() (never from the request), applies the decision and writes the audit row in the
-- same transaction. Moderators therefore lose their direct write rights on moderation_items and appeals
-- (0001's mod_items_mod / appeals_mod_update), so no decision can skip the audit log. fn:mod-action is a
-- thin wrapper (input validation, { data } | { error }) that calls it with the moderator's own JWT.
--
-- Decisions on an open item (pending or escalated):
--   keep         auto_check: the moment goes live (a proposal is swapped in, a replacement replaces), a
--                comment becomes visible. report: the item is kept (0021's trigger unhides the moment).
--                appeal: overturned — the content is restored (a moment goes live again if its slot is
--                free) and its strike is cleared.
--   remove       a moment is removed (a proposal on a live moment flagged by auto_check is dropped
--   remove_warn  instead); a comment is hidden. appeal: upheld, nothing changes. remove_warn is recorded
--                as such (audit data warned: true); the owner gets the same 'removed' notification.
--                Jar and profile reports can only be kept or escalated (removing a whole jar or a profile
--                is not a defined action yet).
--   escalate     pending → escalated; it stays in the queue under Escalated for the founders.
-- An appeal is decided by a different moderator than the one who removed the content (FR-SAF-05), and
-- nobody decides about their own content.
--
-- Strikes (D-10): a trigger on moderation_items counts removals still standing — auto_check and report
-- items with status removed, decided in the last 90 days, without an overturned appeal — whenever one is
-- recorded, by fn:moderate or a moderator. The third suspends the owner for 7 days (D-11):
-- profiles.status = 'suspended' and profiles.suspended_until. moderation_lift_suspensions(), run by the
-- fn:account-jobs cron, makes them active again. A child-safety suspension (0040) has no end date and is
-- never lifted automatically. An overturned appeal that brings an owner under three strikes lifts their
-- suspension at once.

-- ---------------------------------------------------------------- columns
alter table public.profiles add column suspended_until timestamptz;
comment on column public.profiles.suspended_until is
  'End of a strike suspension (D-10, D-11; 0041). Null while active, and for a child-safety suspension (no end).';
-- Not in the authenticated column grant: only the owner reads it, through my_profile().

create or replace function public.profiles_guard_suspension() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.suspended_until := null;
  elsif new.suspended_until is distinct from old.suspended_until then
    raise exception 'suspended_until is set by the server' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_suspension before insert or update on public.profiles
  for each row execute function public.profiles_guard_suspension();

alter table public.moderation_items
  add column appeal_id uuid references public.appeals(id) on delete cascade;
comment on column public.moderation_items.appeal_id is
  'For source appeal: the appeal this queue entry decides (0041). Its moment or comment is the removed content.';
create unique index moderation_items_appeal_key on public.moderation_items (appeal_id) where appeal_id is not null;

alter table public.appeals add constraint appeals_status_check
  check (status in ('open', 'overturned', 'upheld'));

-- ---------------------------------------------------------------- moderators read, functions write
-- The read policies are scoped to authenticated: as {public} they also applied to pickld_moderation, which
-- can't evaluate auth.jwt() inside mod_decide().
drop policy mod_items_mod on public.moderation_items;
create policy mod_items_mod_select on public.moderation_items for select to authenticated
  using (public.is_moderator());
drop policy appeals_mod_update on public.appeals;
drop policy appeals_owner_select on public.appeals;
create policy appeals_owner_select on public.appeals for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
drop policy appeals_owner_insert on public.appeals;
create policy appeals_owner_insert on public.appeals for insert to authenticated with check (user_id = auth.uid());
drop policy audit_mod_select on public.audit_log;
create policy audit_mod_select on public.audit_log for select to authenticated using (public.is_moderator());
revoke insert, update, delete on public.moderation_items from authenticated, anon;
revoke update, delete on public.appeals from authenticated, anon;
revoke insert, update, delete on public.audit_log from authenticated, anon;

grant update on public.moderation_items to pickld_moderation;
create policy mod_items_moderation_update on public.moderation_items for update to pickld_moderation
  using (true) with check (true);
grant select, update (status) on public.appeals to pickld_moderation;
create policy appeals_moderation_select on public.appeals for select to pickld_moderation using (true);
create policy appeals_moderation_update on public.appeals for update to pickld_moderation
  using (true) with check (true);
grant insert on public.audit_log to pickld_moderation;
create policy audit_moderation_insert on public.audit_log for insert to pickld_moderation with check (true);
grant update (suspended_until) on public.profiles to pickld_moderation;
grant execute on function public.notify(uuid, text, uuid, uuid, uuid, uuid) to pickld_moderation;
grant select on public.jars to pickld_moderation;
create policy jars_moderation_select on public.jars for select to pickld_moderation using (true);

-- ---------------------------------------------------------------- appeals join the queue
-- One appeal per removal (appeals.moderation_item_id is unique); appeal items themselves can't be appealed.
create or replace function public.can_appeal(item uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from moderation_items mi
    left join moments m on m.id = mi.moment_id
    left join comments c on c.id = mi.comment_id
    where mi.id = item and mi.status = 'removed' and mi.source in ('auto_check', 'report')
      and (m.user_id = uid or c.user_id = uid)
  )
$$;

create or replace function public.appeals_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into moderation_items (moment_id, comment_id, source, status, appeal_id)
  select mi.moment_id, mi.comment_id, 'appeal', 'pending', new.id
  from moderation_items mi where mi.id = new.moderation_item_id;
  return null;
end $$;
create trigger appeals_ai after insert on public.appeals
  for each row when (new.status = 'open') execute function public.appeals_after_insert();

-- ---------------------------------------------------------------- strikes
create or replace function public.strike_count(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct coalesce(mi.moment_id, mi.comment_id))::int
  from moderation_items mi
  left join moments m on m.id = mi.moment_id
  left join comments c on c.id = mi.comment_id
  where mi.source in ('auto_check', 'report') and mi.status = 'removed'
    and mi.decided_at > now() - interval '90 days'
    and coalesce(m.user_id, c.user_id) = p_user
    and not exists (select 1 from appeals a where a.moderation_item_id = mi.id and a.status = 'overturned')
$$;
revoke execute on function public.strike_count(uuid) from public, anon, authenticated;
grant execute on function public.strike_count(uuid) to service_role, pickld_moderation;

create or replace function public.moderation_items_strike() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  strikes int;
  until timestamptz := now() + interval '7 days';
begin
  if new.status <> 'removed' or new.source not in ('auto_check', 'report')
     or (tg_op = 'UPDATE' and old.status = 'removed') then
    return null;
  end if;
  select coalesce(m.user_id, c.user_id) into owner
  from (select 1) x
  left join moments m on m.id = new.moment_id
  left join comments c on c.id = new.comment_id;
  if owner is null then return null; end if;
  strikes := strike_count(owner);
  if strikes >= 3 then
    update profiles set status = 'suspended', suspended_until = until where id = owner and status = 'active';
    if found then
      insert into audit_log (actor_id, action, target, target_id, data)
      values (null, 'suspend', 'profile', owner,
              jsonb_build_object('strikes', strikes, 'until', until, 'item_id', new.id));
    end if;
  end if;
  return null;
end $$;
create trigger moderation_items_strike after insert or update of status on public.moderation_items
  for each row execute function public.moderation_items_strike();

-- ---------------------------------------------------------------- lifting suspensions
-- fn:account-jobs runs this on every cron run. Returns how many accounts became active again.
create or replace function public.moderation_lift_suspensions() returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  with lifted as (
    update profiles set status = 'active', suspended_until = null
    where status = 'suspended' and suspended_until is not null and suspended_until <= now()
    returning id
  )
  insert into audit_log (actor_id, action, target, target_id, data)
  select null, 'lift_suspension', 'profile', id, '{"reason": "expired"}'::jsonb from lifted;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------- mod_decide
-- Returns { result, item_id, status } where result is one of:
--   kept | removed | escalated | overturned | upheld   applied (overturned may add "restored": false when
--                                                      the slot was refilled meanwhile)
--   not_found | already_decided | unsupported | same_moderator | own_content   nothing changed
create or replace function public.mod_decide(
  p_item uuid,
  p_action text,
  p_guideline text default null,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- The caller's claims, read like auth.uid() and is_moderator() do (pickld_moderation has no rights on
  -- the auth schema).
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
  mi moderation_items;
  orig moderation_items;
  ap appeals;
  m moments;
  c comments;
  owner uuid;
  target target_type;
  target_id uuid;
  result text;
  restored boolean;
  extra jsonb := '{}'::jsonb;
begin
  if actor is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('keep', 'remove', 'remove_warn', 'escalate') then
    raise exception 'action must be keep, remove, remove_warn or escalate' using errcode = '22023';
  end if;
  if p_action in ('remove', 'remove_warn') then
    if p_guideline is null or p_guideline not in
       (select e::text from unnest(enum_range(null::report_reason)) e) then
      raise exception 'a removal needs a guideline (a report reason)' using errcode = '22023';
    end if;
  end if;
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'note is at most 500 characters' using errcode = '22023';
  end if;

  select * into mi from moderation_items where id = p_item for update;
  if mi.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;
  if mi.status not in ('pending', 'escalated') or (p_action = 'escalate' and mi.status <> 'pending') then
    return jsonb_build_object('result', 'already_decided', 'item_id', mi.id, 'status', mi.status);
  end if;

  if mi.moment_id is not null then
    select * into m from moments where id = mi.moment_id for update;
    owner := m.user_id; target := 'moment'; target_id := m.id;
  elsif mi.comment_id is not null then
    select * into c from comments where id = mi.comment_id for update;
    owner := c.user_id; target := 'comment'; target_id := c.id;
  elsif mi.jar_id is not null then
    select user_id into owner from jars where id = mi.jar_id;
    target := 'jar'; target_id := mi.jar_id;
  else
    owner := mi.profile_id; target := 'profile'; target_id := mi.profile_id;
  end if;
  if owner = actor then
    return jsonb_build_object('result', 'own_content', 'item_id', mi.id);
  end if;

  if mi.source = 'appeal' then
    select * into ap from appeals where id = mi.appeal_id for update;
    select * into orig from moderation_items where id = ap.moderation_item_id;
    if orig.decided_by = actor then
      return jsonb_build_object('result', 'same_moderator', 'item_id', mi.id);
    end if;
  end if;

  if p_action = 'escalate' then
    update moderation_items set status = 'escalated' where id = mi.id;
    result := 'escalated';

  elsif p_action = 'keep' then
    if mi.source = 'auto_check' and m.id is not null then
      if m.replaces is not null then
        delete from moments where id = m.replaces and status <> 'removed';
      end if;
      if m.status in ('uploading', 'checking') and m.pending_since is null then
        update moments set status = 'live', replaces = null where id = m.id;
      elsif m.pending_since is not null then
        update moments set
          status = 'live', replaces = null,
          photo_path = m.pending_photo_path, thumb_path = m.pending_thumb_path,
          caption = m.pending_caption, edits = coalesce(m.pending_edits, '{}'::jsonb),
          pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
          pending_edits = null, pending_since = null
        where id = m.id;
      end if;
    elsif mi.source = 'auto_check' and c.id is not null and c.deleted_at is null then
      update comments set is_hidden = false where id = c.id;
    elsif mi.source = 'appeal' then
      update appeals set status = 'overturned' where id = ap.id;
      restored := true;
      if m.id is not null and m.status = 'removed' then
        if m.replaces is null and exists (
             select 1 from moments o where o.jar_id = m.jar_id and o.slot = m.slot and o.id <> m.id
               and o.status <> 'removed' and o.replaces is null) then
          restored := false; -- the slot was filled again meanwhile: the strike still goes
        else
          if m.replaces is not null then
            delete from moments where id = m.replaces and status <> 'removed';
          end if;
          update moments set status = 'live', replaces = null where id = m.id;
        end if;
      elsif c.id is not null and c.deleted_at is null then
        update comments set is_hidden = false where id = c.id;
      end if;
      extra := jsonb_build_object('restored', restored);
      -- Below three strikes again: a strike suspension ends now.
      if strike_count(owner) < 3 then
        update profiles set status = 'active', suspended_until = null
        where id = owner and status = 'suspended' and suspended_until is not null;
        if found then
          insert into audit_log (actor_id, action, target, target_id, data)
          values (actor, 'lift_suspension', 'profile', owner,
                  jsonb_build_object('reason', 'appeal_overturned', 'item_id', mi.id));
        end if;
      end if;
    end if;
    update moderation_items set status = 'kept', decided_by = actor, decided_at = now(),
      decision_reason = coalesce(p_guideline, decision_reason)
    where id = mi.id;
    result := case when mi.source = 'appeal' then 'overturned' else 'kept' end;

  else -- remove, remove_warn
    if target in ('jar', 'profile') then
      return jsonb_build_object('result', 'unsupported', 'item_id', mi.id);
    end if;
    if mi.source = 'appeal' then
      update appeals set status = 'upheld' where id = ap.id;
    elsif m.id is not null then
      if mi.source = 'auto_check' and m.status = 'live' and m.pending_since is not null then
        -- A flagged edit of a live moment: the checked version stays, the proposal goes.
        update moments set pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
          pending_edits = null, pending_since = null
        where id = m.id;
      elsif m.status <> 'removed' then
        update moments set status = 'removed', pending_photo_path = null, pending_thumb_path = null,
          pending_caption = null, pending_edits = null, pending_since = null
        where id = m.id; -- moments_removed_notify tells the owner
      end if;
    elsif c.id is not null then
      update comments set is_hidden = true where id = c.id and not is_hidden;
      perform notify(c.user_id, 'removed', null, c.jar_id, null, c.id);
    end if;
    update moderation_items set status = 'removed', decided_by = actor, decided_at = now(),
      decision_reason = p_guideline
    where id = mi.id;
    result := case when mi.source = 'appeal' then 'upheld' else 'removed' end;
  end if;

  insert into audit_log (actor_id, action, target, target_id, data)
  values (actor, p_action, target, target_id,
          jsonb_build_object('item_id', mi.id, 'source', mi.source, 'result', result,
                             'guideline', p_guideline, 'note', p_note,
                             'warned', p_action = 'remove_warn') || extra);

  return jsonb_build_object('result', result, 'item_id', mi.id,
                            'status', (select status from moderation_items where id = mi.id)) || extra;
end $$;

-- ---------------------------------------------------------------- the owner's own removal
-- What the Moment removed screen shows (FR-SAF-05): the guideline broken (a report reason, or null), the
-- item to appeal, whether an appeal is still possible and the appeal's status. Only the owner gets a row.
create or replace function public.my_removal(p_moment uuid)
returns table (item_id uuid, guideline text, can_appeal boolean, appeal_status text)
language sql stable security definer set search_path = public as $$
  select mi.id,
         case when mi.decision_reason in (select e::text from unnest(enum_range(null::report_reason)) e)
                   and mi.decision_reason <> 'other' then mi.decision_reason end,
         a.id is null and public.can_appeal(mi.id, auth.uid()),
         a.status
  from moments m
  join moderation_items mi on mi.moment_id = m.id and mi.source in ('auto_check', 'report') and mi.status = 'removed'
  left join appeals a on a.moderation_item_id = mi.id
  where m.id = p_moment and m.user_id = auth.uid() and m.status = 'removed'
  order by mi.decided_at desc nulls last
  limit 1
$$;
revoke execute on function public.my_removal(uuid) from public, anon;
grant execute on function public.my_removal(uuid) to authenticated;

-- ---------------------------------------------------------------- owners and rights
grant create on schema public to pickld_moderation;
alter function public.moderation_items_strike() owner to pickld_moderation;
alter function public.moderation_lift_suspensions() owner to pickld_moderation;
alter function public.mod_decide(uuid, text, text, text) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;

revoke execute on function public.moderation_items_strike() from public, anon, authenticated;
revoke execute on function public.moderation_lift_suspensions() from public, anon, authenticated;
grant execute on function public.moderation_lift_suspensions() to service_role;
revoke execute on function public.mod_decide(uuid, text, text, text) from public, anon;
grant execute on function public.mod_decide(uuid, text, text, text) to authenticated;
revoke execute on function public.appeals_after_insert() from public, anon, authenticated;
revoke execute on function public.profiles_guard_suspension() from public, anon;
