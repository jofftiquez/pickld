-- 0145: the console's invite graph, as a moderator, a signed-in outsider and anon. One person's tree (up to whoever
-- started the chain, down a few levels, the depth and size limits and whether they cut it), the counts, suspended
-- and paused people, sources with no owner (the waitlist and admin codes), and the whole network with its limit.
begin;
\ir _helpers.psql
select plan(30);

select tests.create_user('moderator', 'moderator');
select tests.create_user('outsider');
-- The tree: waitlist → root → mid → (kid1 → grand1 → great1, kid2), and admin code → solo.
select tests.create_user('root');
select tests.create_user('mid');
select tests.create_user('kid1');
select tests.create_user('kid2');
select tests.create_user('grand1');
select tests.create_user('great1');
select tests.create_user('solo');
select tests.create_user('loner');
select tests.create_user('gone');

insert into public.invite_codes (code, kind, max_uses) values ('WWWWW2', 'waitlist', 1), ('AAAAA2', 'admin', 5);
update public.invite_codes set note = 'Coffee meetup' where code = 'AAAAA2';

-- p_invitee joins with p_code (as redeeming does, without its follows and checks), p_minutes after the first.
create function tests.joined_with(p_invitee text, p_code text, p_minutes int) returns void language sql as $$
  update public.invite_codes set uses = uses + 1 where code = p_code;
  insert into public.invite_redemptions (code, invitee_id, redeemed_at)
  values (p_code, tests.id(p_invitee), now() - interval '1 day' + make_interval(mins => p_minutes));
$$;
-- p_invitee joins with p_owner's next unused personal code.
create function tests.invited(p_invitee text, p_owner text, p_minutes int) returns void language sql as $$
  select tests.joined_with(p_invitee, (select code from public.invite_codes
    where owner_id = tests.id(p_owner) and kind = 'personal' and uses = 0 order by set_no, slot limit 1), p_minutes);
$$;

create function tests.tree(p_user uuid, p_depth int default 3, p_limit int default 200) returns jsonb
language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  j := public.mod_invite_tree(p_user, p_depth, p_limit);
  perform tests.reset_role();
  return j;
end $$;

create function tests.network(p_limit int default 1500) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as('moderator');
  j := public.mod_invite_network(p_limit);
  perform tests.reset_role();
  return j;
end $$;

-- The node with id p_id ('waitlist', 'admin:CODE' or a person's name from tests.users).
create function tests.node(p_graph jsonb, p_id text) returns jsonb language sql as $$
  select e from jsonb_array_elements(p_graph -> 'nodes') e
  where e ->> 'id' = coalesce((select id::text from tests.users where name = p_id), p_id);
$$;

-- The graph's people, by test name, sorted.
create function tests.people(p_graph jsonb) returns text[] language sql as $$
  select coalesce(array_agg(u.name order by u.name collate "C"), '{}') from jsonb_array_elements(p_graph -> 'nodes') e
  join tests.users u on u.id::text = e ->> 'id';
$$;

-- The graph's edges as 'from>to' with test names (or the source id), sorted.
create function tests.edges(p_graph jsonb) returns text[] language sql as $$
  select coalesce(array_agg(x order by x collate "C"), '{}') from (
    select coalesce(f.name, e ->> 'source') || '>' || t.name as x
    from jsonb_array_elements(p_graph -> 'edges') e
  left join tests.users f on f.id::text = e ->> 'source'
    join tests.users t on t.id::text = e ->> 'target') edges;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.joined_with('root', 'WWWWW2', 0);
select tests.invited('mid', 'root', 1);
select tests.invited('kid1', 'mid', 2);
select tests.invited('kid2', 'mid', 3);
select tests.invited('grand1', 'kid1', 4);
select tests.invited('great1', 'grand1', 5);
select tests.joined_with('solo', 'AAAAA2', 6);
select tests.invited('gone', 'solo', 7);
-- gone deleted their account: the redemption stays, without them (on delete set null).
delete from public.profiles where id = tests.id('gone');

update public.profiles set status = 'suspended' where id = tests.id('kid2');
insert into public.invite_holders (user_id, frozen_at, frozen_reason) values (tests.id('kid1'), now(), 'spam')
on conflict (user_id) do update set frozen_at = excluded.frozen_at, frozen_reason = excluded.frozen_reason;

-- ---------------------------------------------------------------- who may call
select ok(not has_function_privilege('anon', 'public.mod_invite_tree(uuid, int, int)', 'execute')
          and not has_function_privilege('anon', 'public.mod_invite_network(int)', 'execute'),
          'anon can call neither graph function');

select tests.act_as('outsider');
select throws_ok($$select public.mod_invite_tree(tests.id('mid'))$$, '42501', null,
                 'only moderators see a person''s invite tree');
select throws_ok($$select public.mod_invite_network()$$, '42501', null, 'only moderators see the invite network');
select tests.reset_role();

select set_config('role', 'authenticated', true), set_config('request.jwt.claims', jsonb_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'aud', 'authenticated',
  'app_metadata', jsonb_build_object('provider', 'email', 'role', 'moderator'))::text, true);
