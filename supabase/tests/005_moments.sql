-- M1-09 (0004): moments guard (S-2), pending content (G-12), slot moves, backfill from ends_at.
begin;
\ir _helpers.psql
select plan(43);

select tests.world();
create temp table t (k text primary key, id uuid);
grant select on t to authenticated, anon, service_role;
insert into t values ('today', tests.make_jar('owner', 'readers', published => true));
insert into t values ('yesterday', tests.make_jar('owner', 'readers', published => true, p_days_ago => 1));
insert into t values ('other', tests.make_jar('outsider', 'everyone', published => true));
insert into t values ('live', tests.make_moment((select id from t where k = 'today'), 'morning', 'live'));
insert into t values ('checking', tests.make_moment((select id from t where k = 'today'), 'afternoon', 'checking'));
insert into t values ('removed', tests.make_moment((select id from t where k = 'today'), 'evening', 'removed'));
insert into t values ('uploading', tests.make_moment((select id from t where k = 'today'), 'ootd', 'uploading'));
update public.moments set caption = 'original' where id = (select id from t where k = 'live');

-- ---------------------------------------------------------------- one moment per slot (FR-JAR-03)
select tests.act_as('owner');
select throws_ok(format('insert into public.moments (jar_id, user_id, slot, status) values (%L, auth.uid(), ''morning'', ''checking'')',
                        (select id from t where k = 'today')),
                 '23505', null, 'a second moment in a filled slot is refused');
select lives_ok(format('insert into public.moments (jar_id, user_id, slot, status) values (%L, auth.uid(), ''selfie'', ''checking'')',
                       (select id from t where k = 'today')),
                'control: an empty slot accepts a moment');

-- ---------------------------------------------------------------- status transitions (FR-PUB-07)
select throws_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'checking')$$,
                 '42501', 'status can only be set by the server', 'owner cannot set a checking moment live');
select throws_ok($$update public.moments set status = 'removed' where id = (select id from t where k = 'live')$$,
                 '42501', null, 'owner cannot set removed');
select throws_ok($$update public.moments set status = 'checking' where id = (select id from t where k = 'removed')$$,
                 '42501', null, 'owner cannot move a removed moment back to checking');
select throws_ok($$update public.moments set status = 'checking' where id = (select id from t where k = 'live')$$,
                 '42501', null, 'owner cannot move a live moment back to checking');
select throws_ok($$update public.moments set status = 'uploading' where id = (select id from t where k = 'checking')$$,
                 '42501', null, 'owner cannot move a checking moment back to uploading');
select lives_ok($$update public.moments set status = 'checking' where id = (select id from t where k = 'uploading')$$,
                'owner can submit an uploaded moment for checking');
select throws_ok(format('insert into public.moments (jar_id, user_id, slot, status) values (%L, auth.uid(), ''whereami'', ''live'') returning *',
                        (select id from t where k = 'today')),
                 '42501', null, 'insert ... returning * is refused (no SELECT on pending_* columns)');
insert into public.moments (jar_id, user_id, slot, status, like_count, pending_caption, pending_since)
  select id, auth.uid(), 'whereami', 'live', 99, 'sneaky', now() from t where k = 'today';
select tests.reset_role();
select is((select status::text || '/' || like_count || '/' || coalesce(pending_caption, '-') from public.moments
           where jar_id = (select id from t where k = 'today') and slot = 'whereami'),
          'uploading/0/-', 'a client insert cannot start live, forge likes or plant pending content');

select tests.act_as_service();
select lives_ok($$update public.moments set status = 'live' where id = (select id from t where k = 'checking')$$,
                'the server can set a moment live');
update public.moments set status = 'checking' where id = (select id from t where k = 'checking');

-- ---------------------------------------------------------------- pending content (G-12)
select tests.act_as('owner');
select lives_ok($$update public.moments set caption = 'new words' where id = (select id from t where k = 'live')$$,
                'owner can change the caption of a live moment');
