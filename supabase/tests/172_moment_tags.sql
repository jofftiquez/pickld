-- 0172: Mention stickers and caption @mentions. Only mutual readers can be tagged (tried as owner with a mutual
-- reader, a one-way reader, an outsider and a blocked user); tags are visible to the owner, the tagged person and
-- people who can see the moment, never to the blocked; the tagged person is told once, when the moment is live and
-- not Only me, unless they muted the author; they can take the tag off; a block takes it off.
begin;
\ir _helpers.psql
select plan(32);

select tests.world();
select tests.create_user('pal');   -- mutual reader who mutes owner
select tests.create_user('fan');   -- reads owner; owner doesn't read back
insert into public.follows (reader_id, author_id) values
  (tests.id('owner'), tests.id('reader')),
  (tests.id('owner'), tests.id('pal')), (tests.id('pal'), tests.id('owner')),
  (tests.id('fan'), tests.id('owner'));
insert into public.mutes (muter_id, muted_id) values (tests.id('pal'), tests.id('owner'));

create temp table t (k text primary key, id uuid not null);
grant select on t to authenticated, anon, service_role;
insert into t values ('jar', tests.make_jar('owner', 'readers', published => true));

create function pg_temp.mention(p_name text, p_id text default null) returns jsonb language sql as $$
  select jsonb_build_object('type', 'mention', 'id', 'm-' || p_name, 'x', 0.5, 'y', 0.5, 'scale', 0.3, 'rotation', 0,
                            'userId', coalesce(p_id, tests.id(p_name)::text), 'username', 'wrong_name', 'color', 'white')
$$;
create function pg_temp.edits(variadic o jsonb[]) returns jsonb language sql as $$
  select jsonb_build_object('v', 1, 'filter', 'original', 'overlays', to_jsonb(o))
$$;
create function pg_temp.tagged(p_moment uuid) returns text language sql as $$
  select coalesce(string_agg(u.name, ',' order by u.name), '') from public.moment_tags mt
  join tests.users u on u.id = mt.tagged_id where mt.moment_id = p_moment
$$;
create function pg_temp.stickers(p_edits jsonb) returns text language sql as $$
  select coalesce(string_agg(o ->> 'username', ',' order by o ->> 'username'), '')
  from jsonb_array_elements(p_edits -> 'overlays') o where o ->> 'type' = 'mention'
$$;
create function pg_temp.tag_notes(p_name text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = tests.id(p_name) and type = 'tag'
$$;

-- ---------------------------------------------------------------- schema and privileges
select has_table('public', 'moment_tags', 'moment_tags exists');
select ok(not has_table_privilege('anon', 'public.moment_tags', 'select'), 'anon cannot read tags');
select ok(not has_table_privilege('authenticated', 'public.moment_tags', 'insert'), 'nobody writes tags directly');

-- ---------------------------------------------------------------- who can be tagged
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, status, edits, caption)
values ((select id from t where k = 'jar'), auth.uid(), 'morning', 'p/x', 't/x', 'checking',
        pg_temp.edits(pg_temp.mention('reader'), pg_temp.mention('fan'), pg_temp.mention('outsider'),
                      pg_temp.mention('blocked'), pg_temp.mention('x', 'not-a-uuid'),
                      '{"type":"text","id":"t1","x":0.5,"y":0.5,"scale":0.5,"rotation":0}'::jsonb),
        'with @t_outsider and @t_pal.');
select tests.reset_role();
insert into t select 'm', id from public.moments where jar_id = (select id from t where k = 'jar') and slot = 'morning';
select is(pg_temp.stickers((select edits from public.moments where id = (select id from t where k = 'm'))),
          't_reader', 'only the mutual reader''s sticker is kept, with their real username');
select is(jsonb_array_length((select edits -> 'overlays' from public.moments where id = (select id from t where k = 'm'))),
          2, 'other overlays are untouched');
select is((select caption from public.moments where id = (select id from t where k = 'm')), 'with @t_outsider and @t_pal.',
          'the caption''s words are never changed');
select is(pg_temp.tagged((select id from t where k = 'm')), 'pal,reader',
          'tags: the sticker''s mutual reader and the caption''s mutual reader (a full stop ends the name); not the outsider');

-- ---------------------------------------------------------------- the notification
select is(pg_temp.tag_notes('reader'), 0, 'checking: nobody is told yet');
select tests.set_status((select id from t where k = 'm'), 'live');
select is(pg_temp.tag_notes('reader'), 1, 'live: the tagged person is told');
select is(pg_temp.tag_notes('pal'), 0, 'a tagged person who muted the author isn''t told');
select tests.act_as('owner');
update public.moments set caption = 'still with @t_pal and @t_reader' where id = (select id from t where k = 'm');
select tests.reset_role();
select tests.set_status((select id from t where k = 'm'), 'live');
select is(pg_temp.tag_notes('reader'), 1, 'told once only');

