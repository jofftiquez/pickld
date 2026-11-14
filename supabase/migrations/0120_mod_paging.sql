-- 0120 — Paging for the console's long lists (FR-MOD-02, FR-MOD-07). Additive: two new read-only functions;
-- mod_queue() and mod_user_search() keep their signatures and results and now read through them, so each query
-- lives in one place.
--
-- mod_queue_page() is mod_queue() (0042) with an offset and an optional newest-first order; oldest first stays
-- the default. Like mod_queue() it is owned by pickld_moderation, checks the moderator role in the JWT first,
-- and returns text and ids only. The console takes each filter's total from mod_queue_stats().
--
-- mod_user_search_page() is mod_user_search() (0090) with an offset, a sort and the number of matches in every
-- row (total). An exact username match still comes first, whatever the sort.

create or replace function public.mod_queue_page(
  p_filter text default 'all', p_limit int default 25, p_offset int default 0, p_newest boolean default false)
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
    order by case when p_newest then mi.created_at end desc, case when p_newest then mi.id end desc,
             mi.created_at, mi.id
    limit least(greatest(coalesce(p_limit, 25), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
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
  order by case when p_newest then o.created_at end desc, case when p_newest then o.id end desc,
           o.created_at, o.id;
end;
$$;

create or replace function public.mod_queue(p_filter text default 'all', p_limit int default 100)
returns table (
  id uuid, source mod_source, status mod_status, created_at timestamptz, kind text, moment_id uuid, slot text,
  local_date date, caption text, comment_body text, reason text, score numeric, report_count int,
  appeal_message text, owner_id uuid, username text, owner_joined timestamptz, prior_removals int, visible boolean
)
language sql stable security definer set search_path = public as $$
  select * from mod_queue_page(p_filter, least(greatest(coalesce(p_limit, 100), 1), 200), 0, false)
$$;

-- ---------------------------------------------------------------- Users
create or replace function public.mod_user_search_page(
  p_query text, p_sort text default 'newest', p_limit int default 25, p_offset int default 0)
returns table (
  id uuid,
  username text,
  display_name text,
  status profile_status,
  suspended_until timestamptz,
  created_at timestamptz,
  strikes int,
  moment_count int,
  open_reports int,
  total int             -- how many accounts match, on every row
)
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  q text := btrim(coalesce(p_query, ''));
  pattern text;
begin
  if claims ->> 'sub' is null or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator' then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if char_length(q) > 254 then
    raise exception 'query is at most 254 characters' using errcode = '22023';
  end if;
  if p_sort is null or p_sort not in ('newest', 'oldest', 'username', 'strikes', 'reports') then
    raise exception 'sort must be newest, oldest, username, strikes or reports' using errcode = '22023';
  end if;
  pattern := '%' || replace(replace(replace(ltrim(q, '@'), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  with found as (
    select p.id, p.username::text as username, p.display_name, p.status, p.suspended_until, p.created_at,
           (lower(p.username::text) = lower(ltrim(q, '@'))) as exact
    from profiles p
    where q = ''
       or (q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and p.id = q::uuid)
       or (position('@' in ltrim(q, '@')) > 0
           and p.id in (select u.id from auth.users u where lower(u.email) = lower(q)))
       or p.username ilike pattern
       or p.display_name ilike pattern
  ),
  counted as (
    select f.*,
           strike_count(f.id) as strikes,
           (select count(*)::int from moments m where m.user_id = f.id) as moment_count,
           (select count(*)::int from reports r
            where r.status = 'open'
              and (r.target_id = f.id
                   or r.target_id in (select m.id from moments m where m.user_id = f.id)
                   or r.target_id in (select c.id from comments c where c.user_id = f.id)
                   or r.target_id in (select j.id from jars j where j.user_id = f.id))) as open_reports,
           count(*) over ()::int as total
    from found f
  )
  select c.id, c.username, c.display_name, c.status, c.suspended_until, c.created_at,
         c.strikes, c.moment_count, c.open_reports, c.total
  from counted c
  order by c.exact desc,
           case p_sort when 'strikes' then c.strikes when 'reports' then c.open_reports end desc nulls last,
           case when p_sort = 'username' then lower(c.username) end,
           case when p_sort = 'oldest' then c.created_at end,
           c.created_at desc, c.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.mod_user_search(p_query text, p_limit int default 50)
returns table (
  id uuid, username text, display_name text, status profile_status, suspended_until timestamptz,
  created_at timestamptz, strikes int, moment_count int, open_reports int
)
language sql stable security definer set search_path = public as $$
  select s.id, s.username, s.display_name, s.status, s.suspended_until, s.created_at, s.strikes, s.moment_count,
         s.open_reports
  from mod_user_search_page(p_query, 'newest', least(greatest(coalesce(p_limit, 50), 1), 100), 0) s
$$;

-- ---------------------------------------------------------------- ownership and grants
grant create on schema public to pickld_moderation;
alter function public.mod_queue_page(text, int, int, boolean) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke all on function public.mod_queue_page(text, int, int, boolean) from public, anon;
revoke all on function public.mod_user_search_page(text, text, int, int) from public, anon;
grant execute on function public.mod_queue_page(text, int, int, boolean) to authenticated;
grant execute on function public.mod_user_search_page(text, text, int, int) to authenticated;
