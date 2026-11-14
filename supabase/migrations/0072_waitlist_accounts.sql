-- 0072 (INV-12, docs/plans/invite-codes.md): waitlist sign-ups become verified accounts. The pickld.me form
-- emails a 6-digit code through Supabase Auth (creating the auth user), checks it, then calls
-- waitlist_join(source) as that user and signs out. No profile is made on the web: the birthday and About you
-- stay in the app, and the invite gate (INV-02) sends a waitlist account to Enter invite code until it has a
-- code or the founders admit it (admitted_at, INV-08).
--   * Rows from the old unverified form (0071) keep a null user_id; nothing is dropped or renamed.
--   * The 3-argument waitlist_join() and fn:waitlist-join stay in place, unused, until a later cleanup.

alter table public.waitlist
  add column user_id uuid unique references auth.users (id) on delete cascade,
  add column admitted_at timestamptz,
  add column notified_at timestamptz,
  add column joined_at timestamptz,
  alter column ip_hash drop not null;
comment on table public.waitlist is
  'Launch waitlist from pickld.me. New rows belong to a verified auth user (waitlist_join(source)); rows from the '
  'first form (0071) have only an email. No client grants.';
comment on column public.waitlist.admitted_at is 'Set by the founders (INV-08): the invite gate lets this account through.';
comment on column public.waitlist.notified_at is 'When the "You''re in" email went out (INV-08).';
comment on column public.waitlist.joined_at is 'When this account finished About you (set by the profile insert, INV-02).';

-- 'joined' for a new row, 'already' when the caller (or their email, from the first form) is on the list,
-- 'member' when the caller already has a profile (nothing is written). Refuses anon and unconfirmed emails.
create or replace function public.waitlist_join(p_source text default 'web')
returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  addr text;
  inserted boolean;
begin
  if uid is null then
    raise exception 'waitlist_join: sign in first' using errcode = '42501';
  end if;
  select email into addr from auth.users where id = uid and email_confirmed_at is not null and email is not null;
  if addr is null then
    raise exception 'waitlist_join: the email is not confirmed' using errcode = '42501';
  end if;
  if exists (select 1 from profiles where id = uid) then
    return 'member';
  end if;
  if exists (select 1 from waitlist where user_id = uid) then
    return 'already';
  end if;
  -- An email-only row from the first form becomes this account's row (and stays 'already').
  insert into waitlist (email, user_id, source)
  values (addr, uid, case when p_source ~ '^[a-z0-9-]{1,32}$' then p_source else 'web' end)
  on conflict (email) do update set user_id = excluded.user_id where waitlist.user_id is null
  returning (xmax = 0) into inserted;
  return case when inserted then 'joined' else 'already' end;
end $$;
comment on function public.waitlist_join(text) is
  'joined | already | member. The signed-in caller joins the waitlist with their confirmed auth email (INV-12).';
revoke execute on function public.waitlist_join(text) from public, anon;
grant execute on function public.waitlist_join(text) to authenticated;

-- For the app's Enter invite code screen: 'none', 'waiting' or 'admitted', for the caller only.
create or replace function public.my_waitlist_status()
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when admitted_at is null then 'waiting' else 'admitted' end from waitlist where user_id = auth.uid()),
    'none')
$$;
comment on function public.my_waitlist_status() is 'none | waiting | admitted, for the signed-in caller (INV-12).';
revoke execute on function public.my_waitlist_status() from public, anon;
grant execute on function public.my_waitlist_status() to authenticated;