insert into t values ('private', tests.make_moment((select id from t where k = 'jar'), 'selfie', 'live', p_private => true));
update public.moments set edits = pg_temp.edits(pg_temp.mention('reader')) where id = (select id from t where k = 'private');
select is(pg_temp.tagged((select id from t where k = 'private')), 'reader', 'Only me moments can carry a tag');
select is(pg_temp.tag_notes('reader'), 1, 'but an Only me moment never notifies');

-- ---------------------------------------------------------------- a live moment's edit is a proposal; it is checked too
select tests.act_as('owner');
update public.moments set edits = pg_temp.edits(pg_temp.mention('reader'), pg_temp.mention('outsider'))
where id = (select id from t where k = 'm');
select tests.reset_role();
select is(pg_temp.stickers((select pending_edits from public.moments where id = (select id from t where k = 'm'))),
          't_reader', 'a proposed edit keeps only allowed stickers');

-- ---------------------------------------------------------------- who sees a tag
select tests.act_as('owner');
select is((select count(*)::int from public.moment_tags where moment_id = (select id from t where k = 'm')), 2, 'the owner sees both tags');
select tests.act_as('reader');
select is((select count(*)::int from public.moment_tags where moment_id = (select id from t where k = 'm')), 2,
          'a reader of the owner sees them');
select tests.act_as('fan');
select is((select count(*)::int from public.moment_tags where moment_id = (select id from t where k = 'm')), 2,
          'a one-way reader who can see the moment sees them');
select tests.act_as('outsider');
select is((select count(*)::int from public.moment_tags), 0, 'an outsider who can''t see the moment sees no tags');
select tests.act_as('blocked');
select is((select count(*)::int from public.moment_tags), 0, 'someone the owner blocked sees no tags');
select tests.reset_role();
insert into public.blocks (blocker_id, blocked_id) values (tests.id('fan'), tests.id('reader'));
select tests.act_as('fan');
select is((select count(*)::int from public.moment_tags where moment_id = (select id from t where k = 'm')), 1,
          'a viewer blocked with the tagged person doesn''t see that tag');
select tests.reset_role();
delete from public.blocks where blocker_id = tests.id('fan');

-- ---------------------------------------------------------------- taggable_people
select tests.act_as('owner');
select is((select string_agg(username, ',' order by username) from public.taggable_people('')), 't_pal,t_reader',
          'the Mention tool offers only mutual readers');
select is((select string_agg(username, ',') from public.taggable_people('@t_re')), 't_reader', 'searching by username');
select tests.act_as('outsider');
select is((select count(*)::int from public.taggable_people('')), 0, 'an outsider has nobody to tag');

-- ---------------------------------------------------------------- the tagged person takes it off
select tests.act_as('outsider');
select public.remove_moment_tag((select id from t where k = 'm'));
select tests.act_as('reader');
select public.remove_moment_tag((select id from t where k = 'm'));
select tests.reset_role();
select is(pg_temp.stickers((select edits from public.moments where id = (select id from t where k = 'm'))), '',
          'removed: the sticker leaves the moment');
select is(pg_temp.stickers((select pending_edits from public.moments where id = (select id from t where k = 'm'))), '',
          'and leaves the proposed edit');
select is(pg_temp.tag_notes('reader'), 0, 'and its notification goes');
select tests.act_as('owner');
select is((select count(*)::int from public.moment_tags where moment_id = (select id from t where k = 'm')), 1,
          'the owner no longer sees that tag (an outsider''s call changed nothing else)');
update public.moments set edits = pg_temp.edits(pg_temp.mention('reader')) where id = (select id from t where k = 'm');
select tests.reset_role();
select is(pg_temp.stickers((select pending_edits from public.moments where id = (select id from t where k = 'm'))), '',
          'the owner can''t tag them on that moment again');

-- ---------------------------------------------------------------- a block takes tags off
insert into t values ('m2', tests.make_moment((select id from t where k = 'jar'), 'evening', 'live'));
update public.moments set edits = pg_temp.edits(pg_temp.mention('pal')) where id = (select id from t where k = 'm2');
select is(pg_temp.tagged((select id from t where k = 'm2')), 'pal', 'control: pal is tagged');
insert into public.blocks (blocker_id, blocked_id) values (tests.id('pal'), tests.id('owner'));
select is(pg_temp.stickers((select edits from public.moments where id = (select id from t where k = 'm2'))), '',
          'a block takes the sticker off');
select tests.act_as('owner');
select is((select count(*)::int from public.moment_tags where tagged_id = tests.id('pal')), 0,
          'and every tag between the two');
select tests.reset_role();

-- ---------------------------------------------------------------- the push switch
select tests.act_as('reader');
select lives_ok($$update public.notification_prefs set tag = false where user_id = auth.uid()$$, 'the Tags push switch can be turned off');
select tests.reset_role();

select * from finish();
rollback;
