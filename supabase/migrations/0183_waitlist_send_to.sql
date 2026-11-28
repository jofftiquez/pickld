-- 0183 (INV-09): founders send codes to people they pick on the console's Waitlist page, not only the earliest N.
-- Additive: two functions; nothing is dropped, renamed or rewritten.
--
--   waitlist_release_to(emails)   founders: a code for each picked email that still needs one, for fn:waitlist-send
--   mod_waitlist_invites(emails)  moderators: whether each email was sent a code, whether it was used or ran out,
--                                 and whether waitlist_release_to() would give it one now
--
-- A picked email gets a code under the same rules as waitlist_release() (0143): on the waitlist, not admitted, no
-- profile or a waiting one, and never sent a code, or sent one that ran out unused. Picking someone is explicit, so
-- a code that ran out is replaced without the resend_expired flag. Anyone who was already sent a code that still
-- works, or used it, is left out, so picking them again sends nothing. fn:waitlist-send then emails the codes and
-- calls waitlist_mark_sent() exactly as for a batch, so the counts and the audit row are the same.

create or replace function public.waitlist_release_to(p_emails text[])
returns table (email text, code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  actor uuid := invite_founder();
  r record;
  c text;
begin
  if p_emails is null or cardinality(p_emails) < 1 or cardinality(p_emails) > 100 then
    raise exception 'pick 1 to 100 emails at a time' using errcode = '22023';
  end if;
  for r in
    select w.email::text as addr, w.invite_code as old_code, w.invited_at as sent_at,
           ic.uses as old_uses, ic.expires_at as old_end
    from waitlist w
    left join profiles p on p.id = w.user_id
    left join invite_codes ic on ic.code = w.invite_code
    where w.email = any(p_emails::citext[])
      and w.admitted_at is null
      and (p.id is null or p.status = 'waiting')
      and (w.invited_at is null or (ic.uses = 0 and ic.expires_at <= now()))
    order by w.created_at, w.email
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
comment on function public.waitlist_release_to(text[]) is
  'Founders: email and a single-use waitlist code for each of these emails that still needs one (INV-09).';
revoke execute on function public.waitlist_release_to(text[]) from public, anon;
grant execute on function public.waitlist_release_to(text[]) to authenticated;

-- For the console's email list: one row per email on the waitlist. code: null (never sent), sent (still works),
-- used, or expired (ran out unused). can_send: waitlist_release_to() would give this email a code now.
create or replace function public.mod_waitlist_invites(p_emails text[])
returns table (email text, invited_at timestamptz, code text, can_send boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform mod_require_moderator();
  if p_emails is null or cardinality(p_emails) > 500 then
    raise exception 'look up 0 to 500 emails at a time' using errcode = '22023';
  end if;
  return query
    select w.email::text, w.invited_at,
           case when w.invited_at is null then null
                when ic.uses > 0 then 'used' when ic.expires_at <= now() then 'expired' else 'sent' end,
           w.admitted_at is null and (p.id is null or p.status = 'waiting')
             and (w.invited_at is null or (ic.uses = 0 and ic.expires_at <= now()))
    from waitlist w
    left join profiles p on p.id = w.user_id
    left join invite_codes ic on ic.code = w.invite_code
    where w.email = any(p_emails::citext[]);
end $$;
comment on function public.mod_waitlist_invites(text[]) is
  'Moderators: when each of these waitlist emails was sent a code, and whether it was used or ran out (INV-09).';
revoke execute on function public.mod_waitlist_invites(text[]) from public, anon;
grant execute on function public.mod_waitlist_invites(text[]) to authenticated;
