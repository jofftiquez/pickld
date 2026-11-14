-- 0101: the console's Analytics page and a person's usage (FR-MOD-09). Only moderators can read them; owner,
-- reader, outsider, blocked and anon are refused, and the helpers are not callable. Only me and removed
-- moments are never counted. Small groups show no numbers. Counts are compared with a snapshot taken first,
-- so rows already in the database don't matter.
begin;
\ir _helpers.psql
select plan(44);

-- A free pack whose stickers are used, and a premium pack someone owns.
insert into public.sticker_packs (id, slug, name, tier) values
  ('a1010000-0000-4000-8000-000000000001', 't101-free', 'T101 Free', 'free'),
  ('a1010000-0000-4000-8000-000000000002', 't101-prem', 'T101 Premium', 'premium');
insert into public.stickers (id, pack_id, label, asset_path, art_width, art_height) values
  ('b1010000-0000-4000-8000-000000000001', 'a1010000-0000-4000-8000-000000000001', 'Wave',
   'stickers/t101-free/wave.png', 512, 512),
  ('b1010000-0000-4000-8000-000000000002', 'a1010000-0000-4000-8000-000000000001', 'Heart',
   'stickers/t101-free/heart.png', 512, 512);

select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(),
                  'app_metadata', jsonb_build_object('role', 'moderator'))::text, true);
create temp table snap as select public.mod_analytics(30) as a, public.mod_analytics_stickers(30) as s;
select tests.reset_role();
grant select on snap to authenticated, anon, service_role;

select tests.world();
do $$ begin
  perform tests.create_user('t101_tor' || i, null, 'America/Toronto') from generate_series(1, 5) i;
  perform tests.create_user('t101_nai' || i, null, 'Africa/Nairobi') from generate_series(1, 4) i;
end $$;

create function pg_temp.sticker(p_id text) returns jsonb language sql as $$
  select jsonb_build_object('type', 'sticker', 'stickerId', p_id, 'x', 0.5, 'y', 0.5, 'scale', 0.3, 'rotation', 0)
$$;
create temp table mo (name text primary key, id uuid);
insert into mo values
  ('readers', tests.make_moment(tests.make_jar('owner', 'readers'), 'morning')),
  ('everyone', tests.make_moment(tests.make_jar('owner', 'everyone', true, 1), 'afternoon', 'checking')),
  ('only_me', tests.make_moment(tests.make_jar('owner', 'readers', false, 2), 'evening', 'live', true)),
  ('removed', tests.make_moment(tests.make_jar('owner', 'readers', false, 3), 'evening', 'removed')),
  ('reader', tests.make_moment(tests.make_jar('reader', 'readers'), 'morning'));
update public.moments set edits = jsonb_build_object('overlays', jsonb_build_array(
  pg_temp.sticker('b1010000-0000-4000-8000-000000000001'), jsonb_build_object('type', 'text', 'text', 'hi')))
where id = (select id from mo where name = 'readers');
update public.moments set edits = jsonb_build_object('overlays', jsonb_build_array(
  pg_temp.sticker('b1010000-0000-4000-8000-000000000001'), pg_temp.sticker('b1010000-0000-4000-8000-000000000002'),
  pg_temp.sticker('not-a-uuid')))
where id = (select id from mo where name = 'everyone');
update public.moments set edits = jsonb_build_object('overlays', jsonb_build_array(
  pg_temp.sticker('b1010000-0000-4000-8000-000000000001')))
where id in (select id from mo where name in ('only_me', 'removed'));
insert into public.owned_packs (user_id, pack_id, source) values
  (tests.id('owner'), 'a1010000-0000-4000-8000-000000000002', 'earned');
create temp table paths as select photo_path, thumb_path from public.moments where id in (select id from mo);
grant select on mo, paths to authenticated, anon, service_role;

