-- M1-07 (0002): profile column guard (S-1), birthday privacy (S-4), notifications (S-13), is_active_user.
begin;
\ir _helpers.psql
select plan(40);

select tests.world();

-- ---------------------------------------------------------------- S-1 owner edits
select tests.act_as('owner');
select lives_ok($$update public.profiles set display_name = 'Owner Renamed', bio = 'new bio', lid_color = '#123456',
                  home_tz = 'Europe/London', default_visibility = 'everyone', username = 't_owner2'
                  where id = auth.uid()$$,
                'owner can edit profile fields');
select is((select display_name from public.profiles where id = tests.id('owner')), 'Owner Renamed', 'the edit is saved');

select throws_ok($$update public.profiles set status = 'deleted' where id = auth.uid()$$, '42501', 'only profile fields can be changed',
                 'owner cannot write status');
select throws_ok($$update public.profiles set reader_count = 9999 where id = auth.uid()$$, '42501', null, 'owner cannot write reader_count');
select throws_ok($$update public.profiles set author_count = 9999 where id = auth.uid()$$, '42501', null, 'owner cannot write author_count');
select throws_ok($$update public.profiles set jar_count = 9999 where id = auth.uid()$$, '42501', null, 'owner cannot write jar_count');
select throws_ok($$update public.profiles set created_at = now() - interval '5 years' where id = auth.uid()$$, '42501', null,
                 'owner cannot write created_at');
select throws_ok($$update public.profiles set birthday = '2000-01-01' where id = auth.uid()$$, '42501', null,
                 'owner cannot change birthday after sign-up');

-- A suspended owner cannot reactivate themselves (the S-1 exploit).
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('owner');
select tests.act_as('owner');
select throws_ok($$update public.profiles set status = 'active' where id = auth.uid()$$, '42501', null,
                 'suspended owner cannot set status back to active');
select tests.reset_role();
select is((select status::text from public.profiles where id = tests.id('owner')), 'suspended', 'status is still suspended');
update public.profiles set status = 'active' where id = tests.id('owner');

-- Other users cannot edit the owner's profile at all.
select tests.act_as('outsider');
update public.profiles set display_name = 'hacked' where id = tests.id('owner');
select tests.reset_role();
select is((select display_name from public.profiles where id = tests.id('owner')), 'Owner Renamed', 'outsider update touches no rows');

-- The server (service_role) can still change status and counters.
select tests.act_as_service();
select lives_ok($$update public.profiles set status = 'suspended', reader_count = 3 where id = (select id from tests.users where name = 'outsider')$$,
                'service_role can change status and counters');
select tests.reset_role();
update public.profiles set status = 'active', reader_count = 0 where id = tests.id('outsider');

-- Insert: a new profile always starts active, with zero counters and server time, whatever the client sends.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated',
        'newbie@tests.pickld.test', '', '{}', '{}', now(), now());
insert into tests.users (name, id) values ('newbie', 'f0000000-0000-4000-8000-0000000000aa');
select tests.act_as('newbie');
select lives_ok($$insert into public.profiles (id, username, display_name, birthday, status, reader_count, author_count, jar_count, created_at)
                  values (auth.uid(), 't_newbie', 'Newbie', '2000-02-02', 'active', 500, 500, 500, '2001-01-01')$$,
                'a new user can create their profile');
select tests.reset_role();
select is((select array[reader_count, author_count, jar_count] from public.profiles where id = tests.id('newbie')), array[0, 0, 0],
          'forged counters are reset to zero on insert');
select ok((select created_at > now() - interval '1 minute' from public.profiles where id = tests.id('newbie')),
          'created_at on insert is server time');
select tests.act_as('outsider');
select throws_ok($$insert into public.profiles (id, username, display_name, birthday) values (gen_random_uuid(), 't_fake', 'Fake', '2000-01-01')$$,
                 '42501', null, 'a user cannot create a profile for another id');
