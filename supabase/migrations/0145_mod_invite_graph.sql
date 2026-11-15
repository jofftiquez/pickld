-- 0145: the console's invite graph. Additive: two moderator read functions; nothing is dropped or renamed.
--
--   mod_invite_tree(user, depth, limit)   one person's invite tree: everyone above them up to whoever started the
--                                         chain (a person with no inviter, the waitlist or an admin code), and
--                                         everyone they brought in, up to `depth` levels and `limit` people down
--   mod_invite_network(limit)             everyone in the invite tree, oldest joiners first, up to `limit` people
--
-- Both return { nodes, edges, truncated }. A node is a person (id, username, display_name, status, frozen,
-- direct and total invitees) or a source with no owner: the waitlist (id 'waitlist') or an admin code
-- (id 'admin:CODE', with its note). An edge runs from inviter (or source) to invitee. A person's direct and total
-- always count the whole tree, even when the graph shows only part of it. Moderators see every person, whatever their
-- status or blocks. Both refuse anyone who isn't a moderator. The graph is console-only: it never feeds the app or
-- analytics.

-- One person's invite tree. Null when there is no such profile. depth is 1 to 6 levels (default 3) and limit 1
-- to 500 people below them (default 200), nearest and earliest first; truncated says whether anyone below was
-- left out.
create or replace function public.mod_invite_tree(p_user uuid, p_depth int default 3, p_limit int default 200)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_depth int := least(greatest(coalesce(p_depth, 3), 1), 6);
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 500);
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = p_user) then
    return null;
  end if;
  return (
    with recursive
    -- Up the chain: each person's inviter, until someone joined without a person's code.
    up as (
      select p_user as id, 0 as depth
      union all
      select c.owner_id, up.depth - 1
      from up
      join invite_redemptions r on r.invitee_id = up.id
      join invite_codes c on c.code = r.code
      where c.owner_id is not null and up.depth > -100
    ),
    -- Down: everyone who joined with their personal codes, one more level than shown to tell whether it's cut.
    down as (
      select p_user as id, 0 as depth, null::timestamptz as joined_at, array[p_user] as path
      union all
      select r.invitee_id, down.depth + 1, r.redeemed_at, down.path || r.invitee_id
      from down
      join invite_codes c on c.owner_id = down.id and c.kind = 'personal'
      join invite_redemptions r on r.code = c.code
      where r.invitee_id is not null and down.depth <= v_depth and r.invitee_id <> all(down.path)
    ),
    below as (
      select id, depth from down where depth between 1 and v_depth order by depth, joined_at, id limit v_limit
    ),
    shown as (
      select id, depth from up
      union
      select id, depth from below
    ),
    -- Every (shown person, someone below them) pair, for the counts.
    pairs as (
      select s.id as top, r.invitee_id as id, 1 as d
      from shown s
      join invite_codes c on c.owner_id = s.id and c.kind = 'personal'
      join invite_redemptions r on r.code = c.code
      where r.invitee_id is not null
      union all
      select pairs.top, r.invitee_id, pairs.d + 1
      from pairs
      join invite_codes c on c.owner_id = pairs.id and c.kind = 'personal'
      join invite_redemptions r on r.code = c.code
      where r.invitee_id is not null and pairs.d < 100
    ),
    counts as (
      select top, count(*) filter (where d = 1) as direct, count(*) as total from pairs group by top
    ),
    -- How each shown person joined.
    joined as (
      select s.id, s.depth, c.kind, c.code, c.note, c.owner_id, r.via_link, r.redeemed_at
      from shown s
      join invite_redemptions r on r.invitee_id = s.id
      join invite_codes c on c.code = r.code
    ),
    -- The source at the top of the chain, when the topmost person joined with a waitlist or admin code. direct is
    -- how many people joined with it; total isn't counted here (the whole network page has it).
    origin as (
      select case when j.kind = 'waitlist' then 'waitlist' else 'admin:' || j.code end as id, j.kind, j.code, j.note,
             (select count(*) from invite_redemptions r2 join invite_codes c2 on c2.code = r2.code
              where r2.invitee_id is not null
                and (case when j.kind = 'waitlist' then c2.kind = 'waitlist' else c2.code = j.code end)) as direct
      from joined j
      where j.owner_id is null and j.depth = (select min(depth) from shown)
    )
    select jsonb_build_object(
      'focus', p_user,
      'depth', v_depth,
      'limit', v_limit,
      'truncated', (select count(*) from down where depth between 1 and v_depth) > v_limit
                   or exists (select 1 from down where depth = v_depth + 1),
      'nodes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'type', 'person', 'username', p.username, 'display_name', p.display_name,
          'status', p.status, 'frozen', h.frozen_at is not null, 'level', s.depth,
          'direct', coalesce(k.direct, 0), 'total', coalesce(k.total, 0)) order by s.depth, p.username)
        from shown s
        join profiles p on p.id = s.id
        left join invite_holders h on h.user_id = s.id
        left join counts k on k.top = s.id), '[]'::jsonb)
        || coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', o.id, 'type', o.kind, 'code', case when o.kind = 'admin' then o.code end, 'note', o.note,
          'level', (select min(depth) from shown) - 1, 'direct', o.direct, 'total', null))
        from origin o), '[]'::jsonb),
      'edges', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source', case when j.owner_id is not null then j.owner_id::text
                         when j.kind = 'waitlist' then 'waitlist'
                         else 'admin:' || j.code end,
          'target', j.id, 'via_link', j.via_link, 'joined_at', j.redeemed_at) order by j.redeemed_at)
        from joined j
        where j.owner_id in (select id from shown)
           or (j.owner_id is null and j.depth = (select min(depth) from shown))), '[]'::jsonb)
    )
  );
