-- 0017 — Profile and follow RPCs (M3-12; FR-SOC-07, FR-SOC-09, FR-ACC-03; C-2). Additive only: two
-- functions. No table or column is added, dropped or renamed.
--
--   * username_available(candidate): what Edit profile and About you show while the user types.
--     Usernames are citext, so the check is case-insensitive; reserved route words (0016) and malformed
--     names are reported as such. It looks at every profile, including suspended and blocked ones (a name
--     is taken whoever holds it), so it is security definer and returns only a verdict, never who.
--   * search_follow_list(owner, list, query): a profile's readers or authors for Readers & authors, with
--     search by name or username and the viewer's Reading / Read back state per row. Security invoker:
--     the follows_select and profiles_others_select policies (0001) already drop anyone blocked either
--     way with the viewer and inactive profiles; the query repeats the block check so the rule is visible
--     here too.
--   * Removing a reader needs nothing new: follows_delete (0001) lets the author delete a follow whose
--     author_id is them, and follows_sync keeps both counts right. pgTAP 018 pins that down.

create or replace function public.username_available(candidate text)
returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if candidate is null or candidate !~ '^[A-Za-z0-9._]{3,20}$' then
    return 'invalid';
  end if;
  if is_reserved_username(candidate) then
    return 'reserved';
  end if;
  if exists (select 1 from profiles where username = candidate::citext and id is distinct from auth.uid()) then
    return 'taken';
  end if;
  return 'available';
end $$;
comment on function public.username_available(text) is
  'available | taken | reserved | invalid, case-insensitive. The caller''s own username is available.';
revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

create or replace function public.search_follow_list(
  owner uuid,
  list text,
  query text default '',
  lim int default 50
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  is_following boolean,  -- the viewer reads them (Reading)
  follows_viewer boolean -- they read the viewer (Read back)
)
language sql stable security invoker set search_path = public as $$
  with people as (
    select case when list = 'readers' then f.reader_id else f.author_id end as person
    from follows f
    where list in ('readers', 'authors')
      and (case when list = 'readers' then f.author_id else f.reader_id end) = owner
  ),
  q as (
    -- Search text is matched literally: % and _ in it are not wildcards.
    select '%' || replace(replace(replace(coalesce(btrim(query), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select p.id, p.username::text, p.display_name, p.avatar_path,
         exists (select 1 from follows x where x.reader_id = auth.uid() and x.author_id = p.id),
         exists (select 1 from follows x where x.reader_id = p.id and x.author_id = auth.uid())
  from people
  join profiles p on p.id = people.person
  cross join q
  where p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
    and (p.username::text ilike q.pattern or p.display_name ilike q.pattern)
  order by p.username
  limit least(greatest(coalesce(lim, 50), 1), 200)
$$;
comment on function public.search_follow_list(uuid, text, text, int) is
  'A profile''s readers or authors (list = readers | authors), searchable by name or username, '
  'without anyone blocked either way with the caller.';
revoke execute on function public.search_follow_list(uuid, text, text, int) from public, anon;
grant execute on function public.search_follow_list(uuid, text, text, int) to authenticated;
