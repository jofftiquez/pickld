-- 0022 — Blocked accounts list (M3-22; FR-SAF-02, FR-PUB-06). Additive: one function, nothing dropped or renamed.
--
-- Blocking is a plain insert into `blocks` under blocks_owner (0001; blocker_id = auth.uid()), and
-- unblocking a delete. blocks_sync (0019) removes follows both ways and the notifications between the two
-- of them; nobody is notified. A block hides both profiles from each other (0005), so the blocker can't
-- read the people they blocked through `profiles`. This function returns just enough of them for the
-- Blocked accounts screen: only the caller's own blocks, newest first. The blocked person can't learn
-- who blocked them: blocks_owner shows a row only to its blocker, and this returns only those rows.
create or replace function public.blocked_accounts()
returns table (id uuid, username text, display_name text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_path, b.created_at
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc, p.id
$$;
comment on function public.blocked_accounts() is
  'The caller''s blocked accounts for the Blocked accounts screen (0022); only their own blocks.';

revoke execute on function public.blocked_accounts() from public, anon;
grant execute on function public.blocked_accounts() to authenticated;