select tests.reset_role();
select is((select caption from public.moments where id = (select id from t where k = 'live')), 'original',
          'the live caption is unchanged');
select is((select pending_caption from public.moments where id = (select id from t where k = 'live')), 'new words',
          'the new caption waits in pending_caption');
select ok((select pending_since is not null and status = 'live' from public.moments where id = (select id from t where k = 'live')),
          'pending_since is set and the moment stays live');
select is((select pending_photo_path = photo_path from public.moments where id = (select id from t where k = 'live')), true,
          'the proposal carries the unchanged photo');

select tests.act_as('owner');
update public.moments set photo_path = 'p/replacement', thumb_path = 't/replacement' where id = (select id from t where k = 'live');
select tests.reset_role();
select is((select array[pending_photo_path, pending_thumb_path, pending_caption] from public.moments where id = (select id from t where k = 'live')),
          array['p/replacement', 't/replacement', 'new words'], 'a second edit keeps the earlier pending caption and adds the new photo');
select isnt((select photo_path from public.moments where id = (select id from t where k = 'live')), 'p/replacement',
            'the live photo is still the old one (Replace keeps it until approval)');

select tests.act_as('reader');
select is((select caption from public.moments where id = (select id from t where k = 'live')), 'original', 'a reader sees the live caption');
select throws_ok($$select pending_caption from public.moments$$, '42501', null, 'a reader cannot select pending_caption');
select throws_ok($$select * from public.moments$$, '42501', null, 'select * on moments is refused (pending_* hidden)');
select is((select count(*) from public.my_pending_moments()), 0::bigint, 'my_pending_moments() shows a reader nothing of the owner''s');

select tests.act_as('owner');
select is((select pending_caption from public.my_pending_moments() where moment_id = (select id from t where k = 'live')), 'new words',
          'the owner reads the pending caption through my_pending_moments()');
select throws_ok($$update public.moments set pending_caption = 'skip the check' where id = (select id from t where k = 'live')$$,
                 '42501', null, 'owner cannot write pending_* directly');
select throws_ok($$update public.moments set pending_since = null where id = (select id from t where k = 'live')$$,
                 '42501', null, 'owner cannot clear pending_since');

-- A checking moment also goes through pending, so moderation never approves content it didn't score.
update public.moments set caption = 'changed while checking' where id = (select id from t where k = 'checking');
select tests.reset_role();
select is((select coalesce(caption, '-') || ' | ' || pending_caption from public.moments where id = (select id from t where k = 'checking')),
          '- | changed while checking', 'editing a checking moment also writes pending_*');

select tests.act_as('owner');
select throws_ok($$update public.moments set caption = 'try again' where id = (select id from t where k = 'removed')$$,
                 '42501', 'a removed moment cannot be edited', 'owner cannot edit a removed moment');
-- Not submitted yet: edits apply in place.
update public.moments set caption = 'before submit' where jar_id = (select id from t where k = 'today') and slot = 'whereami';
select tests.reset_role();
select is((select caption from public.moments where jar_id = (select id from t where k = 'today') and slot = 'whereami'), 'before submit',
          'an uploading moment is edited in place');

-- The server swaps an approved proposal in.
select tests.act_as_service();
select lives_ok($$update public.moments set photo_path = pending_photo_path, thumb_path = pending_thumb_path, caption = pending_caption,
                  edits = pending_edits, pending_photo_path = null, pending_thumb_path = null, pending_caption = null,
                  pending_edits = null, pending_since = null where id = (select id from t where k = 'live')$$,
                'the server can swap the pending version in');
select tests.act_as('reader');
select is((select caption from public.moments where id = (select id from t where k = 'live')), 'new words', 'after approval readers see the new caption');

-- Likes are server-owned.
select tests.act_as('owner');
select throws_ok($$update public.moments set like_count = 500 where id = (select id from t where k = 'live')$$, '42501', null,
                 'owner cannot fake like_count');

