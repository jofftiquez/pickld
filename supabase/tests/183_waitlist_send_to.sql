-- INV-09 (0183): codes for picked waitlist emails, as a founder, a moderator, a signed-in outsider and anon. Only
-- picked people who still need a code get one (not members, not admitted, not anyone already sent a working or used
-- code), any letter case, the same code again until it is sent, picking someone again after sending releases
-- nothing, a code that ran out unused is replaced, sending is marked and audited like a batch, and the console's
-- per-email code states.
begin;
\ir _helpers.psql
select plan(19);

select tests.create_user('founder', 'moderator');
select tests.create_user('moderator', 'moderator');
select tests.create_user('outsider');
select tests.create_user('member');
select tests.create_user('waiter');
update public.profiles set status = 'waiting' where id = tests.id('waiter');

insert into public.waitlist (email, user_id, created_at, admitted_at) values
  ('ana@tests.pickld.test', null, now() - interval '6 days', null),
  ('member@tests.pickld.test', tests.id('member'), now() - interval '5 days', null),
  ('admitted@tests.pickld.test', null, now() - interval '4 days', now()),
  ('waiter@tests.pickld.test', tests.id('waiter'), now() - interval '3 days', null),
  ('ben@tests.pickld.test', null, now() - interval '2 days', null),
  ('cara@tests.pickld.test', null, now() - interval '1 day', null);

-- Founders are moderators with app_metadata.founder = true (as in 143).
create function tests.act_as_founder(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', tests.id(p_name), 'role', 'authenticated', 'aud', 'authenticated',
    'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator', 'founder', true))::text, true);
end $$;

create table tests.released (batch int, email text, code text);
grant all on tests.released to authenticated;
create function tests.pick(p_batch int, p_emails text[]) returns text[] language plpgsql as $$
declare out text[];
begin
  perform tests.act_as_founder('founder');
  insert into tests.released select p_batch, r.email, r.code from public.waitlist_release_to(p_emails) r;
  perform tests.reset_role();
  select array_agg(email order by email) into out from tests.released where batch = p_batch;
  return out;
end $$;
create function tests.code_of(p_batch int, p_email text) returns text language sql as $$
  select code from tests.released where batch = p_batch and email = p_email || '@tests.pickld.test'
$$;
create function tests.mark(p_emails text[]) returns int language plpgsql as $$
declare n int;
begin
  perform tests.act_as_founder('founder');
  n := public.waitlist_mark_sent(p_emails);
  perform tests.reset_role();
  return n;
end $$;

-- ---------------------------------------------------------------- who may call
select ok(not has_function_privilege('anon', 'public.waitlist_release_to(text[])', 'execute')
          and not has_function_privilege('anon', 'public.mod_waitlist_invites(text[])', 'execute'),
          'anon cannot pick emails or see their code states');
select tests.act_as('moderator');
select throws_ok($$select * from public.waitlist_release_to(array['ana@tests.pickld.test'])$$, '42501', null,
                 'a moderator who isn''t a founder can''t release codes to picked emails');
select tests.act_as('outsider');
select throws_ok($$select * from public.waitlist_release_to(array['ana@tests.pickld.test'])$$, '42501', null,
                 'an outsider can''t release codes');
select throws_ok($$select * from public.mod_waitlist_invites(array['ana@tests.pickld.test'])$$, '42501', null,
                 'or see who was sent one');
select tests.act_as_founder('founder');
select throws_ok($$select * from public.waitlist_release_to(array[]::text[])$$, '22023', null, 'at least one email');
select throws_ok($$select * from public.waitlist_release_to(array_fill('a@b.c'::text, array[101]))$$, '22023', null,
                 'at most 100 at a time');
select tests.reset_role();

-- ---------------------------------------------------------------- picking
select is(tests.pick(1, array['CARA@tests.pickld.test', 'member@tests.pickld.test', 'admitted@tests.pickld.test',
                              'waiter@tests.pickld.test', 'nobody@tests.pickld.test']),
          array['cara@tests.pickld.test', 'waiter@tests.pickld.test'],
          'only picked people who need a code, any letter case; not the member, the admitted one or a stranger');
select ok((select bool_and(c.kind = 'waitlist' and c.max_uses = 1 and c.created_by = tests.id('founder'))
           from public.invite_codes c join tests.released r using (code) where r.batch = 1),
          'single-use waitlist codes made by the founder');
select is((select count(*)::int from public.waitlist where invite_code is not null), 2,
          'nobody else on the list was given a code');

select is(tests.pick(2, array['cara@tests.pickld.test']), array['cara@tests.pickld.test'],
          'picked again before the email went out: released again');
select is(tests.code_of(2, 'cara'), tests.code_of(1, 'cara'), 'with the same code, so a retry sends the same email');

-- ---------------------------------------------------------------- sending, and picking again
select is(tests.mark(array['cara@tests.pickld.test', 'waiter@tests.pickld.test']), 2, 'both are marked sent');
select is((select data from public.audit_log where action = 'waitlist_codes_sent' and actor_id = tests.id('founder')),
          '{"count": 2}'::jsonb,
          'one audit row with the count, as for a batch');
select is(tests.pick(3, array['cara@tests.pickld.test', 'waiter@tests.pickld.test']), null::text[],
          'picking people who were already sent a working code releases nothing');

select tests.act_as_founder('founder');
select is((select array_agg(email order by email) from public.waitlist_release(10)),
          array['ana@tests.pickld.test', 'ben@tests.pickld.test'], 'the next batch skips the people sent a picked code');
select tests.reset_role();

-- ---------------------------------------------------------------- used and expired codes
select tests.act_as('waiter');
select is(public.invite_redeem(tests.code_of(1, 'waiter')) ->> 'result', 'joined', 'the waiting account joins');
select tests.reset_role();
update public.invite_codes set expires_at = now() - interval '1 second' where code = tests.code_of(1, 'cara');

select tests.act_as('moderator');
select is((select array_agg(concat_ws(':', email, coalesce(code, '-'), invited_at is not null, can_send) order by email)
           from public.mod_waitlist_invites(array['ana@tests.pickld.test', 'cara@tests.pickld.test',
                                                  'WAITER@tests.pickld.test', 'member@tests.pickld.test',
                                                  'admitted@tests.pickld.test', 'nobody@tests.pickld.test'])),
          array['admitted@tests.pickld.test:-:f:f', 'ana@tests.pickld.test:-:f:t', 'cara@tests.pickld.test:expired:t:t',
                'member@tests.pickld.test:-:f:f', 'waiter@tests.pickld.test:used:t:f'],
          'moderators see who was sent a code, whether it was used or ran out, and who can be sent one now');
select tests.reset_role();

select is(tests.pick(4, array['cara@tests.pickld.test', 'waiter@tests.pickld.test']), array['cara@tests.pickld.test'],
          'a picked code that ran out unused is replaced; a used one is not');
select isnt(tests.code_of(4, 'cara'), tests.code_of(1, 'cara'), 'with a new code');

select * from finish();
rollback;
