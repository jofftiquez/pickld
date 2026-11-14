-- 0100: downloadable sticker packs. Every sticker carries its art size, a draft pack is read by moderators only
-- and used by nobody, publishing needs every size, and published art never changes under a key (D-131, D-46).
begin;
\ir _helpers.psql
select plan(24);

select tests.world();

select is((select count(*)::int from public.stickers where art_width is null or art_height is null), 0,
          'every sticker, retired ones too, has its art size');
select is((select count(*)::int from public.sticker_packs where status <> 'published'), 0,
          'every existing pack is published');
select is((select count(*)::int from public.stickers where art_version <> 1), 0, 'and every sticker''s art is version 1');

-- A staged pack: one sticker with its size, one still without.
insert into public.sticker_packs (id, slug, name, tier, sort, status)
values ('00000000-0000-0000-0000-00000000d001', 'dl-test', 'Downloaded', 'free', 999, 'draft');
insert into public.stickers (id, pack_id, label, asset_path, sort, art_width, art_height) values
  ('00000000-0000-0000-0000-00000000d011', '00000000-0000-0000-0000-00000000d001', 'One', 'stickers/dl-test/one.png', 1, 360, 234),
  ('00000000-0000-0000-0000-00000000d012', '00000000-0000-0000-0000-00000000d001', 'Two', 'stickers/dl-test/two.png', 2, null, null);
select is((select published_at from public.sticker_packs where slug = 'dl-test'), null, 'a draft has no publish time');

create function pg_temp.sees_draft() returns text language sql as $$
  select (select count(*) from public.sticker_packs where slug = 'dl-test') || '/' ||
         (select count(*) from public.stickers where asset_path like 'stickers/dl-test/%')
$$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

select tests.act_as('owner');
select is(pg_temp.sees_draft(), '0/0', 'owner doesn''t see a draft pack or its stickers');
select tests.act_as('reader');
select is(pg_temp.sees_draft(), '0/0', 'nor does a reader');
select tests.act_as('outsider');
select is(pg_temp.sees_draft(), '0/0', 'nor an outsider');
select tests.act_as('blocked');
select is(pg_temp.sees_draft(), '0/0', 'nor a blocked user');
select tests.act_as('moderator');
select is(pg_temp.sees_draft(), '1/2', 'a moderator sees the draft and its stickers');
select is((select p.pack_usable from public.sticker_packs p where slug = 'dl-test'), false,
          'but can''t use it, even though it is free');
select is((select count(*)::int from public.stickers where asset_path like 'stickers/dl-test/%' and public.sticker_usable(stickers)), 0,
          'nor any of its stickers');
select tests.act_as_anon();
select is((select count(*)::int from public.public_sticker_catalog() where pack_slug = 'dl-test'), 0,
          'the web page''s catalog leaves the draft out');

select tests.reset_role();
update public.stickers set art_version = 2 where asset_path = 'stickers/dl-test/one.png';
select is((select art_version from public.stickers where asset_path = 'stickers/dl-test/one.png'), 2,
          'a draft''s art can be replaced (new version)');
select throws_ok($$ update public.sticker_packs set status = 'published' where slug = 'dl-test' $$, '23514',
                 'every sticker needs art_width and art_height before its pack is published',
                 'a pack can''t be published while a sticker has no art size');
update public.stickers set art_width = 300, art_height = 300 where asset_path = 'stickers/dl-test/two.png';
select lives_ok($$ update public.sticker_packs set status = 'published' where slug = 'dl-test' $$,
                'with every size it publishes');
select isnt((select published_at from public.sticker_packs where slug = 'dl-test'), null, 'and gets its publish time');

select tests.act_as('reader');
select is(pg_temp.sees_draft(), '1/2', 'a published pack is in everyone''s catalog');
select is((select p.pack_usable from public.sticker_packs p where slug = 'dl-test'), true, 'and a free one is usable');
select tests.act_as_anon();
select is((select count(*)::int from public.public_sticker_catalog() where pack_slug = 'dl-test'), 2,
          'and on the web page');

select tests.reset_role();
select throws_ok($$ update public.stickers set art_version = 3 where asset_path = 'stickers/dl-test/one.png' $$, '23514',
                 null, 'published art can''t get a new version');
select throws_ok($$ update public.stickers set asset_path = 'stickers/dl-test/one-v2.png' where asset_path = 'stickers/dl-test/one.png' $$,
                 '23514', null, 'nor a new file under the same row');
select lives_ok($$ update public.stickers set label = 'Uno', tags = '{one}' where asset_path = 'stickers/dl-test/one.png' $$,
                'labels and tags stay editable');
select throws_ok($$ update public.sticker_packs set status = 'draft' where slug = 'dl-test' $$, '23514',
                 'a published sticker pack can''t go back to draft', 'a published pack never goes back to draft');
select throws_ok($$ update public.sticker_packs set status = 'live' where slug = 'dl-test' $$, '23514', null,
                 'status is draft or published');

select * from finish();
rollback;