-- ---------------------------------------------------------------- slot moves (FR-CAP-10)
select lives_ok($$update public.moments set slot = 'mebusywith' where id = (select id from t where k = 'live')$$,
                'owner can move a moment to an empty slot in the same jar');
select throws_ok($$update public.moments set slot = 'afternoon' where id = (select id from t where k = 'live')$$,
                 '23505', null, 'moving to a filled slot is refused');
select throws_ok($$update public.moments set jar_id = (select id from t where k = 'yesterday') where id = (select id from t where k = 'live')$$,
                 '42501', 'a moment cannot move to another jar', 'moving to another of the owner''s jars is refused');
select throws_ok($$update public.moments set jar_id = (select id from t where k = 'other') where id = (select id from t where k = 'live')$$,
                 '42501', null, 'moving into someone else''s jar is refused');
select tests.act_as_service();
select throws_ok($$update public.moments set jar_id = (select id from t where k = 'yesterday') where id = (select id from t where k = 'live')$$,
                 '42501', null, 'jar_id is locked for the server too');
select tests.reset_role();
select is((select array[moment_count, visible_count]::int[] from public.jars where id = (select id from t where k = 'today')), array[5, 1],
          'counts are unchanged by slot moves and pending edits (5 non-removed, 1 live public)');

-- Other users can't touch the owner's moments.
select tests.act_as('outsider');
update public.moments set slot = 'selfie', is_private = true where id = (select id from t where k = 'live');
select tests.act_as('blocked');
update public.moments set is_private = true where id = (select id from t where k = 'live');
select tests.act_as('moderator');
update public.moments set is_private = true where id = (select id from t where k = 'live');
delete from public.moments where id = (select id from t where k = 'live');
select tests.reset_role();
select is((select slot::text || '/' || is_private from public.moments where id = (select id from t where k = 'live')), 'mebusywith/false',
          'outsider, blocked user and moderator updates and deletes touch no rows');

-- ---------------------------------------------------------------- backfill uses ends_at and server time (FR-JAR-06)
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, status, is_backfilled, added_at)
  select id, auth.uid(), 'morning', 'checking', false, now() - interval '2 days' from t where k = 'yesterday';
select tests.reset_role();
select is((select is_backfilled from public.moments where jar_id = (select id from t where k = 'yesterday') and slot = 'morning'), true,
          'a moment added after its jar''s ends_at is backfilled even if the client says otherwise');
select ok((select added_at > now() - interval '1 minute' from public.moments where jar_id = (select id from t where k = 'yesterday') and slot = 'morning'),
          'added_at is server time, not the client''s');
select is((select is_backfilled from public.moments where jar_id = (select id from t where k = 'today') and slot = 'whereami'), false,
          'a moment in today''s open jar is not backfilled');
select tests.act_as('owner');
update public.moments set is_backfilled = false, added_at = now() - interval '3 days'
  where jar_id = (select id from t where k = 'yesterday') and slot = 'morning';
select tests.reset_role();
select is((select is_backfilled from public.moments where jar_id = (select id from t where k = 'yesterday') and slot = 'morning'), true,
          'is_backfilled and added_at cannot be changed afterwards');
-- Westward travel: the server moves yesterday's ends_at past now, so a new moment isn't badged.
select tests.act_as_service();
update public.jars set ends_at = now() + interval '2 hours' where id = (select id from t where k = 'yesterday');
select tests.act_as('owner');
insert into public.moments (jar_id, user_id, slot, status) select id, auth.uid(), 'evening', 'checking' from t where k = 'yesterday';
select tests.reset_role();
select is((select is_backfilled from public.moments where jar_id = (select id from t where k = 'yesterday') and slot = 'evening'), false,
          'with ends_at moved later, a moment before the new ends_at is not backfilled');

select * from finish();
rollback;