end $$;
comment on function public.mod_invite_tree(uuid, int, int) is
  'Moderators: one person''s invite tree, up to whoever started the chain and down a few levels (console graph).';

-- Everyone in the invite tree: people who joined with any code or brought someone in. Oldest joiners first, so
-- a cut keeps every shown person's inviter. limit is 1 to 3000 people (default 1500).
create or replace function public.mod_invite_network(p_limit int default 1500) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 1500), 1), 3000);
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return (
    with recursive
    links as (
      select r.invitee_id as id, c.kind, c.code, c.note, c.owner_id, r.via_link, r.redeemed_at
      from invite_redemptions r
      join invite_codes c on c.code = r.code
      where r.invitee_id is not null
    ),
    people as (
      select p.id, coalesce(l.redeemed_at, p.created_at) as at
      from profiles p
      left join links l on l.id = p.id
      where l.id is not null or exists (select 1 from links x where x.owner_id = p.id)
    ),
    shown as (
      select id from people order by at, id limit v_limit
    ),
    pairs as (
      select owner_id as top, id, 1 as d from links where owner_id is not null
      union all
      select pairs.top, l.id, pairs.d + 1
      from pairs
      join links l on l.owner_id = pairs.id
      where pairs.d < 100
    ),
    counts as (
      select top, count(*) filter (where d = 1) as direct, count(*) as total from pairs group by top
    ),
    -- The waitlist (one node for all its codes) and each admin code, counted over everyone, shown when at least
    -- one person who joined with it is shown.
    sources as (
      select case when l.kind = 'waitlist' then 'waitlist' else 'admin:' || l.code end as id,
             l.kind, max(l.code) as code, max(l.note) as note,
             count(*) as direct, count(*) + coalesce(sum(k.total), 0) as total,
             bool_or(l.id in (select id from shown)) as visible
      from links l
      left join counts k on k.top = l.id
      where l.owner_id is null
      group by 1, 2
    )
    select jsonb_build_object(
      'limit', v_limit,
      'people', (select count(*) from people),
      'truncated', (select count(*) from people) > v_limit,
      'nodes', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'type', 'person', 'username', p.username, 'display_name', p.display_name,
          'status', p.status, 'frozen', h.frozen_at is not null,
          'direct', coalesce(k.direct, 0), 'total', coalesce(k.total, 0)) order by p.username)
        from shown s
        join profiles p on p.id = s.id
        left join invite_holders h on h.user_id = s.id
        left join counts k on k.top = s.id), '[]'::jsonb)
        || coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', id, 'type', kind, 'code', case when kind = 'admin' then code end, 'note', note,
          'direct', direct, 'total', total) order by id)
        from sources where visible), '[]'::jsonb),
      'edges', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source', case when l.owner_id is not null then l.owner_id::text
                         when l.kind = 'waitlist' then 'waitlist'
                         else 'admin:' || l.code end,
          'target', l.id, 'via_link', l.via_link, 'joined_at', l.redeemed_at) order by l.redeemed_at)
        from links l
        join shown s on s.id = l.id
        where l.owner_id is null or l.owner_id in (select id from shown)), '[]'::jsonb)
    )
  );
end $$;
comment on function public.mod_invite_network(int) is
  'Moderators: everyone in the invite tree, oldest joiners first, with who brought in whom (console graph).';

revoke execute on function public.mod_invite_tree(uuid, int, int) from public, anon;
revoke execute on function public.mod_invite_network(int) from public, anon;
grant execute on function public.mod_invite_tree(uuid, int, int) to authenticated;
grant execute on function public.mod_invite_network(int) to authenticated;
