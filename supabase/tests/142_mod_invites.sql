-- INV-10 (0142): the console's invite tools, as a moderator, a founder, a signed-in outsider and anon. Making
-- admin codes (note, uses, end date, audit row), switching them off and on, their states, the summary numbers,
-- a person's invites as moderators see them, and that a plain moderator still can't let people in.
begin;
\ir _helpers.psql
select plan(46);

select tests.create_user('moderator', 'moderator');
select tests.create_user('founder', 'moderator');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"founder": true}' where id = tests.id('founder');
select tests.create_user('outsider');
select tests.create_user('owner');
select tests.create_user('friend');
select tests.create_user('guest');

create table tests.made (k text primary key, code text);
grant all on tests.made to authenticated;
-- The owner's first personal code (a new profile gets one set, 0132).
insert into tests.made select 'owner1', code from public.invite_codes
where owner_id = tests.id('owner') and kind = 'personal' order by set_no, slot limit 1;

-- The admin code under p_key in mod_invite_codes(), as the moderator.
create function tests.listed(p_key text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  select e into j from jsonb_array_elements(public.mod_invite_codes()) e
  where e ->> 'code' = (select code from tests.made where k = p_key);
  perform tests.reset_role();
  return j;
end $$;

create function tests.summary() returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  j := public.mod_invite_summary();
  perform tests.reset_role();
  return j;
end $$;

create function tests.user_invites(p_user uuid) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  j := public.mod_user_invites(p_user);
  perform tests.reset_role();
  return j;
end $$;

create function tests.personal_listed() returns int language plpgsql as $$
declare
  personal text[] := array(select code from public.invite_codes where kind = 'personal');
  n int;
begin
  perform tests.act_as('moderator');
  select count(*) into n from jsonb_array_elements(public.mod_invite_codes()) e where e ->> 'code' = any(personal);
  perform tests.reset_role();
  return n;
end $$;

-- Founders are moderators with app_metadata.founder = true (as in 131).
create function tests.act_as_founder(p_name text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', tests.id(p_name), 'role', 'authenticated', 'aud', 'authenticated',
    'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator', 'founder', true))::text, true);
end $$;

-- p_invitee joins with p_code (as redeeming does, without its follows and checks).
create function tests.joined(p_invitee text, p_code text) returns void language sql as $$
  update public.invite_codes set uses = uses + 1 where code = p_code;
  insert into public.invite_redemptions (code, invitee_id) values (p_code, tests.id(p_invitee));
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------- who may call
select ok(not has_function_privilege('anon', 'public.mod_invite_codes()', 'execute')
          and not has_function_privilege('anon', 'public.mod_invite_code_create(text, int, timestamptz)', 'execute')
          and not has_function_privilege('anon', 'public.mod_invite_code_set(text, boolean)', 'execute')
          and not has_function_privilege('anon', 'public.mod_invite_summary()', 'execute')
          and not has_function_privilege('anon', 'public.mod_user_invites(uuid)', 'execute'),
          'anon can call none of the console invite functions');

select tests.act_as('outsider');
select throws_ok($$select public.mod_invite_codes()$$, '42501', null, 'only moderators list admin codes');
select throws_ok($$select public.mod_invite_code_create('Party', 5)$$, '42501', null, 'only moderators make codes');
select throws_ok($$select public.mod_invite_code_set('ABCDEF', false)$$, '42501', null,
                 'only moderators switch codes off');
select throws_ok($$select public.mod_invite_summary()$$, '42501', null, 'only moderators see the summary');
select throws_ok($$select public.mod_user_invites(tests.id('owner'))$$, '42501', null,
                 'only moderators see a person''s invites');
select tests.reset_role();

-- A moderator without an app profile can read (the console's person page) but not write (no audit actor).
select set_config('role', 'authenticated', true), set_config('request.jwt.claims', jsonb_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'aud', 'authenticated',
  'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator'))::text, true);
select lives_ok($$select public.mod_user_invites(tests.id('owner'))$$,
                'a moderator without a profile sees a person''s invites');
