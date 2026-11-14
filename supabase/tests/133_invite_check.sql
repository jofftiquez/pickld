-- INV-04 (0133): invite_check(), the anonymous look behind fn:invite. Only the server may call it; it answers
-- for codes and links without using them, says unavailable for every unusable case, and limits each IP hash.
begin;
\ir _helpers.psql
select plan(18);

select tests.world();
create function tests.code(p_owner text, p_slot slot) returns text language sql stable as $$
  select code from public.invite_codes where owner_id = tests.id(p_owner) and set_no = 1 and slot = p_slot
$$;
create function tests.check(p_token text, p_ip text default 'a') returns jsonb language sql as $$
  select public.invite_check(p_token, repeat(p_ip, 64))
$$;

-- ---------------------------------------------------------------- who may call it
select ok(not has_function_privilege('anon', 'public.invite_check(text, text)', 'execute')
          and not has_function_privilege('authenticated', 'public.invite_check(text, text)', 'execute'),
          'no client calls invite_check');
select ok(has_function_privilege('service_role', 'public.invite_check(text, text)', 'execute'),
          'fn:invite does, with the server credential');
select throws_ok($$select public.invite_check('ABCDEF', 'not-a-hash')$$, '22023', null, 'an IP hash is required');

-- ---------------------------------------------------------------- locked, then unlocked
select is(tests.check(tests.code('owner', 'whereami')) ->> 'result', 'unavailable', 'a locked code is unavailable');
select tests.make_moment(tests.make_jar('owner'), 'morning', 'live');

select is(tests.check(lower(tests.code('owner', 'whereami'))),
          jsonb_build_object('result', 'ok', 'kind', 'personal', 'inviter', jsonb_build_object(
            'id', tests.id('owner'), 'username', 't_owner', 'display_name', 'Owner', 'avatar_path', null)),
          'a personal code names its owner');
select is((select uses from public.invite_codes where code = tests.code('owner', 'whereami')), 0,
          'checking doesn''t use the code');
select is(tests.check((select link_id from public.invite_links where owner_id = tests.id('owner'))) -> 'inviter' ->> 'username',
          't_owner', 'so does the link');
select ok(not (tests.check(tests.code('owner', 'whereami')) ? 'left')
          and not (tests.check(tests.code('owner', 'whereami')) -> 'inviter' ? 'codes'),
          'nothing says how many codes are left');

-- ---------------------------------------------------------------- unavailable, one answer
update public.invite_codes set uses = 1 where code = tests.code('owner', 'mebusywith');
select is(tests.check(tests.code('owner', 'mebusywith')) ->> 'result', 'unavailable', 'a used code');
select is(tests.check('ZZZZZZ') ->> 'result', 'unavailable', 'an unknown code');
select is(tests.check('not a code') ->> 'result', 'unavailable', 'something that isn''t a code');
update public.invite_links set enabled = false where owner_id = tests.id('owner');
select is(tests.check((select link_id from public.invite_links where owner_id = tests.id('owner'))) ->> 'result',
          'unavailable', 'a switched-off link');
update public.invite_holders set frozen_at = now() where user_id = tests.id('owner');
select is(tests.check(tests.code('owner', 'ootd')) ->> 'result', 'unavailable', 'a frozen owner''s code');

-- ---------------------------------------------------------------- admin codes
insert into public.invite_codes (code, kind, max_uses, expires_at) values
  ('ADMN55', 'admin', 10, now() + interval '1 day'),
  ('ADMN66', 'admin', 10, now() - interval '1 day');
select is(tests.check('ADMN55', 'b'), '{"result": "ok", "kind": "admin", "inviter": null}'::jsonb,
          'an admin code names no inviter');
select is(tests.check('ADMN66', 'b') ->> 'result', 'unavailable', 'an expired one is unavailable');

-- ---------------------------------------------------------------- rate limit
select tests.check('ZZZZZZ', 'c') from generate_series(1, 20);
select is(tests.check('ADMN55', 'c') ->> 'result', 'limited', 'the 21st check from one IP in an hour is refused');
select is(tests.check('ADMN55', 'd') ->> 'result', 'ok', 'another IP is not');
update public.invite_attempts set created_at = now() - interval '61 minutes' where key = 'ip:' || repeat('c', 64);
select is(tests.check('ADMN55', 'c') ->> 'result', 'ok', 'and the limit lifts after an hour');

select * from finish();
rollback;
