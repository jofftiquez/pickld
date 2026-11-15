-- 0143 (INV-09, #380): invite codes for the email waitlist, earliest first, sent by fn:waitlist-send. Additive:
-- two columns on waitlist and four functions; nothing is dropped or renamed.
--
--   waitlist_release(count, resend_expired)  founders: the earliest people who still need a code, each with a
--                                             single-use waitlist code (email and code, for fn:waitlist-send)
--   waitlist_mark_sent(emails)                founders: records that the email went out and starts the code's 14 days
--   mod_waitlist_codes()                      moderators: ready to send, sent, used and expired counts
--   invite_founder()                          the shared founder check (a moderator with founder: true and a profile)
--
-- Someone needs a code when they aren't admitted, have no profile or a waiting one, and were never sent one, or
-- (with resend_expired) their code expired unused. A code made but never sent is handed out again by the next
-- release, so a failed send is simply tried again. Who used a code shows on the code itself (uses); joined_at
-- keeps its meaning from 0131 (the account finished About you). The founders call these through the console with
-- their own JWT, so every batch has an actor; audit rows keep counts only, never emails or codes.

alter table public.waitlist
  add column invite_code text unique references public.invite_codes (code) on delete set null,
  add column invited_at timestamptz;
comment on column public.waitlist.invite_code is 'The waitlist invite code made for this email (INV-09).';
comment on column public.waitlist.invited_at is 'When the email with invite_code last went out (INV-09).';
create index waitlist_unsent_idx on public.waitlist (created_at, email) where invited_at is null;

create or replace function public.invite_founder() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  actor uuid := (claims ->> 'sub')::uuid;
begin
  if actor is null
     or coalesce(claims -> 'app_metadata' ->> 'role', '') <> 'moderator'
     or coalesce(claims -> 'app_metadata' ->> 'founder', '') <> 'true' then
    raise exception 'founders only' using errcode = '42501';
  end if;
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the founder has no profile' using errcode = '42501';
  end if;
  return actor;
end $$;
revoke execute on function public.invite_founder() from public, anon, authenticated;

-- One row per person to email, earliest on the waitlist first. expires_at is the code's end if it were sent now.
create or replace function public.waitlist_release(p_count int, p_resend_expired boolean default false)
returns table (email text, code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  actor uuid := invite_founder();
  r record;
  c text;
begin
  if p_count is null or p_count < 1 or p_count > 500 then
    raise exception 'send 1 to 500 codes at a time' using errcode = '22023';
  end if;
  for r in
    select w.email::text as addr, w.invite_code as old_code, w.invited_at as sent_at,
           ic.uses as old_uses, ic.expires_at as old_end
    from waitlist w
    left join profiles p on p.id = w.user_id
    left join invite_codes ic on ic.code = w.invite_code
    where w.admitted_at is null
      and (p.id is null or p.status = 'waiting')
      and (w.invited_at is null
           or (coalesce(p_resend_expired, false) and ic.uses = 0 and ic.expires_at <= now()))
    order by w.created_at, w.email
    limit p_count
    for update of w skip locked
  loop
    if r.sent_at is null and r.old_uses = 0 and r.old_end > now() then
      c := r.old_code; -- made by an earlier release that was never sent: the same code again
    else
      loop
        c := invite_token(6);
        begin
          insert into invite_codes (code, kind, expires_at, created_by)
          values (c, 'waitlist', now() + interval '14 days', actor);
          exit;
        exception when unique_violation then
          null; -- the code is taken: draw again
        end;
      end loop;
      update waitlist set invite_code = c where waitlist.email = r.addr::citext;
    end if;
    email := r.addr;
    code := c;
    expires_at := now() + interval '14 days';
    return next;
  end loop;
end $$;
comment on function public.waitlist_release(int, boolean) is
  'Founders: email and a single-use waitlist code for the earliest p_count people who still need one (INV-09).';
revoke execute on function public.waitlist_release(int, boolean) from public, anon;
grant execute on function public.waitlist_release(int, boolean) to authenticated;

-- After fn:waitlist-send's email went out: invited_at, and the code's 14 days start now. Returns how many rows.
create or replace function public.waitlist_mark_sent(p_emails text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := invite_founder();
  n int;
begin
  if p_emails is null or cardinality(p_emails) > 500 then
    raise exception 'mark 0 to 500 emails at a time' using errcode = '22023';
  end if;
  with sent as (
    update waitlist w set invited_at = now()
    from invite_codes ic
    where ic.code = w.invite_code and ic.uses = 0 and w.email = any(p_emails::citext[])
    returning w.invite_code
  )
  update invite_codes ic set expires_at = now() + interval '14 days' from sent where ic.code = sent.invite_code;
  get diagnostics n = row_count;
  if n > 0 then
    insert into audit_log (actor_id, action, data) values (actor, 'waitlist_codes_sent', jsonb_build_object('count', n));
  end if;
  return n;
end $$;
comment on function public.waitlist_mark_sent(text[]) is
  'Founders: marks these waitlist emails as sent and starts each code''s 14 days (INV-09). Returns the count.';
revoke execute on function public.waitlist_mark_sent(text[]) from public, anon;
grant execute on function public.waitlist_mark_sent(text[]) to authenticated;

-- For the console's Waitlist page. ready: would get a code from the next release; sent: emailed a code; used:
-- their code was used; expired: their code ran out unused and they still need one (resend_expired sends again).
create or replace function public.mod_waitlist_codes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return (
    with w as (
      select w.invited_at, ic.uses, ic.expires_at,
             w.admitted_at is null and (p.id is null or p.status = 'waiting') as needs
      from waitlist w
      left join profiles p on p.id = w.user_id
      left join invite_codes ic on ic.code = w.invite_code
    )
    select jsonb_build_object(
      'ready', count(*) filter (where needs and invited_at is null),
      'sent', count(*) filter (where invited_at is not null),
      'used', count(*) filter (where invited_at is not null and uses > 0),
      'expired', count(*) filter (where needs and invited_at is not null and uses = 0 and expires_at <= now()))
    from w);
end $$;
comment on function public.mod_waitlist_codes() is 'Moderators: waitlist codes ready, sent, used and expired (INV-09).';
revoke execute on function public.mod_waitlist_codes() from public, anon;
grant execute on function public.mod_waitlist_codes() to authenticated;