select lives_ok($$select public.mod_invite_tree(tests.id('mid')), public.mod_invite_network()$$,
                'a moderator without a profile sees the graph');
select tests.reset_role();

-- ---------------------------------------------------------------- one person's tree
select is(tests.tree(gen_random_uuid()), null, 'no tree for someone who isn''t there');

select is(tests.people(tests.tree(tests.id('mid'))), array['grand1', 'great1', 'kid1', 'kid2', 'mid', 'root'],
          'mid''s tree: who invited them and everyone three levels down');
select is(tests.edges(tests.tree(tests.id('mid'))),
          array['grand1>great1', 'kid1>grand1', 'mid>kid1', 'mid>kid2', 'root>mid', 'waitlist>root'],
          'with who brought in whom, from the waitlist at the top');
select is(tests.node(tests.tree(tests.id('mid')), 'waitlist') - 'id',
          jsonb_build_object('type', 'waitlist', 'code', null, 'note', null, 'level', -2, 'direct', 1,
                             'total', null),
          'the waitlist is a source above the topmost person, with how many joined with it');
select is((select jsonb_object_agg(u.name, (e ->> 'level')::int) from jsonb_array_elements(
             tests.tree(tests.id('mid')) -> 'nodes') e join tests.users u on u.id::text = e ->> 'id'),
          jsonb_build_object('root', -1, 'mid', 0, 'kid1', 1, 'kid2', 1, 'grand1', 2, 'great1', 3),
          'each person''s level: above them negative, below positive');
select is(tests.tree(tests.id('mid')) ->> 'focus', tests.id('mid')::text, 'the tree says whose it is');
select is(tests.tree(tests.id('mid')) -> 'truncated', 'false'::jsonb, 'nothing cut when it all fits');

select is(tests.node(tests.tree(tests.id('mid')), 'mid') - 'id' - 'level',
          jsonb_build_object('type', 'person', 'username', 't_mid', 'display_name', 'Mid', 'status', 'active',
                             'frozen', false, 'direct', 2, 'total', 4),
          'a person''s name, status and direct and total invitees');
select is(tests.node(tests.tree(tests.id('mid')), 'root') ->> 'total', '5', 'the inviter''s total counts it all');
select is(tests.node(tests.tree(tests.id('mid')), 'kid2') ->> 'status', 'suspended', 'suspended people show it');
select is(tests.node(tests.tree(tests.id('mid')), 'kid1') -> 'frozen', 'true'::jsonb,
          'people whose invites are paused show it');

select is(tests.people(tests.tree(tests.id('mid'), 1)), array['kid1', 'kid2', 'mid', 'root'],
          'depth 1 shows only their direct invitees');
select is(tests.tree(tests.id('mid'), 1) -> 'truncated', 'true'::jsonb, 'and says the tree was cut');
select is(tests.node(tests.tree(tests.id('mid'), 1), 'kid1') ->> 'total', '2',
          'counts still cover the whole tree when it''s cut');
select is(tests.people(tests.tree(tests.id('mid'), 3, 2)), array['kid1', 'kid2', 'mid', 'root'],
          'the size limit keeps the nearest people first');
select is(tests.tree(tests.id('mid'), 3, 2) -> 'truncated', 'true'::jsonb, 'and says the tree was cut');
select is((tests.tree(tests.id('mid'), 99, 99999) -> 'depth')::int * 1000
          + (tests.tree(tests.id('mid'), 99, 99999) -> 'limit')::int, 6500, 'depth is at most 6, size at most 500');

select is(tests.people(tests.tree(tests.id('solo'))), array['solo'], 'a deleted invitee isn''t in the tree');
select is(tests.node(tests.tree(tests.id('solo')), 'admin:AAAAA2') - 'id',
          jsonb_build_object('type', 'admin', 'code', 'AAAAA2', 'note', 'Coffee meetup', 'level', -1,
                             'direct', 1, 'total', null),
          'an admin code is a source with its note');
select is(tests.edges(tests.tree(tests.id('loner'))), '{}'::text[], 'someone who joined without a code is alone');

-- ---------------------------------------------------------------- the whole network
select is(tests.people(tests.network()), array['grand1', 'great1', 'kid1', 'kid2', 'mid', 'root', 'solo'],
          'the network: everyone who joined with a code or brought someone in');
select is(tests.edges(tests.network()),
          array['admin:AAAAA2>solo', 'grand1>great1', 'kid1>grand1', 'mid>kid1', 'mid>kid2', 'root>mid',
                'waitlist>root'],
          'with every link, from the waitlist and admin codes too');
select is(tests.node(tests.network(), 'waitlist') ->> 'total', '6', 'a source counts everyone below it');
select is(tests.network() -> 'people', '7'::jsonb, 'and how many people are in it');
select is(tests.people(tests.network(3)), array['kid1', 'mid', 'root'],
          'the limit keeps the oldest joiners, so each one''s inviter is there');
select is(tests.edges(tests.network(3)), array['mid>kid1', 'root>mid', 'waitlist>root'],
          'and only links between shown people');

select * from finish();
rollback;
