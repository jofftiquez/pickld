-- 0141 (INV-06, #377): when early access ends, for the Waiting screen's footnote ("…when early access ends on
-- Feb 14"). app_settings stays closed to clients (0131); this reads the one date it may show. Additive only.

create or replace function public.invite_period_ends_at() returns timestamptz
language sql stable security definer set search_path = public as $$
  select invite_period_ends_at from app_settings where id and invite_period_ends_at > now()
$$;
comment on function public.invite_period_ends_at() is
  'When the invite period ends, or null when there is none or it is over (INV-06). Anyone may ask.';
revoke execute on function public.invite_period_ends_at() from public;
grant execute on function public.invite_period_ends_at() to anon, authenticated, service_role;