select throws_ok($$insert into public.profiles (id, username, display_name, birthday) values (auth.uid(), 't_young', 'Young', current_date - interval '12 years')$$,
                 '23514', null, 'under-13 birthday is refused (S-15 check still works)');

-- ---------------------------------------------------------------- S-4 birthday
select tests.act_as('owner');
select throws_ok($$select birthday from public.profiles where id = auth.uid()$$, '42501', null, 'owner cannot select birthday directly');
select throws_ok($$select * from public.profiles where id = auth.uid()$$, '42501', null, 'select * (which includes birthday) is refused');
select is((select birthday from public.my_profile()), date '1995-05-05', 'owner reads birthday through my_profile()');
select is((select count(*) from public.my_profile()), 1::bigint, 'my_profile() returns exactly the caller''s row');

select tests.act_as('reader');
select throws_ok(format('select birthday from public.profiles where id = %L', tests.id('owner')), '42501', null,
                 'reader cannot select the owner''s birthday');
select is((select id from public.my_profile()), tests.id('reader'), 'my_profile() for reader returns the reader, never the owner');
select is((select display_name from public.profiles where id = tests.id('owner')), 'Owner Renamed', 'reader can read the owner''s public fields');
select is((select display_name from public.public_profiles where id = tests.id('owner')), 'Owner Renamed', 'public_profiles view still works');

select tests.act_as_anon();
select throws_ok($$select display_name from public.profiles$$, '42501', null, 'anon cannot read the profiles table');
select throws_ok($$select * from public.my_profile()$$, '42501', null, 'anon cannot call my_profile()');

-- ---------------------------------------------------------------- blocks hide profiles both ways
select tests.act_as('blocked');
select is((select count(*) from public.profiles where id = tests.id('owner')), 0::bigint, 'blocked user cannot read the blocker''s profile');
select tests.act_as('owner');
select is((select count(*) from public.profiles where id = tests.id('blocked')), 0::bigint, 'blocker cannot read the blocked user''s profile');
select is((select count(*) from public.profiles where id = tests.id('blocker')), 0::bigint, 'owner cannot read someone who blocked them');
select is((select count(*) from public.profiles where id = tests.id('outsider')), 1::bigint, 'control: owner reads an unrelated profile');

-- ---------------------------------------------------------------- S-13 notifications
-- world() created new_reader notifications for owner (from reader; blocked/blocker follows were dropped by blocks).
select tests.act_as('owner');
select lives_ok($$update public.notifications set read_at = now() where user_id = auth.uid()$$, 'owner can mark notifications read');
select ok((select bool_and(read_at is not null) from public.notifications where user_id = tests.id('owner')), 'read_at is set');
select throws_ok($$update public.notifications set type = 'like' where user_id = auth.uid()$$, '42501', null,
                 'owner cannot change other notification columns');
select throws_ok($$insert into public.notifications (user_id, type) values (auth.uid(), 'like')$$, '42501', null,
                 'owner cannot insert notifications');
select tests.act_as('reader');
update public.notifications set read_at = null where user_id = tests.id('owner');
select tests.act_as('owner');
select ok((select bool_and(read_at is not null) from public.notifications where user_id = tests.id('owner')),
          'another user cannot change the owner''s notifications');

-- ---------------------------------------------------------------- is_active_user
select tests.reset_role();
update public.profiles set status = 'suspended' where id = tests.id('outsider');
select tests.act_as('outsider');
select is(public.is_active_user(), false, 'is_active_user() is false for a suspended user');
select tests.act_as('reader');
select is(public.is_active_user(), true, 'is_active_user() is true for an active user');

-- ---------------------------------------------------------------- truncate (bypasses RLS) is not granted
select tests.act_as('owner');
select throws_ok($$truncate public.audit_log$$, '42501', null, 'clients cannot truncate audit_log');
select tests.act_as_anon();
select throws_ok($$truncate public.jars cascade$$, '42501', null, 'anon cannot truncate jars');

select * from finish();
rollback;
