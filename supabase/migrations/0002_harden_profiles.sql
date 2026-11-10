-- 0002 — Harden profiles (docs/analysis.md §2.3 S-1, S-4, S-13; M1-07).
-- Additive only: 0001 stays as delivered, no column is dropped or renamed.

-- ---------------------------------------------------------------- client roles
-- True when the statement runs as a signed-in or anonymous client (PostgREST roles). Server code
-- (service_role, the postgres owner, and security definer functions owned by postgres) is not a client.
create or replace function public.is_client_role() returns boolean
language sql stable as $$
  select current_user in ('authenticated', 'anon')
$$;

-- Active means the account can write (D-11: suspended and deleted accounts can't).
create or replace function public.is_active_user(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and status = 'active')
$$;
revoke execute on function public.is_active_user(uuid) from public, anon;
grant execute on function public.is_active_user(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- S-1: profile column guard
-- Clients may edit only the profile fields; status, counters, birthday, id and created_at are server-owned.
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  if not public.is_client_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- A new profile always starts active with empty counters and the server's clock.
    new.status := 'active';
    new.reader_count := 0;
    new.author_count := 0;
    new.jar_count := 0;
    new.created_at := now();
    return new;
  end if;
  if new.id is distinct from old.id
     or new.status is distinct from old.status
     or new.birthday is distinct from old.birthday
     or new.reader_count is distinct from old.reader_count
     or new.author_count is distinct from old.author_count
     or new.jar_count is distinct from old.jar_count
     or new.created_at is distinct from old.created_at then
    raise exception 'only profile fields can be changed'
      using errcode = '42501',
            hint = 'Editable: username, display_name, bio, avatar_path, cover_path, lid_color, home_tz, default_visibility.';
  end if;
  return new;
end $$;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------- S-4: birthday privacy
-- 0001's column revoke had no effect while the table-level SELECT grant existed. Replace the table
-- grant with a column list that leaves birthday out. Anonymous visitors get nothing from the table;
-- the web page will read profiles through narrow RPCs (G-16).
revoke select on public.profiles from authenticated, anon;
grant select (id, username, display_name, bio, avatar_path, cover_path, lid_color, home_tz,
              default_visibility, reader_count, author_count, jar_count, status, created_at)
  on public.profiles to authenticated;
-- Writes: clients never delete profiles (account deletion is a server job) and anon writes nothing.
revoke insert, update, delete on public.profiles from anon;
revoke delete on public.profiles from authenticated;

-- The owner reads their full row, including birthday, here.
create or replace function public.my_profile() returns setof public.profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid()
$$;
revoke execute on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------------------------------------------------------------- S-13: notifications
-- Owners may only mark their notifications read. Rows are written by server triggers.
revoke insert, update, delete on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;
revoke select on public.notifications from anon;

-- ---------------------------------------------------------------- defense in depth
-- Supabase's default grants include TRUNCATE, REFERENCES and TRIGGER for the client roles.
-- TRUNCATE ignores RLS and row triggers (it would bypass audit_log's append-only trigger).
-- PostgREST never issues these statements, but nothing a client does needs them.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from anon, authenticated;
