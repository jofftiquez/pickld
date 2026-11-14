-- 0102: the console's Sticker Studio (FR-MOD-10). Only moderators with a profile can call it; owner, reader,
-- outsider, blocked and anon are refused, and the helpers are not callable. Drafts take new and replaced art;
-- a published pack only takes new names. Publishing needs a live sticker with a size. Only free packs are
-- edited. Every change writes an audit row.
begin;
\ir _helpers.psql
select plan(51);

select tests.world();
insert into public.sticker_packs (id, slug, name, tier) values
  ('a1020000-0000-4000-8000-000000000001', 't102-prem', 'T102 Premium', 'premium');
insert into public.stickers (id, pack_id, label, asset_path, art_width, art_height) values
  ('b1020000-0000-4000-8000-000000000001', 'a1020000-0000-4000-8000-000000000001', 'Gold',
   'stickers/t102-prem/gold.png', 512, 512);
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated, anon;

-- ---------------------------------------------------------------- who can call them
select ok(not has_function_privilege('authenticated', 'public.mod_studio_actor()', 'execute'),
          'clients cannot call the actor helper');
select ok(not has_function_privilege('authenticated', 'public.mod_studio_valid_part(text, int)', 'execute'),
          'clients cannot call the key part helper');
select ok(not has_function_privilege('authenticated', 'public.mod_studio_text(text, int)', 'execute'),
          'clients cannot call the text helper');
select ok(not has_function_privilege('authenticated', 'public.mod_studio_description(text)', 'execute'),
          'clients cannot call the description helper');

select tests.act_as_anon();
select throws_ok($$select public.mod_studio_create_pack('t102-anon', 'Anon')$$, '42501', null,
                 'anon cannot create a pack');
select tests.act_as('owner');
select throws_ok($$select public.mod_studio_create_pack('t102-owner', 'Owner')$$, '42501', 'moderators only',
                 'a member cannot create a pack');
select throws_ok($$select public.mod_studio_art_key('a1020000-0000-4000-8000-000000000001', 'x')$$, '42501',
                 'moderators only', 'a member cannot get an upload key');
select tests.act_as('reader');
select throws_ok($$select public.mod_studio_put_art('a1020000-0000-4000-8000-000000000001', 'x', 'X', 9, 9)$$,
                 '42501', 'moderators only', 'a reader cannot add art');
select tests.act_as('outsider');
select throws_ok($$select public.mod_studio_edit_sticker('b1020000-0000-4000-8000-000000000001', 'Hi')$$,
                 '42501', 'moderators only', 'an outsider cannot edit a sticker');
select throws_ok($$select public.mod_studio_set_retired('b1020000-0000-4000-8000-000000000001', true)$$,
                 '42501', 'moderators only', 'an outsider cannot retire a sticker');
select tests.act_as('blocked');
select throws_ok($$select public.mod_studio_publish('a1020000-0000-4000-8000-000000000001')$$, '42501',
                 'moderators only', 'a blocked user cannot publish');
select throws_ok($$select public.mod_studio_edit_pack('a1020000-0000-4000-8000-000000000001', 'X')$$, '42501',
                 'moderators only', 'a blocked user cannot edit a pack');
select set_config('request.jwt.claims', jsonb_build_object('sub', gen_random_uuid(), 'role', 'authenticated',
                  'app_metadata', jsonb_build_object('role', 'moderator'))::text, true);
select throws_ok($$select public.mod_studio_create_pack('t102-ghost', 'Ghost')$$, '42501',
                 'the moderator has no profile', 'a moderator needs a profile, for the audit row');

