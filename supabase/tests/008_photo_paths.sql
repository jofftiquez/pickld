-- M1-16 (0007): moment_photo_paths() returns paths only for moments the caller can view, plus queued
-- moments for moderators (NFR-SEC-02, FR-PUB-05, FR-MOD-03).
begin;
\ir _helpers.psql
select plan(68);

select tests.world();
create temp table m (name text primary key, id uuid not null, sees text[] not null);
grant select on m to authenticated, anon, service_role;

create temp table j (k text primary key, id uuid);
insert into j values
  ('readers',     tests.make_jar('owner', 'readers',  published => true, p_days_ago => 1)),
  ('everyone',    tests.make_jar('owner', 'everyone', published => true, p_days_ago => 2)),
  ('only_me',     tests.make_jar('owner', 'only_me',  published => true, p_days_ago => 3)),
  ('unpublished', tests.make_jar('owner', 'everyone', published => false));
create function pg_temp.j(p text) returns uuid language sql as $$ select id from j where k = p $$;

insert into m values
  ('live in readers',         tests.make_moment(pg_temp.j('readers'), 'morning', 'live'),                    '{owner,reader}'),
  ('live in everyone',        tests.make_moment(pg_temp.j('everyone'), 'morning', 'live'),                   '{owner,reader,outsider,moderator}'),
  ('private',                 tests.make_moment(pg_temp.j('everyone'), 'evening', 'live', p_private => true), '{owner}'),
  ('checking',                tests.make_moment(pg_temp.j('everyone'), 'afternoon', 'checking'),             '{owner}'),
  ('removed',                 tests.make_moment(pg_temp.j('everyone'), 'ootd', 'removed'),                   '{owner}'),
  ('live in only_me',         tests.make_moment(pg_temp.j('only_me'), 'morning', 'live'),                    '{owner}'),
  ('live in unpublished',     tests.make_moment(pg_temp.j('unpublished'), 'morning', 'live'),                '{owner}'),
  -- queued for moderation: the moderator sees these too
  ('checking, queued',        tests.make_moment(pg_temp.j('readers'), 'afternoon', 'checking'),              '{owner,moderator}'),
  ('removed, open appeal',    tests.make_moment(pg_temp.j('readers'), 'ootd', 'removed'),                    '{owner,moderator}'),
  ('removed, appeal decided', tests.make_moment(pg_temp.j('readers'), 'selfie', 'removed'),                  '{owner}');

insert into public.moderation_items (id, moment_id, source, status) values
  ('a8000000-0000-4000-8000-000000000001', (select id from m where name = 'checking, queued'), 'auto_check', 'pending'),
  ('a8000000-0000-4000-8000-000000000002', (select id from m where name = 'removed, open appeal'), 'auto_check', 'removed'),
  ('a8000000-0000-4000-8000-000000000003', (select id from m where name = 'removed, appeal decided'), 'auto_check', 'removed'),
  ('a8000000-0000-4000-8000-000000000004', (select id from m where name = 'checking'), 'auto_check', 'kept');
insert into public.appeals (moderation_item_id, user_id, status) values
  ('a8000000-0000-4000-8000-000000000002', tests.id('owner'), 'open'),
  ('a8000000-0000-4000-8000-000000000003', tests.id('owner'), 'decided');

create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5), ('moderator', 6);
grant select on roles to authenticated, anon, service_role;

create function pg_temp.gets(who text, mid uuid) returns boolean language plpgsql as $$
declare r boolean;
begin
  perform tests.act_as(who);
  select exists (select 1 from public.moment_photo_paths(array[mid])) into r;
  perform tests.reset_role();
  return r;
end $$;

-- one test per moment and role
select is(pg_temp.gets(r.role, x.id), r.role = any (x.sees),
          format('%s: %s %s', x.name, r.role, case when r.role = any (x.sees) then 'gets paths' else 'gets nothing' end))
from m x cross join roles r order by x.name, r.ord;

-- anon cannot call it at all
select tests.act_as_anon();
select throws_ok($$select * from public.moment_photo_paths(array[gen_random_uuid()])$$, '42501', null, 'anon cannot call moment_photo_paths');
select tests.reset_role();

-- a batch returns only the visible ones
select tests.act_as('reader');
select is((select count(*) from public.moment_photo_paths(array(select id from m))), 2::bigint,
          'a batch with every moment returns only the two the reader can view');
select tests.reset_role();

-- pending paths: an edit awaiting moderation goes to the owner and moderators only
update public.moments set pending_photo_path = 'pending/full', pending_thumb_path = 'pending/thumb', pending_since = now()
where id = (select id from m where name = 'live in everyone');
insert into public.moderation_items (moment_id, source, status)
values ((select id from m where name = 'live in everyone'), 'auto_check', 'pending');
select tests.act_as('reader');
select is((select array[pending_photo_path, pending_thumb_path] from public.moment_photo_paths(array[(select id from m where name = 'live in everyone')])),
          array[null, null]::text[], 'a reader gets the live paths but never the pending ones');
select tests.act_as('owner');
select is((select pending_photo_path from public.moment_photo_paths(array[(select id from m where name = 'live in everyone')])),
          'pending/full', 'the owner gets the pending paths');
select tests.act_as('moderator');
select is((select pending_thumb_path from public.moment_photo_paths(array[(select id from m where name = 'live in everyone')])),
          'pending/thumb', 'a moderator gets the pending paths of a queued moment');
select tests.reset_role();

-- suspended owner (D-11): nobody else gets paths
update public.profiles set status = 'suspended' where id = tests.id('owner');
select is(pg_temp.gets('reader', (select id from m where name = 'live in readers')), false, 'suspended owner: the reader gets nothing');
select is(pg_temp.gets('owner', (select id from m where name = 'live in readers')), true, 'suspended owner: the owner still gets their paths');

-- batch limit
select tests.act_as('owner');
select throws_ok($$select * from public.moment_photo_paths(array(select gen_random_uuid() from generate_series(1, 101)))$$,
                 '22023', 'at most 100 moments per call', 'more than 100 ids are refused');

select * from finish();
rollback;
