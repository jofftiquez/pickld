-- INV-03 (0132): invite codes, the personal link and redeeming a code, as owner, waiting accounts, a teen,
-- an outsider, a blocked invitee and a moderator. Every unavailable case, single use, the link's next-code
-- rule, switch and reset, follows by age, unlock, sets, the rate limit, freezes and my_invites() privacy.
begin;
\ir _helpers.psql
select plan(76);

select tests.world();
select tests.create_user('owner2');
select tests.create_user('owner3');
select tests.create_user('owner4');
select tests.create_user('veteran');
-- Everyone so far has been on Pickld for a while (redeem treats accounts under a day old as just signed up).
update public.profiles set created_at = now() - interval '30 days';

-- A waiting account (INV-02), adult unless a birthday is given.
create function tests.waiter(p_name text, p_birthday date default date '1995-05-05') returns uuid
language plpgsql as $$
declare uid uuid := tests.create_user(p_name);
begin
  update public.profiles set status = 'waiting', birthday = p_birthday where id = uid;
  return uid;
end $$;

-- A personal code and a link id, read as the superuser (arguments are evaluated before tests.redeem switches role).
create function tests.code(p_owner text, p_slot slot, p_set int default 1) returns text language sql stable as $$
  select code from public.invite_codes where owner_id = tests.id(p_owner) and set_no = p_set and slot = p_slot
$$;
create function tests.link(p_owner text) returns text language sql stable as $$
  select link_id from public.invite_links where owner_id = tests.id(p_owner)
$$;

-- Redeems as p_as and returns the result; the whole answer is kept under p_key.
create table tests.results (k text primary key, j jsonb);
create function tests.redeem(p_as text, p_token text, p_key text default null) returns text
language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as(p_as);
  j := public.invite_redeem(p_token);
  perform tests.reset_role();
  if p_key is not null then
    insert into tests.results values (p_key, j);
  end if;
  return j ->> 'result';
end $$;

create function tests.invites(p_as text) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as(p_as);
  j := public.my_invites();
  perform tests.reset_role();
  return j;
end $$;

create function tests.card(p_as text, p_slot slot, p_set int default 1) returns jsonb language sql as $$
  select e from jsonb_array_elements(tests.invites(p_as) -> 'codes') e
  where e ->> 'slot' = p_slot::text and (e ->> 'set_no')::int = p_set
$$;

-- A live moment, which unlocks the owner's invites.
create function tests.unlock(p_owner text) returns void language plpgsql as $$
begin
  perform tests.make_moment(tests.make_jar(p_owner), 'morning', 'live');
end $$;

create function tests.follows(a text, b text) returns int language sql stable as $$
  select count(*)::int from public.follows
  where (reader_id = tests.id(a) and author_id = tests.id(b)) or (reader_id = tests.id(b) and author_id = tests.id(a))
$$;

create table tests.saved (k text primary key, v text);

-- ---------------------------------------------------------------- privileges
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
            'public.invite_codes'::regclass, 'public.invite_links'::regclass, 'public.invite_holders'::regclass,
            'public.invite_redemptions'::regclass, 'public.invite_attempts'::regclass)),
          'RLS is on every invite table');
select ok(not exists (
            select 1 from unnest(array['public.invite_codes', 'public.invite_links', 'public.invite_holders',
                                       'public.invite_redemptions', 'public.invite_attempts']) t,
                          unnest(array['anon', 'authenticated']) r,
                          unnest(array['select', 'insert', 'update', 'delete']) p
            where has_table_privilege(r, t, p)),
          'clients can neither read nor write any invite table');
select ok(not has_function_privilege('anon', 'public.invite_redeem(text)', 'execute')
          and not has_function_privilege('anon', 'public.my_invites()', 'execute')
          and has_function_privilege('authenticated', 'public.invite_redeem(text)', 'execute'),
          'only signed-in people redeem or see their invites');
select ok(not has_function_privilege('authenticated', 'public.invite_usable_code(text, boolean)', 'execute')
          and not has_function_privilege('service_role', 'public.invite_usable_code(text, boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.invite_setup(uuid, int, boolean)', 'execute')
          and not has_function_privilege('authenticated', 'public.invite_add_set(uuid, int)', 'execute'),
          'the code-making and lookup steps are internal');
select is((select count(*)::int from public.reserved_usernames where name in ('i', 'invite')), 2,
          'i and invite are reserved usernames');