select lives_ok($$select public.mod_invite_codes(), public.mod_invite_summary()$$,
                'a moderator without a profile sees the codes and the summary');
select throws_ok($$select public.mod_invite_code_create('Party', 5)$$, '42501', null,
                 'a moderator without a profile can''t make a code');
select tests.reset_role();

-- ---------------------------------------------------------------- making a code
select tests.act_as('moderator');
select throws_ok($$select public.mod_invite_code_create('  ', 5)$$, '22023', null, 'a code needs a note');
select throws_ok($$select public.mod_invite_code_create(repeat('x', 201), 5)$$, '22023', null,
                 'a note is at most 200 characters');
select throws_ok($$select public.mod_invite_code_create('Party', 0)$$, '22023', null, 'a code has at least one use');
select throws_ok($$select public.mod_invite_code_create('Party', 10001)$$, '22023', null,
                 'a code has at most 10000 uses');
select throws_ok($$select public.mod_invite_code_create('Party', 5, now() - interval '1 minute')$$, '22023', null,
                 'the end date must be in the future');
insert into tests.made
select 'coffee', public.mod_invite_code_create(' Coffee meetup ', 2, '2099-12-01 00:00+00') ->> 'code';
select tests.reset_role();

select matches((select code from tests.made where k = 'coffee'), '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$',
               'a moderator makes a 6-character code');
select is((select row(kind, note, max_uses, uses, expires_at, created_by)::text from public.invite_codes
           where code = (select code from tests.made where k = 'coffee')),
          row('admin'::invite_kind, 'Coffee meetup', 2, 0, '2099-12-01 00:00+00'::timestamptz,
              tests.id('moderator'))::text,
          'an admin code with the trimmed note, its uses and end date');
select is((select count(*)::int from public.audit_log where action = 'invite_code_create'
           and actor_id = tests.id('moderator') and data ->> 'code' = (select code from tests.made where k = 'coffee')
           and data ->> 'note' = 'Coffee meetup' and (data ->> 'uses')::int = 2), 1, 'with an audit row');

select tests.act_as_founder('founder');
insert into tests.made select 'press', public.mod_invite_code_create('Press', 1) ->> 'code';
select tests.reset_role();
select is((select expires_at from public.invite_codes where code = (select code from tests.made where k = 'press')),
          null, 'the end date is optional');

-- ---------------------------------------------------------------- the list
select is(tests.listed('coffee') - 'code' - 'created_at',
          jsonb_build_object('note', 'Coffee meetup', 'uses', 0, 'max_uses', 2,
                             'expires_at', '2099-12-01 00:00+00'::timestamptz, 'state', 'on',
                             'made_by', jsonb_build_object('username', 't_moderator', 'display_name', 'Moderator',
                                                           'founder', false)),
          'the list shows note, uses, end date, state and maker');