-- ---------------------------------------------------------------- packs
select tests.act_as('moderator');
select is(public.mod_studio_create_pack('T102 Bad', 'Bad') ->> 'result', 'bad_slug', 'a slug is a key part');
select is(public.mod_studio_create_pack('-t102', 'Bad') ->> 'result', 'bad_slug', 'no leading hyphen');
select throws_ok($$select public.mod_studio_create_pack('t102-blank', '  ')$$, '22023', null, 'a name is required');
insert into ids select 'pack', (public.mod_studio_create_pack('t102-new', ' Brand New ', ' Fresh art ') ->> 'id')::uuid;
select results_eq(
  $$select slug, name, tier::text, status, description, published_at is null
    from public.sticker_packs where id = (select id from ids where name = 'pack')$$,
  $$values ('t102-new', 'Brand New', 'free', 'draft', 'Fresh art', true)$$,
  'creates a free draft pack, trimmed');
select is(public.mod_studio_create_pack('t102-new', 'Again') ->> 'result', 'slug_taken', 'slugs are unique');
select is(public.mod_studio_edit_pack((select id from ids where name = 'pack'), 'Brand new', null) ->> 'result',
          'saved', 'a pack can be renamed');
select is((select description from public.sticker_packs where id = (select id from ids where name = 'pack')), null,
          'an empty description clears it');
select is(public.mod_studio_edit_pack('a1020000-0000-4000-8000-000000000001', 'X') ->> 'result', 'not_editable',
          'premium packs are read-only here');
select is(public.mod_studio_edit_pack(gen_random_uuid(), 'X') ->> 'result', 'not_found', 'an unknown pack');
select throws_ok($$insert into public.sticker_packs (slug, name, tier) values ('t102-direct', 'D', 'free')$$,
                 '42501', null, 'moderators still cannot write the catalog tables directly');

-- ---------------------------------------------------------------- art in a draft
select is(public.mod_studio_publish((select id from ids where name = 'pack')) ->> 'result', 'empty',
          'an empty pack cannot be published');
select is(public.mod_studio_art_key((select id from ids where name = 'pack'), 'blue-heart'),
          '{"result": "ok", "key": "stickers/t102-new/blue-heart.png", "replace": false}'::jsonb,
          'the upload key for a new sticker');
select is(public.mod_studio_art_key((select id from ids where name = 'pack'), 'Blue Heart') ->> 'result', 'bad_name',
          'a name is a key part');
select is(public.mod_studio_art_key('a1020000-0000-4000-8000-000000000001', 'x') ->> 'result', 'not_editable',
          'no uploads to a premium pack');
select is(public.mod_studio_art_key(gen_random_uuid(), 'x') ->> 'result', 'not_found', 'no uploads to an unknown pack');
insert into ids select 'heart',
  (public.mod_studio_put_art((select id from ids where name = 'pack'), 'blue-heart', null, 300, 280) ->> 'id')::uuid;
select results_eq(
  $$select label, asset_path, art_width, art_height, art_version from public.stickers
    where id = (select id from ids where name = 'heart')$$,
  $$values ('Blue heart', 'stickers/t102-new/blue-heart.png', 300, 280, 1)$$,
  'adds the sticker, labelled from its name when no label is given');
select is(public.mod_studio_art_key((select id from ids where name = 'pack'), 'blue-heart') ->> 'replace', 'true',
          'uploading the same name to a draft replaces its art');
select is(public.mod_studio_put_art((select id from ids where name = 'pack'), 'blue-heart', '', 320, 300),
          jsonb_build_object('result', 'replaced', 'id', (select id from ids where name = 'heart'), 'version', 2),
          'replacing draft art bumps art_version');
select results_eq(
  $$select label, art_width, art_height from public.stickers where id = (select id from ids where name = 'heart')$$,
  $$values ('Blue heart', 320, 300)$$, 'and keeps the label when none is given');
select throws_ok($$select public.mod_studio_put_art((select id from ids where name = 'pack'), 'big', 'Big', 4096, 10)$$,
                 '22023', null, 'art is at most 2048 pixels a side');

