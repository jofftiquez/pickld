-- 0071: the launch waitlist behind pickld.me's "Join the waitlist" form (marketing site). Server only: the
-- web server posts to fn:waitlist-join with a shared secret, and the function calls waitlist_join() as the
-- service role. Clients can't read or write the list.
--   * One row per email (case-insensitive); joining again changes nothing.
--   * ip_hash is a keyed hash of the visitor's IP, computed in the Edge Function; the raw IP is never stored.
--     Each hash may add 5 emails an hour.
--   * 'waitlist' joins the reserved usernames: pickld.me/waitlist is the form's thank-you page.

create table public.waitlist (
  email citext primary key check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text not null default 'web' check (source ~ '^[a-z0-9-]{1,32}$'),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
comment on table public.waitlist is
  'Launch waitlist emails from pickld.me. Written only through waitlist_join() by fn:waitlist-join; no client grants.';
create index waitlist_ip_hash_created_at on public.waitlist (ip_hash, created_at);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from public, anon, authenticated;
grant select, insert, update, delete on public.waitlist to service_role;

-- 'joined' for a new email, 'already' when it is on the list, 'limited' when this IP hash added 5 emails in
-- the last hour. The function tells the visitor 'joined' for both of the first two.
create or replace function public.waitlist_join(p_email text, p_ip_hash text, p_source text default 'web')
returns text
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from waitlist where email = p_email::citext) then
    return 'already';
  end if;
  -- One caller at a time per IP hash, so parallel posts can't all slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended('waitlist:' || p_ip_hash, 0));
  if (select count(*) from waitlist where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= 5 then
    return 'limited';
  end if;
  insert into waitlist (email, ip_hash, source) values (p_email, p_ip_hash, p_source)
  on conflict (email) do nothing;
  return case when found then 'joined' else 'already' end;
end $$;

revoke execute on function public.waitlist_join(text, text, text) from public, anon, authenticated;
grant execute on function public.waitlist_join(text, text, text) to service_role;

insert into public.reserved_usernames (name) values ('waitlist') on conflict do nothing;