select is(tests.listed('press') #> '{made_by,founder}', 'true'::jsonb, 'and whether the maker is a founder');
select is(tests.personal_listed(), 0, 'personal codes are not listed');

-- ---------------------------------------------------------------- off and on
select tests.act_as('moderator');
select is(public.mod_invite_code_set(lower(' ' || (select code from tests.made where k = 'coffee') || ' '), false),
          '{"result": "off"}'::jsonb, 'a moderator switches a code off (case and spaces don''t matter)');
select is(public.mod_invite_code_set((select code from tests.made where k = 'coffee'), false),
          '{"result": "unchanged"}'::jsonb, 'switching it off again changes nothing');
select tests.reset_role();
select is(tests.listed('coffee') ->> 'state', 'off', 'the list says off');
select is((select count(*)::int from public.invite_usable_code((select code from tests.made where k = 'coffee'))), 0,
          'a switched-off code can''t be used');
select is((select count(*)::int from public.audit_log where action = 'invite_code_off'
           and data ->> 'code' = (select code from tests.made where k = 'coffee')), 1,
          'switching off writes one audit row');

select tests.act_as('moderator');
select is(public.mod_invite_code_set((select code from tests.made where k = 'coffee'), true),
          '{"result": "on"}'::jsonb, 'and back on');
select is(public.mod_invite_code_set('ZZZZZZ', false), '{"result": "not_found"}'::jsonb, 'an unknown code');
select is(public.mod_invite_code_set((select code from tests.made where k = 'owner1'), false),
          '{"result": "not_found"}'::jsonb, 'personal codes are not switched here');
select throws_ok($$select public.mod_invite_code_set('ABCDEF', null)$$, '22023', null, 'on or off must be given');
select tests.reset_role();
select is((select count(*)::int from public.invite_usable_code((select code from tests.made where k = 'coffee'))), 1,
          'switched on, it can be used again');
select is((select count(*)::int from public.audit_log where action = 'invite_code_on'
           and actor_id = tests.id('moderator')), 1, 'switching on writes an audit row');

update public.invite_codes set uses = max_uses where code = (select code from tests.made where k = 'press');
select is(tests.listed('press') ->> 'state', 'used_up', 'a code with no uses left is used up');
update public.invite_codes set expires_at = now() - interval '1 day'
where code = (select code from tests.made where k = 'press');
select is(tests.listed('press') ->> 'state', 'used_up', 'used up wins over ended');
update public.invite_codes set uses = 0 where code = (select code from tests.made where k = 'press');
select is(tests.listed('press') ->> 'state', 'ended', 'a code past its end date has ended');

-- ---------------------------------------------------------------- summary
create table tests.before as select tests.summary() as j;
update public.profiles set status = 'waiting' where id in (tests.id('friend'), tests.id('guest'));
select is((tests.summary() ->> 'waiting')::int - ((select j from tests.before) ->> 'waiting')::int, 2,
          'the summary counts waiting accounts');

select tests.joined('guest', (select code from tests.made where k = 'coffee'));
select tests.joined('friend', (select code from tests.made where k = 'owner1'));
select is((tests.summary() ->> 'joined_with_codes')::int
          - ((select j from tests.before) ->> 'joined_with_codes')::int, 1,
          'joined with these counts admin codes only');

update public.app_settings set invite_period_ends_at = '2099-02-14 00:00+00';
select is((tests.summary() ->> 'ends_at')::timestamptz, '2099-02-14 00:00+00'::timestamptz,
          'and says when early access ends');

-- ---------------------------------------------------------------- a person's invites
select is(tests.user_invites(tests.id('owner')) - 'invitees' - 'link_enabled',
          jsonb_build_object('has_codes', true, 'unlocked', false, 'frozen', null, 'sets', 1, 'codes', 8, 'used', 1,
                             'invited_by', null),
          'the owner''s codes: one set of 8, one used, locked until a live moment');
select is((tests.user_invites(tests.id('owner')) -> 'invitees' -> 0) - 'joined_at' - 'id',
          '{"username": "t_friend", "status": "waiting", "via_link": false}'::jsonb, 'and who joined with them');
select is(tests.user_invites(tests.id('friend')) #>> '{invited_by,inviter,username}', 't_owner',
          'the friend was invited by the owner');
select is((tests.user_invites(tests.id('guest')) -> 'invited_by') - 'code' - 'joined_at',
          '{"kind": "admin", "note": "Coffee meetup", "via_link": false, "inviter": null}'::jsonb,
          'the guest joined with an admin code, shown with its note');

select tests.act_as('moderator');
select is(public.invite_freeze(tests.id('owner'), 'invited a spam ring') ->> 'result', 'frozen', 'paused');
select tests.reset_role();
select is((tests.user_invites(tests.id('owner')) -> 'frozen') - 'at',
          '{"note": "invited a spam ring", "by": "t_moderator"}'::jsonb, 'a paused person shows the note and who');
select is(tests.user_invites(gen_random_uuid()), null, 'nobody: null');

-- ---------------------------------------------------------------- letting people in
select tests.act_as('moderator');
select throws_ok($$select public.admit_waiting(1)$$, '42501', null, 'a moderator who isn''t a founder can''t let people in');
select tests.reset_role();

select * from finish();
rollback;