-- ---------------------------------------------------------------- stickers
select is(public.mod_studio_edit_sticker((select id from ids where name = 'heart'), ' Love ',
          array[' Party ', 'fun', 'party', ''], 'evening') ->> 'result', 'saved', 'a sticker is edited');
select results_eq(
  $$select label, tags, slot_hint::text from public.stickers where id = (select id from ids where name = 'heart')$$,
  $$values ('Love', array['party', 'fun'], 'evening')$$, 'tags are trimmed, lower case and unique');
select throws_ok($$select public.mod_studio_edit_sticker((select id from ids where name = 'heart'), 'Love',
                   array(select 'tag' || g from generate_series(1, 13) g))$$,
                 '22023', null, 'at most 12 tags');
select is(public.mod_studio_edit_sticker('b1020000-0000-4000-8000-000000000001', 'Hi') ->> 'result', 'not_editable',
          'premium stickers are read-only here');
select is(public.mod_studio_set_retired((select id from ids where name = 'heart'), true) ->> 'result', 'retired',
          'a sticker is retired');
select is(public.mod_studio_set_retired((select id from ids where name = 'heart'), true) ->> 'result', 'unchanged',
          'retiring twice changes nothing');
select is(public.mod_studio_publish((select id from ids where name = 'pack')) ->> 'result', 'empty',
          'a pack whose stickers are all retired cannot be published');
select is(public.mod_studio_set_retired((select id from ids where name = 'heart'), false) ->> 'result', 'restored',
          'and restored');

-- ---------------------------------------------------------------- publishing
select tests.reset_role();
insert into public.stickers (pack_id, label, asset_path)
values ((select id from ids where name = 'pack'), 'No size', 'stickers/t102-new/no-size.png');
select tests.act_as('moderator');
select is(public.mod_studio_publish((select id from ids where name = 'pack')) ->> 'result', 'missing_size',
          'every live sticker needs its size');
select tests.reset_role();
delete from public.stickers where asset_path = 'stickers/t102-new/no-size.png';
select tests.act_as('moderator');
select is(public.mod_studio_publish((select id from ids where name = 'pack')),
          '{"result": "published", "count": 1}'::jsonb, 'the pack is published');
select results_eq(
  $$select status, published_at is not null from public.sticker_packs where id = (select id from ids where name = 'pack')$$,
  $$values ('published', true)$$, 'with its publish time');
select is(public.mod_studio_publish((select id from ids where name = 'pack')) ->> 'result', 'already_published',
          'publishing twice changes nothing');
select is(public.mod_studio_art_key((select id from ids where name = 'pack'), 'blue-heart') ->> 'result', 'name_taken',
          'published art is never uploaded again under its key');
select is(public.mod_studio_put_art((select id from ids where name = 'pack'), 'blue-heart', null, 9, 9) ->> 'result',
          'name_taken', 'nor recorded');
select is(public.mod_studio_put_art((select id from ids where name = 'pack'), 'blue-heart-2', 'Heart', 9, 9) ->> 'result',
          'added', 'a published pack takes new art under a new name');

-- ---------------------------------------------------------------- audit
select tests.reset_role();
select results_eq(
  $$select action from public.audit_log
    where actor_id = tests.id('moderator') and data ->> 'pack' = 't102-new' order by id$$,
  $$values ('studio_pack_create'), ('studio_pack_edit'), ('studio_sticker_add'), ('studio_sticker_replace'),
           ('studio_sticker_edit'), ('studio_sticker_retire'), ('studio_sticker_restore'), ('studio_pack_publish'),
           ('studio_sticker_add')$$,
  'every change is in the audit log, in order');
select is((select data ->> 'sticker' from public.audit_log
           where actor_id = tests.id('moderator') and action = 'studio_sticker_edit'), 'blue-heart',
          'audit rows name the sticker');
select is((select count(*)::int from public.audit_log where data ->> 'pack' in ('t102-prem', 't102-owner', 't102-ghost')),
          0, 'refused calls write nothing');

select * from finish();
rollback;