-- ---------------------------------------------------------------- a new profile's codes and link
select is((select count(*)::int from public.invite_codes where owner_id = tests.id('owner') and kind = 'personal' and set_no = 1),
          8, 'a new profile gets one set of 8 codes');
select is((select count(distinct slot)::int from public.invite_codes where owner_id = tests.id('owner')), 8,
          'one code per moment slot');
select is((select count(*)::int from public.invite_codes where code !~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'), 0,
          'every code is 6 characters from the unambiguous alphabet');
select ok((select enabled and link_id ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$'
           from public.invite_links where owner_id = tests.id('owner')),
          'and a 10-character link, switched on');
select ok((select unlocked_at is null from public.invite_holders where user_id = tests.id('owner')),
          'a new profile''s invites start locked');

-- What the migration gives accounts that already existed.
delete from public.invite_codes where owner_id = tests.id('veteran');
delete from public.invite_links where owner_id = tests.id('veteran');
delete from public.invite_holders where user_id = tests.id('veteran');
select public.invite_setup(tests.id('veteran'), 2, true);
select is((select count(*)::int from public.invite_codes where owner_id = tests.id('veteran')), 16,
          'an existing account gets 16 codes, two sets of 8');
select ok((select unlocked_at is not null from public.invite_holders where user_id = tests.id('veteran')),
          'unlocked at once');

-- ---------------------------------------------------------------- locked until the first live moment
select tests.waiter('w1');
select is(tests.redeem('w1', tests.code('owner', 'whereami')), 'unavailable', 'a locked code can''t be used');
select is(tests.redeem('w1', tests.link('owner')), 'unavailable', 'nor a locked link');

select tests.make_moment(tests.make_jar('owner'), 'morning', 'checking');
select ok((select unlocked_at is null from public.invite_holders where user_id = tests.id('owner')),
          'a moment still being checked doesn''t unlock');
select tests.set_status((select id from public.moments where user_id = tests.id('owner')), 'live');
select ok((select unlocked_at is not null from public.invite_holders where user_id = tests.id('owner')),
          'the first live moment unlocks the invites');

select is((tests.invites('owner') ->> 'unlocked')::boolean, true, 'my_invites: unlocked');
select is(jsonb_array_length(tests.invites('owner') -> 'codes'), 8, 'my_invites: the 8 codes');
select is(tests.invites('owner') -> 'link', jsonb_build_object('id', tests.link('owner'), 'enabled', true),
          'my_invites: the link');

-- ---------------------------------------------------------------- a personal code
select is(tests.redeem('w1', ' ' || lower(tests.code('owner', 'whereami')) || ' ', 'w1'), 'joined',
          'a waiting adult joins with a code (case and spaces don''t matter)');
select is((select j - 'result' from tests.results where k = 'w1'),
          jsonb_build_object('kind', 'personal', 'inviter', 't_owner'), 'the answer names the inviter');
select is((select status::text from public.profiles where id = tests.id('w1')), 'active', 'the invitee is let in');
select is(tests.follows('w1', 'owner'), 2, 'inviter and adult invitee read each other');
select is((select count(*)::int from public.notifications where type = 'new_reader'
           and user_id in (tests.id('w1'), tests.id('owner')) and actor_id in (tests.id('w1'), tests.id('owner'))),
          0, 'the invite follows send no new-reader notification');
select is((select uses from public.invite_codes where code = tests.code('owner', 'whereami')), 1, 'the code is used');

select tests.waiter('w2');
select is(tests.redeem('w2', tests.code('owner', 'whereami')), 'unavailable', 'a used code never works again');

select is(tests.card('owner', 'whereami') -> 'invitee' -> 'profile' ->> 'username', 't_w1',
          'my_invites shows who joined with the code');

-- ---------------------------------------------------------------- the link and a teen
select tests.waiter('teen', (current_date - interval '15 years')::date);
select is(tests.redeem('teen', tests.link('owner')), 'joined', 'a waiting teen joins with the link');
select ok(exists (select 1 from public.follows where reader_id = tests.id('teen') and author_id = tests.id('owner'))
          and tests.follows('teen', 'owner') = 1, 'a 13 to 17 invitee only reads the inviter');
select is((select c.slot::text from public.invite_redemptions r join public.invite_codes c on c.code = r.code
           where r.invitee_id = tests.id('teen') and r.via_link), 'mebusywith',
          'the link took the next unused code in slot order');

update public.invite_codes set uses = 1 where owner_id = tests.id('owner');
select tests.waiter('w3');
select is(tests.redeem('w3', tests.link('owner')), 'unavailable', 'a link with no codes left can''t be used');

-- ---------------------------------------------------------------- another set
select tests.act_as('outsider');
select throws_ok($$select public.invite_grant_set(tests.id('owner'))$$, '42501', null,
                 'only moderators give out more codes');
select tests.act_as('moderator');
select is(public.invite_grant_set(tests.id('owner')), '{"result": "granted", "set_no": 2}'::jsonb,
          'a moderator gives the owner a second set');
select tests.reset_role();
select is((select count(*)::int from public.audit_log where action = 'invite_grant_set'
           and target_id = tests.id('owner') and actor_id = tests.id('moderator')), 1, 'with an audit row');
select is(tests.redeem('w3', tests.link('owner')), 'joined', 'the link works again');
select is((select c.set_no::text || ':' || c.slot from public.invite_redemptions r
           join public.invite_codes c on c.code = r.code where r.invitee_id = tests.id('w3')), '2:whereami',
          'starting at the new set''s first slot');

-- ---------------------------------------------------------------- switch and reset
select tests.waiter('w4');
select tests.act_as('owner');
select is(public.invite_link_set(false), true, 'the owner switches the link off');
select tests.reset_role();
select is(tests.redeem('w4', tests.link('owner')), 'unavailable', 'a switched-off link can''t be used');
insert into tests.saved values ('link', tests.link('owner'));
select tests.act_as('owner');
select public.invite_link_set(true);
select public.invite_link_reset();
select tests.reset_role();
select isnt(tests.link('owner'), (select v from tests.saved where k = 'link'), 'reset gives a new link id');
select is(tests.redeem('w4', (select v from tests.saved where k = 'link')), 'unavailable', 'the old link stops working');
select is(tests.redeem('w4', tests.link('owner')), 'joined', 'the new link works');

-- ---------------------------------------------------------------- members
select is(tests.redeem('outsider', tests.code('owner', 'ootd', 2)), 'already_member',
          'an established member uses no code');
select is(tests.redeem('w1', tests.code('owner', 'ootd', 2)), 'already_member',
          'nor someone who already joined with one');
select tests.create_user('fresh');
select is(tests.redeem('fresh', tests.code('owner', 'ootd', 2)), 'joined',
          'an account that signed up today (after the invite period) can still use a code');
select is(tests.follows('fresh', 'owner'), 2, 'and becomes a reader both ways');

-- ---------------------------------------------------------------- unavailable, admin and waitlist codes
select tests.waiter('w5');
select is(tests.redeem('w5', 'ZZZZZZ'), 'unavailable', 'an unknown code');
select is(tests.redeem('w5', 'hello!'), 'unavailable', 'something that isn''t a code');
insert into public.invite_codes (code, kind, max_uses, expires_at, disabled_at) values
  ('ADMN22', 'admin', 50, now() - interval '1 day', null),
  ('ADMN33', 'admin', 50, null, now()),
  ('ADMN44', 'admin', 2, now() + interval '1 day', null),
  ('WQTS22', 'waitlist', 1, now() + interval '14 days', null);
select is(tests.redeem('w5', 'ADMN22'), 'unavailable', 'an expired code');
select is(tests.redeem('w5', 'ADMN33'), 'unavailable', 'a switched-off code');
select tests.waiter('w6');
select tests.waiter('w7');
select tests.waiter('w8');
select is(tests.redeem('w6', 'ADMN44'), 'joined', 'an admin code works');
select is(tests.redeem('w7', 'admn44'), 'joined', 'up to its limit');
select is(tests.redeem('w8', 'ADMN44'), 'unavailable', 'and no further');
select is((select count(*)::int from public.follows where reader_id = tests.id('w6') or author_id = tests.id('w6')), 0,
          'an admin code makes no readers');
select tests.waiter('w9');
select tests.waiter('w10');
select is(tests.redeem('w9', 'WQTS22'), 'joined', 'a waitlist code works');
select is(tests.redeem('w10', 'WQTS22'), 'unavailable', 'once');

-- ---------------------------------------------------------------- the owner's state
select tests.unlock('owner2');
select tests.waiter('w11');
update public.profiles set status = 'suspended' where id = tests.id('owner2');
select is(tests.redeem('w11', tests.code('owner2', 'whereami')), 'unavailable', 'a suspended owner''s code can''t be used');
update public.profiles set status = 'active' where id = tests.id('owner2');

select tests.act_as('outsider');
select throws_ok($$select public.invite_freeze(tests.id('owner2'), 'spam')$$, '42501', null,
                 'only moderators freeze invites');
select tests.act_as('moderator');
select throws_ok($$select public.invite_freeze(tests.id('owner2'), ' ')$$, '22023', null, 'a freeze needs a note');
select is(public.invite_freeze(tests.id('owner2'), 'invited a spam ring') ->> 'result', 'frozen', 'a moderator freezes invites');
select tests.reset_role();
select is((select data ->> 'note' from public.audit_log where action = 'invite_freeze' and target_id = tests.id('owner2')),
          'invited a spam ring', 'with an audit row');
select tests.act_as('moderator');
select is(public.invite_freeze(tests.id('owner2'), 'again') ->> 'result', 'already_frozen', 'freezing twice changes nothing');
select tests.reset_role();
select is(tests.redeem('w11', tests.code('owner2', 'whereami')), 'unavailable', 'a frozen owner''s code can''t be used');
select tests.act_as('moderator');
select is(public.invite_unfreeze(tests.id('owner2'), 'cleared') ->> 'result', 'unfrozen', 'a moderator unfreezes');
select tests.reset_role();
select is(tests.redeem('w11', tests.code('owner2', 'whereami')), 'joined', 'and the code works again');
update public.profiles set status = 'deleted' where id = tests.id('owner2');
select tests.waiter('w12');
select is(tests.redeem('w12', tests.code('owner2', 'mebusywith')), 'unavailable', 'a deleted owner''s code can''t be used');

-- ---------------------------------------------------------------- rate limit
select tests.waiter('guesser');
select tests.redeem('guesser', 'ZZZZZZ') from generate_series(1, 10);
select is(tests.redeem('guesser', tests.code('owner', 'whoamiwith', 2)), 'limited', 'the 11th try in an hour is refused');
select is((select uses from public.invite_codes where code = tests.code('owner', 'whoamiwith', 2)), 0,
          'and uses no code');

-- ---------------------------------------------------------------- blocks
select tests.unlock('owner3');
select tests.waiter('w13');
insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner3'), tests.id('w13'));
select is(tests.redeem('w13', tests.code('owner3', 'whereami')), 'joined', 'a blocked person can still use the code');
select is(tests.follows('w13', 'owner3'), 0, 'but no one reads anyone across a block');
select ok((tests.card('owner3', 'whereami') -> 'invitee' -> 'profile') = 'null'::jsonb
          and tests.card('owner3', 'whereami') -> 'invitee' ? 'joined_at',
          'my_invites hides the name across a block');

-- ---------------------------------------------------------------- automatic freeze
select tests.unlock('owner4');
select tests.waiter('w14');
select tests.waiter('w15');
select tests.waiter('w16');
select tests.redeem('w14', tests.code('owner4', 'whereami'));
select tests.redeem('w15', tests.code('owner4', 'mebusywith'));
select tests.redeem('w16', tests.code('owner4', 'whoamiwith'));
update public.profiles set status = 'suspended' where id in (tests.id('w14'), tests.id('w15'));
select ok((select frozen_at is null from public.invite_holders where user_id = tests.id('owner4')),
          'two suspended invitees don''t freeze anything');
update public.profiles set status = 'suspended' where id = tests.id('w16');
select ok((select frozen_at is not null from public.invite_holders where user_id = tests.id('owner4')),
          'the third suspended invitee within 90 days freezes the inviter''s invites');
select is((select count(*)::int from public.audit_log where action = 'invite_freeze' and actor_id is null
           and target_id = tests.id('owner4') and data ->> 'reason' = 'suspended_invitees'), 1,
          'with an audit row');

-- ---------------------------------------------------------------- privacy and deleted invitees
select ok(jsonb_array_length(tests.invites('outsider') -> 'codes') = 8
          and not exists (select 1 from jsonb_array_elements(tests.invites('outsider') -> 'codes') e
                          join public.invite_codes c on c.code = e ->> 'code'
                          where c.owner_id <> tests.id('outsider')),
          'my_invites shows only the caller''s own codes');

update public.profiles set status = 'deleted' where id = tests.id('w1');
select is((select uses from public.invite_codes where code = tests.code('owner', 'whereami')), 1,
          'a code stays used when the friend leaves');
select ok((tests.card('owner', 'whereami') -> 'invitee' -> 'profile') = 'null'::jsonb,
          'and the Invited card no longer names them');

select * from finish();
rollback;
