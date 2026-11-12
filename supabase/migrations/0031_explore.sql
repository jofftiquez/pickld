-- 0031 — Explore RPCs: people search, suggested authors and Full jars today (FR-EXP-01, FR-EXP-02; M6-07).
-- Additive only: the pg_trgm extension, one index on profiles and three functions. No table change.
--
-- All three run as the caller (security invoker), so the profiles, follows, jars and moments policies apply on
-- top of the explicit filters here: never the caller, never an inactive account, never anyone blocked either
-- way. Suggestions from the address book come from fn:contacts-match (0015), which the app merges in; these
-- functions cover the rest.

create extension if not exists pg_trgm with schema extensions;

-- One lower-cased "username display name" string per profile, trigram-indexed, so a search stays well under a
-- second as the user count grows. search_people matches on exactly this expression.
create index profiles_search_trgm_idx on public.profiles
  using gin (lower(username::text || ' ' || display_name) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- search
-- People whose username or display name matches `query` (a leading @ is ignored), best match first: exact
-- username, then username prefix, then trigram similarity, then reader count. Under 2 characters returns
-- nothing.
create or replace function public.search_people(query text, max_count int default 20)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  lid_color text,
  reader_count int,
  is_reading boolean
)
language plpgsql stable set search_path = public, extensions as $$
declare q text := lower(btrim(regexp_replace(coalesce(search_people.query, ''), '^\s*@', '')));
begin
  if char_length(q) < 2 then
    return;
  end if;
  return query
  select p.id, p.username::text, p.display_name, p.avatar_path, p.lid_color, p.reader_count,
         exists (select 1 from follows f where f.reader_id = auth.uid() and f.author_id = p.id)
  from profiles p
  where p.id <> auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
    and (lower(p.username::text || ' ' || p.display_name) like '%' || q || '%'
         or lower(p.username::text || ' ' || p.display_name) % q)
  order by lower(p.username::text) = q desc,
           lower(p.username::text) like q || '%' desc,
           similarity(lower(p.username::text || ' ' || p.display_name), q) desc,
           p.reader_count desc,
           p.username
  limit least(greatest(coalesce(search_people.max_count, 20), 1), 50);
end $$;

-- ---------------------------------------------------------------- suggested authors
-- Friends of friends: people read by the authors the caller reads, whom the caller doesn't read yet, ranked by
-- how many of the caller's authors read them, then reader count.
create or replace function public.suggested_authors(max_count int default 10)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  lid_color text,
  reader_count int,
  mutual_count int
)
language sql stable set search_path = public as $$
  select p.id, p.username::text, p.display_name, p.avatar_path, p.lid_color, p.reader_count, count(*)::int
  from follows mine
  join follows theirs on theirs.reader_id = mine.author_id
  join profiles p on p.id = theirs.author_id
  where mine.reader_id = auth.uid()
    and p.id <> auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), p.id)
    and not is_blocked_between(auth.uid(), mine.author_id)
    and not exists (select 1 from follows f where f.reader_id = auth.uid() and f.author_id = p.id)
  group by p.id
  order by count(*) desc, p.reader_count desc, p.username
  limit least(greatest(coalesce(suggested_authors.max_count, 10), 1), 50)
$$;

-- ---------------------------------------------------------------- Full jars today
-- Everyone jars that are published, still open (their own local day hasn't ended) and full with eight moments
-- others can see, newest first, each with the first visible slot as the cover. A jar whose eighth moment is
-- private isn't full to anyone else, so it never shows here (rule 9).
create or replace function public.full_jars_today(max_count int default 12)
returns table (
  jar_id uuid,
  user_id uuid,
  username text,
  display_name text,
  avatar_path text,
  local_date date,
  published_at timestamptz,
  cover_moment_id uuid,
  cover_slot slot
)
language sql stable set search_path = public as $$
  select j.id, p.id, p.username::text, p.display_name, p.avatar_path, j.local_date, j.published_at, c.id, c.slot
  from jars j
  join profiles p on p.id = j.user_id
  left join lateral (
    select m.id, m.slot from moments m
    where m.jar_id = j.id and m.status = 'live' and not m.is_private and m.hidden_at is null
      and m.replaces is null and m.thumb_path is not null
    order by m.slot limit 1
  ) c on true
  where j.visibility = 'everyone'
    and j.published_at is not null
    and j.visible_count >= 8
    and j.ends_at > now()
    and j.user_id <> auth.uid()
    and p.status = 'active'
    and not is_blocked_between(auth.uid(), j.user_id)
  order by j.published_at desc
  limit least(greatest(coalesce(full_jars_today.max_count, 12), 1), 50)
$$;

revoke execute on function public.search_people(text, int) from public, anon;
revoke execute on function public.suggested_authors(int) from public, anon;
revoke execute on function public.full_jars_today(int) from public, anon;
grant execute on function public.search_people(text, int) to authenticated;
grant execute on function public.suggested_authors(int) to authenticated;
grant execute on function public.full_jars_today(int) to authenticated;
