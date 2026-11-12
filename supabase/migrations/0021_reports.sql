-- 0021 — Reports (M3-20; FR-SAF-01; docs/analysis.md S-11; architecture §Reports).
-- Additive only: new columns, indexes, functions, triggers and policies. No column is dropped or renamed.
--
-- How the app reports (M3-21): call the RPC, not a plain insert.
--   select public.submit_report(target => 'moment', target_id => <uuid>, reason => 'spam', note => null);
-- It returns nothing; success means "Report sent". A repeat tap on the same target is a no-op, never a
-- second report. (A plain insert under RLS is refused the same way, except a repeat raises 23505.)
-- Errors: 42501 when the target doesn't exist or the caller can't see it (the two look the same), or
-- the caller is not active; 22023 when it is the caller's own content or profile.
--
-- The rules, all in Postgres (rule 1):
--   * You can only report what you can see, never your own: a moment you can view (can_view_moment), a
--     jar you can view (can_view_jar), a visible comment in such a jar by someone who isn't blocked
--     either way (the comments_select rule), or an active profile not blocked either way. A block hides
--     both people from each other, so report before you block.
--   * One report per reporter per target (unique). created_at and status are the server's for clients.
--   * Each report links (reports.moderation_item_id) to the open moderation_items row (source report,
--     status pending or escalated) for its target; the first report creates it and is its report_id.
--     At most one open report item exists per target (partial unique indexes), so later reports join
--     the same queue entry. Jars get their own item (moderation_items.jar_id): a jar report is about the
--     jar as a whole (e.g. a day that is harassment as a set), which no single moment item describes, and
--     linking to every moment would put several items in the queue for one complaint. Profile reports
--     use moderation_items.profile_id (the reported profile).
--   * Three reports from three different reporters within 24 hours on the same open item for a moment set
--     moments.hidden_at. A hidden moment is out of can_view_moment (so moment_photo_paths / fn:photo-urls
--     and reactions), out of moments selects for everyone but its owner and moderators (a restrictive
--     policy, which also covers the security invoker feed_page / feed_authors), and out of
--     jars.visible_count. Its owner still sees it. Status is not touched: live and removed still come
--     only from pickld_moderation (0011), and fn:moderate can't approve a hidden moment back into view.
--   * A moderator decides by updating the report item. kept: hidden_at is cleared. removed or escalated:
--     it stays hidden (removing the moment itself is the moderation tool's job, as pickld_moderation).
--     A later report opens a fresh item, so the 24-hour count starts over after a decision.
--   * The reported user never learns who reported them: reports rows are readable only by moderators
--     (not even by the reporter: submit_report's success is the "Report sent" signal, so no read-back is
--     needed), moderation_items has no reporter column and is readable only by moderators, and no
--     notification or function returns either to the content owner.

-- ---------------------------------------------------------------- moderation_items: report targets
alter table public.moderation_items
  add column report_id uuid references public.reports(id) on delete set null,
  add column profile_id uuid references public.profiles(id) on delete cascade,
  add column jar_id uuid references public.jars(id) on delete cascade;
comment on column public.moderation_items.report_id is
  'The report that opened this item (source report). Later reports on the same target link through reports.moderation_item_id (0021).';
comment on column public.moderation_items.profile_id is 'The reported profile, for a profile report (0021).';
comment on column public.moderation_items.jar_id is 'The reported jar, for a jar report (0021).';
alter table public.moderation_items add constraint moderation_items_one_target
  check (num_nonnulls(moment_id, comment_id, jar_id, profile_id) <= 1);
create index moderation_items_report_idx on public.moderation_items (report_id) where report_id is not null;
-- One open report item per target.
create unique index moderation_items_open_report_moment_key on public.moderation_items (moment_id)
  where source = 'report' and status in ('pending', 'escalated') and moment_id is not null;
create unique index moderation_items_open_report_comment_key on public.moderation_items (comment_id)
  where source = 'report' and status in ('pending', 'escalated') and comment_id is not null;
create unique index moderation_items_open_report_jar_key on public.moderation_items (jar_id)
  where source = 'report' and status in ('pending', 'escalated') and jar_id is not null;
create unique index moderation_items_open_report_profile_key on public.moderation_items (profile_id)
  where source = 'report' and status in ('pending', 'escalated') and profile_id is not null;

-- ---------------------------------------------------------------- reports: link and uniqueness
alter table public.reports
  add column moderation_item_id uuid references public.moderation_items(id) on delete set null;
comment on column public.reports.moderation_item_id is
  'The moderation_items row (source report) this report joined. Set by the server (0021).';
create unique index reports_one_per_reporter_key on public.reports (reporter_id, target, target_id);
create index reports_item_idx on public.reports (moderation_item_id, created_at);

-- Clients only insert (through submit_report or directly); nobody but moderators reads.
revoke update, delete on public.reports from authenticated, anon;
revoke all on public.reports from anon;
create policy reports_active_insert on public.reports as restrictive for insert to authenticated
  with check (public.is_active_user());

-- ---------------------------------------------------------------- moments.hidden_at
alter table public.moments add column hidden_at timestamptz;
comment on column public.moments.hidden_at is
  'Set by the server when three people report the moment within 24 hours; hidden from everyone but its owner until a moderator decides (0021).';
-- The owner may read it (an "under review" state); others never get a hidden row at all.
grant select (hidden_at) on public.moments to authenticated;

create or replace function public.moments_guard_hidden() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.hidden_at := null;
  elsif new.hidden_at is distinct from old.hidden_at then
    raise exception 'hidden_at is set by the server' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger moments_guard_hidden before insert or update on public.moments
  for each row execute function public.moments_guard_hidden();

-- Replaces 0005's helper: a hidden moment is visible only to its owner.
create or replace function public.can_view_moment(viewer uuid, m public.moments) returns boolean
language sql stable security definer set search_path = public as $$
  select m.user_id = viewer
      or (m.status = 'live' and not m.is_private and m.hidden_at is null
          and exists (select 1 from jars j where j.id = m.jar_id and can_view_jar(viewer, j)))
$$;

-- ANDed with moments_owner and moments_others_select (and anything added later) for API clients.
create policy moments_hidden_select on public.moments as restrictive for select to authenticated
  using (hidden_at is null or user_id = auth.uid() or public.is_moderator());

-- Replaces 0013's function: visible_count leaves out hidden moments; the trigger also fires on hidden_at.
create or replace function public.moments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set
      moment_count  = (select count(*) from moments where jar_id = jid and status <> 'removed' and replaces is null),
      visible_count = (select count(*) from moments
                       where jar_id = jid and status = 'live' and not is_private and hidden_at is null),
      updated_at = now()
    where id = jid;
    update profiles p set jar_count = (select count(*) from jars where user_id = p.id and moment_count > 0)
    where p.id = (select user_id from jars where id = jid);
  end loop;
  return null;
end $$;
drop trigger moments_count on public.moments;
create trigger moments_count
  after insert or delete or update of status, is_private, jar_id, replaces, hidden_at on public.moments
  for each row execute function public.moments_count_sync();

-- ---------------------------------------------------------------- report insert: clients
-- Runs as the caller (so it can tell clients from server code) before reports_bi_validate (names sort).
create or replace function public.reports_before_insert_client() returns trigger
language plpgsql as $$
begin
  if public.is_client_role() then
    new.status := 'open';
    new.created_at := now();
    new.moderation_item_id := null;
  end if;
  return new;
end $$;
create trigger reports_bi_client before insert on public.reports
  for each row execute function public.reports_before_insert_client();

-- ---------------------------------------------------------------- report insert: validation
-- Security definer: reads the target whatever the caller can see, and decides as the reporter.
create or replace function public.reports_before_insert_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner_id uuid;
  visible boolean;
begin
  -- A repeat report: leave it to the unique index (submit_report ignores it), even if the target has
  -- been hidden since the first one.
  if exists (select 1 from reports r
             where r.reporter_id = new.reporter_id and r.target = new.target and r.target_id = new.target_id) then
    return new;
  end if;

  case new.target
    when 'moment' then
      select m.user_id, can_view_moment(new.reporter_id, m) into owner_id, visible
      from moments m where m.id = new.target_id;
    when 'jar' then
      select j.user_id, can_view_jar(new.reporter_id, j) into owner_id, visible
      from jars j where j.id = new.target_id;
    when 'comment' then
      select c.user_id,
             c.deleted_at is null and not c.is_hidden
             and not is_blocked_between(new.reporter_id, c.user_id)
             and exists (select 1 from jars j where j.id = c.jar_id and can_view_jar(new.reporter_id, j))
        into owner_id, visible
      from comments c where c.id = new.target_id;
    when 'profile' then
      select p.id, p.status = 'active' and not is_blocked_between(new.reporter_id, p.id)
        into owner_id, visible
      from profiles p where p.id = new.target_id;
  end case;

  if owner_id is not null and owner_id = new.reporter_id then
    raise exception 'you cannot report your own content' using errcode = '22023';
  end if;
  if owner_id is null or not coalesce(visible, false) then
    raise exception 'you can only report something you can see' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger reports_bi_validate before insert on public.reports
  for each row execute function public.reports_before_insert_validate();

-- ---------------------------------------------------------------- report insert: queue and hide
create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  item uuid;
  reporters int;
begin
  for i in 1..2 loop
    select mi.id into item from moderation_items mi
    where mi.source = 'report' and mi.status in ('pending', 'escalated')
      and case new.target
            when 'moment' then mi.moment_id = new.target_id
            when 'comment' then mi.comment_id = new.target_id
            when 'jar' then mi.jar_id = new.target_id
            when 'profile' then mi.profile_id = new.target_id
          end
    for update;
    exit when item is not null;
    -- None open: open one. A concurrent report may win the race (unique index); then take its item.
    insert into moderation_items (moment_id, comment_id, jar_id, profile_id, source, status, report_id)
    values (case when new.target = 'moment' then new.target_id end,
            case when new.target = 'comment' then new.target_id end,
            case when new.target = 'jar' then new.target_id end,
            case when new.target = 'profile' then new.target_id end,
            'report', 'pending', new.id)
    on conflict do nothing
    returning id into item;
    exit when item is not null;
  end loop;
  if item is null then
    raise exception 'could not queue the report' using errcode = '40001';
  end if;

  update reports set moderation_item_id = item where id = new.id;

  if new.target = 'moment' then
    select count(distinct r.reporter_id) into reporters from reports r
    where r.moderation_item_id = item and r.created_at > new.created_at - interval '24 hours';
    if reporters >= 3 then
      update moments set hidden_at = now() where id = new.target_id and hidden_at is null;
    end if;
  end if;
  return null;
end $$;
create trigger reports_ai after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------------------------------------------------------------- a moderator keeps it: unhide
create or replace function public.moderation_items_report_decided() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'kept' and old.status in ('pending', 'escalated') then
    update moments set hidden_at = null where id = new.moment_id and hidden_at is not null;
  end if;
  return null;
end $$;
create trigger moderation_items_report_decided after update of status on public.moderation_items
  for each row when (new.source = 'report' and new.moment_id is not null)
  execute function public.moderation_items_report_decided();

-- ---------------------------------------------------------------- submit_report
-- Security invoker: it needs no privilege the caller lacks. RLS (reports_insert, reports_active_insert)
-- and the triggers above still decide; the function only fills reporter_id and ignores repeats.
create or replace function public.submit_report(
  target target_type,
  target_id uuid,
  reason report_reason,
  note text default null
) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in to report' using errcode = '42501';
  end if;
  -- Not ON CONFLICT DO NOTHING: with a conflict target Postgres also applies the select policies, which
  -- (on purpose) give the reporter no rows. A repeat raises unique_violation instead, ignored here.
  insert into reports (reporter_id, target, target_id, reason, note)
  values (auth.uid(), submit_report.target, submit_report.target_id, submit_report.reason,
          nullif(btrim(submit_report.note), ''));
exception when unique_violation then
  null; -- already reported by this user: nothing more to record
end $$;
revoke execute on function public.submit_report(target_type, uuid, report_reason, text) from public, anon;
grant execute on function public.submit_report(target_type, uuid, report_reason, text) to authenticated;
