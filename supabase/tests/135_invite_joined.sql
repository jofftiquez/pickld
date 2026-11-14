-- INV-08 (0135): "Ana joined with your invite" and the two invite stickers. The inviter gets one invite_joined
-- per person who joins with a personal code or the link, none across a block and none for admin codes; it is
-- pushed under the Friend joined switch with no daily limit. First friend comes with the first join, Full jar
-- of friends only once all 8 codes of the first set are used; both are earn-only Milestones stickers.
begin;
\ir _helpers.psql
select plan(22);

select tests.world();
select tests.create_user('owner2');
-- Everyone so far has been on Pickld for a while (redeem treats accounts under a day old as just signed up).
update public.profiles set created_at = now() - interval '30 days';

-- A waiting account (INV-02).
create function tests.waiter(p_name text) returns uuid language plpgsql as $$
declare uid uuid := tests.create_user(p_name);
begin
  update public.profiles set status = 'waiting' where id = uid;
  return uid;
end $$;

create function tests.code(p_owner text, p_slot slot) returns text language sql stable as $$
  select code from public.invite_codes where owner_id = tests.id(p_owner) and set_no = 1 and slot = p_slot
$$;
create function tests.link(p_owner text) returns text language sql stable as $$
  select link_id from public.invite_links where owner_id = tests.id(p_owner)
$$;

-- p_as redeems p_token and the result comes back. Arguments are evaluated before the role switches.
create function tests.redeem(p_as text, p_token text) returns text language plpgsql as $$
declare j jsonb;
begin
  perform tests.act_as(p_as);
  j := public.invite_redeem(p_token);
  perform tests.reset_role();
  return j ->> 'result';
end $$;

-- A new waiting account p_as redeems p_token.
create function tests.join_with(p_as text, p_token text) returns text language plpgsql as $$
begin
  perform tests.waiter(p_as);
  return tests.redeem(p_as, p_token);
end $$;

create function tests.joined_rows(p_owner text, p_actor text default null) returns int language sql stable as $$
  select count(*)::int from public.notifications
  where user_id = tests.id(p_owner) and type = 'invite_joined' and (p_actor is null or actor_id = tests.id(p_actor))
$$;

create function tests.has_milestone(p_user text, p_key text) returns boolean language sql stable as $$
  select exists (select 1 from public.milestones where user_id = tests.id(p_user) and key = p_key)
$$;

create function tests.usable(p_as text, p_key text) returns boolean language plpgsql as $$
declare ok boolean;
begin
  perform tests.act_as(p_as);
  select public.sticker_usable(s) into ok from public.stickers s where s.milestone_key = p_key;
  perform tests.reset_role();
  return ok;
end $$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

select tests.make_moment(tests.make_jar('owner'), 'morning', 'live');   -- unlocks owner's invites
select tests.make_moment(tests.make_jar('owner2'), 'morning', 'live');

-- ---------------------------------------------------------------- the stickers are earn-only
select is((select array_agg(s.label order by s.sort) from public.stickers s
           join public.sticker_packs p on p.id = s.pack_id
           where s.milestone_key in ('first_friend', 'full_jar_of_friends') and p.slug = 'milestones'),
          array['First friend', 'Full jar of friends'], 'both invite stickers are in the Milestones pack');
select ok((select p.tier = 'earned' and p.store_product_id is null from public.sticker_packs p where p.slug = 'milestones'),
          'the Milestones pack is earned and has no store product, so it is never sold');
select ok(not has_function_privilege('authenticated', 'public.invite_joined(uuid, uuid)', 'execute')
          and not has_function_privilege('anon', 'public.invite_joined(uuid, uuid)', 'execute'),
          'no client calls invite_joined() directly');
select is(tests.usable('owner', 'first_friend'), false, 'before anyone joins, First friend is locked');

-- ---------------------------------------------------------------- the first friend
select is(tests.join_with('ana', tests.code('owner', 'whereami')), 'joined', 'Ana joins with the owner''s code');
select is(tests.joined_rows('owner', 'ana'), 1, 'the owner gets one invite_joined about Ana');
select is((select count(*)::int from public.notifications where user_id = tests.id('ana') and type = 'invite_joined'), 0,
          'Ana gets none');
select ok(tests.has_milestone('owner', 'first_friend'), 'the owner earns First friend');
select ok(not tests.has_milestone('owner', 'full_jar_of_friends'), 'but not Full jar of friends yet');
select is(tests.usable('owner', 'first_friend'), true, 'the owner can use the First friend sticker');
select is(tests.usable('owner', 'full_jar_of_friends'), false, 'Full jar of friends is still locked');
select is(tests.usable('ana', 'first_friend'), false, 'Ana did not earn it');

-- ---------------------------------------------------------------- across a block: joined, but not told
select tests.waiter('bea');
insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner'), tests.id('bea'));
select is(tests.redeem('bea', tests.code('owner', 'mebusywith')), 'joined', 'a blocked waiter can still use a code');
select is(tests.joined_rows('owner', 'bea'), 0, 'no invite_joined across a block');

-- ---------------------------------------------------------------- admin codes have no inviter
insert into public.invite_codes (code, kind, max_uses) values ('ADMN23', 'admin', 5);
select is(tests.join_with('cy', 'ADMN23'), 'joined', 'Cy joins with an admin code');
select is((select count(*)::int from public.notifications where actor_id = tests.id('cy') and type = 'invite_joined'), 0,
          'an admin code tells nobody');

-- ---------------------------------------------------------------- the full first set
select tests.join_with('dan', tests.code('owner', 'whoamiwith'));
select tests.join_with('eve', tests.code('owner', 'ootd'));
select tests.join_with('fay', tests.code('owner', 'selfie'));
select tests.join_with('gus', tests.code('owner', 'morning'));
select tests.join_with('hal', tests.code('owner', 'afternoon'));
select ok(not tests.has_milestone('owner', 'full_jar_of_friends'), 'with 7 of 8 codes used, no Full jar of friends');
-- The link uses the last unused code (evening).
select is(tests.join_with('ivy', tests.link('owner')), 'joined', 'Ivy joins with the owner''s link');
select ok(tests.has_milestone('owner', 'full_jar_of_friends'), 'the 8th code earns Full jar of friends');
select is(tests.joined_rows('owner'), 7, 'one invite_joined per person, the link included, none for the blocked one');

-- ---------------------------------------------------------------- push: the Friend joined switch, no daily limit
select tests.join_with('jo', tests.code('owner2', 'whereami'));
select tests.join_with('kim', tests.code('owner2', 'ootd'));
update public.notification_prefs set friend_joined = false where user_id = tests.id('owner');
select count(*) from public.push_take(interval '0 seconds');
select is((select array_agg(distinct push_result) from public.notifications
           where user_id = tests.id('owner') and type = 'invite_joined'),
          array['muted'], 'with Friend joined off, the owner''s invite_joined rows are muted');
select is((select array_agg(push_result order by created_at) from public.notifications
           where user_id = tests.id('owner2') and type = 'invite_joined'),
          array['no_token', 'no_token'], 'with it on, each row goes on to be pushed: no daily limit (no device here)');

select * from finish();
rollback;
