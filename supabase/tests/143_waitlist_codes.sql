-- INV-09 (0143): waitlist codes, as a founder, a moderator, a signed-in outsider and anon. Earliest first, only
-- people who still need a code (not members, not admitted), the same code again until it is sent, sending marks a
-- row once and starts the code's 14 days, an audit row with a count only, the console counts, redeeming one, and
-- sending again after a code expired unused.
begin;
\ir _helpers.psql
select plan(27);

select tests.create_user('founder', 'moderator');
select tests.create_user('moderator', 'moderator');
select tests.create_user('outsider');
select tests.create_user('member');
select tests.create_user('waiter');
update public.profiles set status = 'waiting' where id = tests.id('waiter');

-- A verified auth user with no profile, as the pickld.me form makes them (as in 072).
create function tests.auth_only(p_name text) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
          p_name || '@tests.pickld.test', '', now(), '{"provider":"email"}', '{}', now(), now());
  insert into tests.users (name, id) values (p_name, uid);
  return uid;
end $$;
select tests.auth_only('verified');
select tests.auth_only('admitted');

-- Oldest first: an email-only row from the first form, a member, a verified account, an admitted one, a waiting
-- account, and the newest email-only row.
insert into public.waitlist (email, user_id, created_at, admitted_at) values
  ('first@tests.pickld.test', null, now() - interval '6 days', null),
  ('member@tests.pickld.test', tests.id('member'), now() - interval '5 days', null),
  ('verified@tests.pickld.test', tests.id('verified'), now() - interval '4 days', null),
  ('admitted@tests.pickld.test', tests.id('admitted'), now() - interval '3 days', now()),
  ('waiter@tests.pickld.test', tests.id('waiter'), now() - interval '2 days', null),
  ('last@tests.pickld.test', null, now() - interval '1 day', null);

-- Founders are moderators with app_metadata.founder = true (as in 131).
create function tests.act_as_founder(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', tests.id(p_name), 'role', 'authenticated', 'aud', 'authenticated',
    'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator', 'founder', true))::text, true);
end $$;

create table tests.released (batch int, email text, code text, expires_at timestamptz);
grant all on tests.released to authenticated;
create function tests.release(p_batch int, p_count int, p_resend boolean default false) returns void language plpgsql as $$
begin
  perform tests.act_as_founder('founder');
  insert into tests.released select p_batch, r.* from public.waitlist_release(p_count, p_resend) r;
  perform tests.reset_role();
end $$;
create function tests.emails(p_batch int) returns text[] language sql as $$
  select array_agg(email order by email) from tests.released where batch = p_batch
$$;
create function tests.code_of(p_batch int, p_email text) returns text language sql as $$
  select code from tests.released where batch = p_batch and email = p_email || '@tests.pickld.test'
$$;
create function tests.counts() returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  j := public.mod_waitlist_codes();
  perform tests.reset_role();
  return j;
end $$;

-- ---------------------------------------------------------------- who may call
select ok(not has_function_privilege('anon', 'public.waitlist_release(int, boolean)', 'execute')
          and not has_function_privilege('anon', 'public.waitlist_mark_sent(text[])', 'execute')
          and not has_function_privilege('anon', 'public.mod_waitlist_codes()', 'execute'),
          'anon cannot release, mark or count waitlist codes');
select ok(not has_function_privilege('authenticated', 'public.invite_founder()', 'execute'),
          'the founder check is internal');
select tests.act_as('moderator');
select throws_ok($$select * from public.waitlist_release(1)$$, '42501', null, 'a moderator who isn''t a founder can''t release codes');
select throws_ok($$select public.waitlist_mark_sent(array['first@tests.pickld.test'])$$, '42501', null, 'or mark them sent');
select tests.act_as('outsider');
select throws_ok($$select * from public.waitlist_release(1)$$, '42501', null, 'an outsider can''t release codes');
select throws_ok($$select public.mod_waitlist_codes()$$, '42501', null, 'or see the counts');
select tests.act_as_founder('founder');
select throws_ok($$select * from public.waitlist_release(0)$$, '22023', null, 'at least one code at a time');
select throws_ok($$select * from public.waitlist_release(501)$$, '22023', null, 'at most 500 at a time');
select tests.reset_role();

select is(tests.counts(), '{"ready": 4, "sent": 0, "used": 0, "expired": 0}'::jsonb,
          'four people need a code: not the member, not the admitted one');

-- ---------------------------------------------------------------- the first batch
select tests.release(1, 2);
select is(tests.emails(1), array['first@tests.pickld.test', 'verified@tests.pickld.test'],
          'the two earliest who need a code, skipping the member');
select ok((select bool_and(code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$') from tests.released where batch = 1),
          'each gets a 6-character code');
select is((select array_agg(distinct kind::text || '/' || max_uses) from public.invite_codes
           where code in (select code from tests.released where batch = 1)), array['waitlist/1'],
          'single-use waitlist codes');
select is((select count(*)::int from public.invite_codes c join tests.released r using (code)
           where r.batch = 1 and c.created_by = tests.id('founder')), 2, 'made by the founder who released them');

select tests.release(2, 2);
select is((select array_agg(email || code order by email) from tests.released where batch = 2),
          (select array_agg(email || code order by email) from tests.released where batch = 1),
          'released again before sending: the same people and the same codes');

-- ---------------------------------------------------------------- sending
update public.invite_codes set expires_at = now() + interval '1 day'
where code = tests.code_of(1, 'first');
select tests.act_as_founder('founder');
select is(public.waitlist_mark_sent(array['FIRST@tests.pickld.test', 'verified@tests.pickld.test', 'nobody@tests.pickld.test']),
          2, 'marking sent counts only waitlist rows with a code, any letter case');
select is(public.waitlist_mark_sent(array['member@tests.pickld.test']), 0, 'a row without a code is not marked');
select tests.reset_role();
select ok((select bool_and(invited_at is not null) from public.waitlist
           where email in ('first@tests.pickld.test', 'verified@tests.pickld.test')), 'both rows record invited_at');
select ok((select expires_at > now() + interval '13 days' from public.invite_codes where code = tests.code_of(1, 'first')),
          'sending starts the code''s 14 days');
select is((select data from public.audit_log where action = 'waitlist_codes_sent'), '{"count": 2}'::jsonb,
          'one audit row with the count and no emails or codes');

select tests.release(3, 10);
select is(tests.emails(3), array['last@tests.pickld.test', 'waiter@tests.pickld.test'],
          'the next release skips sent rows and the admitted account');
select tests.act_as_founder('founder');
select is(public.waitlist_mark_sent(tests.emails(3)), 2, 'the second batch is sent');
select tests.reset_role();

-- ---------------------------------------------------------------- redeeming and expiry
select tests.act_as('waiter');
select is(public.invite_redeem(tests.code_of(3, 'waiter')) ->> 'result', 'joined', 'the waiting account joins with its code');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('waiter')), 'active', 'and is let in');

update public.invite_codes set expires_at = now() - interval '1 second' where code = tests.code_of(1, 'first');
select is(tests.counts(), '{"ready": 0, "sent": 4, "used": 1, "expired": 1}'::jsonb,
          'four sent, one used, one expired unused');

select tests.release(4, 10);
select is(tests.emails(4), null::text[], 'without resend_expired nobody is released again');
select tests.release(5, 10, true);
select is(tests.emails(5), array['first@tests.pickld.test'], 'with resend_expired only the expired, unused code goes again');
select isnt(tests.code_of(5, 'first'), tests.code_of(1, 'first'), 'with a new code');

select * from finish();
rollback;
