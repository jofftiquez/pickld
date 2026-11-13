-- 0042 — What the moderation console reads (M3-26; FR-MOD-02, FR-MOD-03). Additive: two read-only
-- functions, nothing else changes.
--
-- Moderators can read moderation_items, reports, appeals and the audit log through RLS (0001, 0041), but
-- not the content an item is about: a checking, removed or private moment, a hidden comment, or another
-- user's profile row. mod_queue() joins that in for them. Like mod_decide() (0041) it is owned by
-- pickld_moderation, which may read that content (0011, 0041), and checks the moderator role in the JWT
-- first; it returns text and ids only. Photos still go through fn:photo-urls, which signs a queued moment
-- for a moderator (M1-16) and nothing else.
--
-- Filters (FR-MOD-02): all = every open item (pending or escalated); auto_check, report and appeal = the
-- pending items from that source; escalated = items a moderator escalated. Oldest first.

create or replace function public.mod_queue(p_filter text default 'all', p_limit int default 100)
returns table (
  id uuid,
  source mod_source,
  status mod_status,
  created_at timestamptz,
  kind text,            -- moment | comment | jar | profile
  moment_id uuid,
  slot text,
  local_date date,
  caption text,
  comment_body text,
  reason text,          -- auto_check: the score category that queued it; report: the most common report
                        -- reason; appeal: the guideline the content was removed under
  score numeric,        -- auto_check: that category's score
  report_count int,
  appeal_message text,
  owner_id uuid,
  username text,
  owner_joined timestamptz,
  prior_removals int,   -- removals still standing on the owner's other content
  visible boolean       -- whether readers can see the moment or comment right now (null for jars, profiles)
)
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if p_filter is null or p_filter not in ('all', 'auto_check', 'report', 'appeal', 'escalated') then
    raise exception 'filter must be all, auto_check, report, appeal or escalated' using errcode = '22023';
  end if;
  return query
  with open_items as (
    select mi.*
    from moderation_items mi
    where case p_filter
            when 'all' then mi.status in ('pending', 'escalated')
            when 'escalated' then mi.status = 'escalated'
            else mi.status = 'pending' and mi.source::text = p_filter
          end
    order by mi.created_at, mi.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ),
  -- An appeal item points at the appeal, whose own item names the content.
  target as (
    select o.id as item_id, coalesce(orig.moment_id, o.moment_id) as moment_id,
           coalesce(orig.comment_id, o.comment_id) as comment_id,
           coalesce(orig.jar_id, o.jar_id) as jar_id,
           coalesce(orig.profile_id, o.profile_id) as profile_id,
           orig.decision_reason as removed_for, ap.message as appeal_message
    from open_items o
    left join appeals ap on ap.id = o.appeal_id
    left join moderation_items orig on orig.id = ap.moderation_item_id
  ),
  owner as (
    select t.item_id,
           coalesce(m.user_id, c.user_id, j.user_id, t.profile_id) as owner_id
    from target t
    left join moments m on m.id = t.moment_id
    left join comments c on c.id = t.comment_id
    left join jars j on j.id = t.jar_id
  )
  select o.id, o.source, o.status, o.created_at,
         case when t.moment_id is not null then 'moment'
              when t.comment_id is not null then 'comment'
              when t.jar_id is not null then 'jar'
              else 'profile' end,
         t.moment_id,
         m.slot::text,
         coalesce(mj.local_date, cj.local_date, j.local_date),
         coalesce(m.pending_caption, m.caption),
         c.body,
         case o.source
           when 'auto_check' then coalesce(o.decision_reason, top.category)
           when 'report' then rep.reason
           else t.removed_for
         end,
         case when o.source = 'auto_check' then
           (select (v.value)::numeric from jsonb_each(coalesce(o.scores -> 'scores', '{}'::jsonb)) v
            where v.key = coalesce(o.decision_reason, top.category) and jsonb_typeof(v.value) = 'number')
         end,
         coalesce(rep.n, 0)::int,
         t.appeal_message,
         ow.owner_id,
         p.username::text,
         p.created_at,
         (select count(*)::int
          from moderation_items r
          left join moments rm on rm.id = r.moment_id
          left join comments rc on rc.id = r.comment_id
          where r.status = 'removed' and r.source <> 'appeal' and r.id <> o.id
            and coalesce(rm.user_id, rc.user_id) = ow.owner_id
            and coalesce(r.moment_id, r.comment_id) is distinct from coalesce(t.moment_id, t.comment_id)),
         case when m.id is not null then m.status = 'live' and m.hidden_at is null
              when c.id is not null then not c.is_hidden and c.deleted_at is null end
  from open_items o
  join target t on t.item_id = o.id
  join owner ow on ow.item_id = o.id
  left join moments m on m.id = t.moment_id
  left join jars mj on mj.id = m.jar_id
  left join comments c on c.id = t.comment_id
  left join jars cj on cj.id = c.jar_id
  left join jars j on j.id = t.jar_id
  left join profiles p on p.id = ow.owner_id
  left join lateral (
    select v.key as category
    from jsonb_each(coalesce(o.scores -> 'scores', '{}'::jsonb)) v
    where jsonb_typeof(v.value) = 'number'
    order by (v.value)::numeric desc
    limit 1
  ) top on true
  left join lateral (
    select (select r.reason::text from reports r
            where r.moderation_item_id = o.id or r.id = o.report_id
            group by r.reason order by count(*) desc, r.reason limit 1) as reason,
           (select count(*) from reports r where r.moderation_item_id = o.id or r.id = o.report_id) as n
  ) rep on true
  order by o.created_at, o.id;
end;
$$;

-- The header counts (FR-MOD-02): pending items, the median time they have waited, open appeals, and how
-- many items each filter holds.
create or replace function public.mod_queue_stats()
returns table (
  pending int,
  median_wait_seconds int,
  open_appeals int,
  all_open int,
  auto_check int,
  report int,
  escalated int
)
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return query
  select count(*) filter (where status = 'pending')::int,
         coalesce(extract(epoch from percentile_cont(0.5) within group (order by now() - created_at)
                    filter (where status = 'pending')), 0)::int,
         count(*) filter (where status = 'pending' and source = 'appeal')::int,
         count(*)::int,
         count(*) filter (where status = 'pending' and source = 'auto_check')::int,
         count(*) filter (where status = 'pending' and source = 'report')::int,
         count(*) filter (where status = 'escalated')::int
  from moderation_items
  where status in ('pending', 'escalated');
end;
$$;

grant create on schema public to pickld_moderation;
alter function public.mod_queue(text, int) owner to pickld_moderation;
alter function public.mod_queue_stats() owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke all on function public.mod_queue(text, int) from public, anon;
revoke all on function public.mod_queue_stats() from public, anon;
grant execute on function public.mod_queue(text, int) to authenticated;
grant execute on function public.mod_queue_stats() to authenticated;
-- pickld_moderation counts an item's reports for the queue (0011 and 0041 grant the rest). Its own policy:
-- reports_mod's is_moderator() reads the auth schema, which this role has no rights on.
grant select on public.reports to pickld_moderation;
create policy reports_moderation_select on public.reports for select to pickld_moderation using (true);