create function pg_temp.d(p_now jsonb, p_then jsonb, p_path text[]) returns int language sql as $$
  select coalesce((p_now #>> p_path)::int, 0) - coalesce((p_then #>> p_path)::int, 0)
$$;
create function pg_temp.slot(p_doc jsonb, p_slot text) returns int language sql as $$
  select (e ->> 'moments')::int from jsonb_array_elements(p_doc -> 'per_slot') e where e ->> 'slot' = p_slot
$$;
create function pg_temp.pack(p_doc jsonb, p_slug text) returns jsonb language sql as $$
  select e from jsonb_array_elements(p_doc -> 'packs') e where e ->> 'slug' = p_slug
$$;
create function pg_temp.sticker_row(p_doc jsonb, p_label text) returns jsonb language sql as $$
  select e from jsonb_array_elements(p_doc -> 'stickers') e where e ->> 'pack' = 't101-free' and e ->> 'label' = p_label
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------- who can call them
select ok(not has_function_privilege('authenticated', 'public.mod_analytics_moments()', 'execute'),
          'clients cannot call the moments helper');
select ok(not has_function_privilege('authenticated', 'public.mod_analytics_sticker_uses()', 'execute'),
          'clients cannot call the sticker uses helper');
select ok(not has_function_privilege('authenticated', 'public.mod_age_band(date)', 'execute'),
          'clients cannot call the age band helper');

select tests.act_as_anon();
select throws_ok($$select public.mod_analytics()$$, '42501', null, 'anon cannot read analytics');
select throws_ok($$select public.mod_analytics_stickers()$$, '42501', null, 'anon cannot read sticker analytics');
select throws_ok($$select public.mod_user_stats(tests.id('owner'))$$, '42501', null, 'anon cannot read a person''s usage');
select tests.act_as('owner');
select throws_ok($$select public.mod_analytics()$$, '42501', 'moderators only', 'the owner cannot read analytics');
select throws_ok($$select public.mod_analytics_stickers()$$, '42501', 'moderators only',
                 'the owner cannot read sticker analytics');
select throws_ok($$select public.mod_user_stats(tests.id('owner'))$$, '42501', 'moderators only',
                 'the owner cannot read their own usage here');
select tests.act_as('reader');
select throws_ok($$select public.mod_analytics()$$, '42501', 'moderators only', 'a reader cannot read analytics');
select tests.act_as('outsider');
select throws_ok($$select public.mod_analytics_stickers()$$, '42501', 'moderators only',
                 'an outsider cannot read sticker analytics');
select tests.act_as('blocked');
select throws_ok($$select public.mod_user_stats(tests.id('owner'))$$, '42501', 'moderators only',
                 'a blocked user cannot read a person''s usage');

-- ---------------------------------------------------------------- site-wide
select tests.act_as('moderator');
create temp table now_ as select public.mod_analytics(30) as a, public.mod_analytics_stickers(30) as s;

select is(pg_temp.d((select a from now_), (select a from snap), '{totals,moments}'), 3,
          'moments counts Readers and Everyone moments, not Only me or removed ones');
select is(pg_temp.d((select a from now_), (select a from snap), '{totals,posters}'), 2, 'two more people posted');
select is(pg_temp.d((select a from now_), (select a from snap), '{totals,signups}'), 15, 'fifteen sign-ups');
select is(pg_temp.d((select a from now_), (select a from snap), '{totals,people}'), 15, 'fifteen more people');
select is(pg_temp.d((select a from now_), (select a from snap), '{totals,with_stickers}'), 2,
          'two counted moments carry stickers');
select is(pg_temp.slot((select a from now_), 'morning') - pg_temp.slot((select a from snap), 'morning'), 2,
          'two more morning moments');
select is(pg_temp.slot((select a from now_), 'afternoon') - pg_temp.slot((select a from snap), 'afternoon'), 1,
          'one more afternoon moment');
select is(pg_temp.slot((select a from now_), 'evening') - pg_temp.slot((select a from snap), 'evening'), 0,
          'the Only me and removed evening moments are not counted');
select is((select jsonb_array_length(a -> 'per_day') from now_), 30, 'thirty days');
select is((select (now_.a #>> '{per_day,29,moments}')::int - (snap.a #>> '{per_day,29,moments}')::int from now_, snap), 3,
          'all three were added today (server time decides the day)');
select is((public.mod_analytics(1) ->> 'days')::int, 7, 'a window under a week becomes a week');
select is((public.mod_analytics(500) ->> 'days')::int, 90, 'a window over 90 days becomes 90');
select ok((select bool_and(e ? 'hidden' or (e ->> 'people')::int >= 5)
           from now_, jsonb_array_elements(a -> 'age_bands') e), 'an age band shows numbers only from five people');
select is((select count(*)::int from now_, jsonb_array_elements(a -> 'age_bands') e), 6, 'six age bands');
select is((select (e ->> 'people')::int from now_, jsonb_array_elements(a -> 'zones') e
           where e ->> 'zone' = 'America/Toronto'), 5, 'a zone with five people is listed');
select ok(not exists (select 1 from now_, jsonb_array_elements(a -> 'zones') e where e ->> 'zone' = 'Africa/Nairobi'),
          'a zone with four people folds into Other zones');
select ok(not exists (select 1 from paths, now_
                      where position(photo_path in a::text || s::text) > 0 or position(thumb_path in a::text || s::text) > 0),
          'no moment photo or thumbnail path is returned');

-- ---------------------------------------------------------------- stickers
select is((pg_temp.sticker_row((select s from now_), 'Wave') ->> 'uses')::int, 2,
          'Wave was used twice on counted moments');
select is((pg_temp.sticker_row((select s from now_), 'Wave') ->> 'people')::int, 1, 'by one person');
select is((pg_temp.sticker_row((select s from now_), 'Heart') ->> 'uses')::int, 1, 'Heart was used once');
select is((pg_temp.pack((select s from now_), 't101-free') ->> 'uses')::int, 3, 'the free pack has three uses');
select is((pg_temp.pack((select s from now_), 't101-free') ->> 'people')::int, 1, 'by one person');
select is((pg_temp.pack((select s from now_), 't101-prem') ->> 'owners')::int, 1, 'the premium pack has one owner');
select is((pg_temp.pack((select s from now_), 't101-prem') #>> '{by_source,earned}')::int, 1, 'who earned it');
select is((pg_temp.pack((select s from now_), 't101-prem') ->> 'acquired')::int, 1, 'acquired in the window');
select is(pg_temp.d((select s from now_), (select s from snap), '{totals,uses}'), 3, 'three more sticker uses');

-- ---------------------------------------------------------------- one person
select is((public.mod_user_stats(tests.id('owner')) ->> 'moments')::int, 2, 'the owner has two counted moments');
select is((public.mod_user_stats(tests.id('owner')) ->> 'active_days')::int, 1, 'on one day');
select is(public.mod_user_stats(tests.id('owner')) #>> '{stickers,0,label}', 'Wave', 'their top sticker is Wave');
select is((public.mod_user_stats(tests.id('owner')) #>> '{stickers,0,uses}')::int, 2, 'used twice');
select is(public.mod_user_stats(tests.id('owner')) #>> '{packs,0,slug}', 't101-prem', 'they own the premium pack');
select is(public.mod_user_stats(gen_random_uuid()), null, 'an unknown person gives nothing');

select * from finish();
rollback;
