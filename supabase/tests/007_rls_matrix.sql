-- M1-11: the full visibility matrix (FR-PUB-02, FR-PUB-03, FR-PUB-05, FR-PUB-06, FR-PUB-07, NFR-SEC-01).
-- Every object below is tried as every role, one test per pair. A row lists exactly who may see the
-- object; everyone else must not. Any leak (or any over-strict rule) fails CI.
--
-- Roles (tests.world()): owner, reader (follows owner), outsider, blocked (owner blocked them),
-- blocker (blocked owner), moderator, anon. Then the owner is suspended and the owner's jars, moments
-- and profile are tried again (D-11: only the owner still sees them).
begin;
\ir _helpers.psql
select plan(345);

select tests.world();

-- ---------------------------------------------------------------- tests.can_see
-- Runs the lookup as `who` (a world user or 'anon'), so the policies see exactly what a request
-- would. A permission error counts as "not visible". kind picks the table; id identifies the row:
--   jar, moment, comment, notification, moderation_item, report, profile: the row's id
--   reaction: target_id (each target in this file has one reaction)
--   follow:   reader_id of a follow of the owner ('follow of outsider': of the outsider)
--   block:    blocker_id (each blocker in this file has one block)
create function tests.can_see(kind text, who text, id uuid) returns boolean
language plpgsql as $$
declare
  q text := case kind
    when 'jar' then 'select exists (select 1 from public.jars where id = $1)'
    when 'moment' then 'select exists (select 1 from public.moments where id = $1)'
    when 'comment' then 'select exists (select 1 from public.comments where id = $1)'
    when 'reaction' then 'select exists (select 1 from public.reactions where target_id = $1)'
    when 'follow' then 'select exists (select 1 from public.follows where reader_id = $1 and author_id = $2)'
    when 'follow of outsider' then 'select exists (select 1 from public.follows where reader_id = $1 and author_id = $3)'
    when 'block' then 'select exists (select 1 from public.blocks where blocker_id = $1)'
    when 'profile' then 'select exists (select 1 from public.profiles where id = $1)'
    when 'notification' then 'select exists (select 1 from public.notifications where id = $1)'
    when 'moderation_item' then 'select exists (select 1 from public.moderation_items where id = $1)'
    when 'report' then 'select exists (select 1 from public.reports where id = $1)'
  end;
  owner_id uuid := tests.id('owner');
  outsider_id uuid := tests.id('outsider');
  seen boolean;
begin
  if q is null then raise exception 'tests.can_see: unknown kind %', kind; end if;
  begin
    if who = 'anon' then perform tests.act_as_anon(); else perform tests.act_as(who); end if;
    execute q into seen using id, owner_id, outsider_id;
  exception when insufficient_privilege then
    seen := false;
  end;
  perform tests.reset_role();
  return seen;
end $$;

-- ---------------------------------------------------------------- objects
create temp table obj (name text primary key, kind text not null, id uuid not null, sees text[] not null);
create temp table roles (role text primary key, ord int);
insert into roles values ('owner', 1), ('reader', 2), ('outsider', 3), ('blocked', 4), ('blocker', 5),
                         ('moderator', 6), ('anon', 7);

-- jars, one per state
insert into obj values
  ('jar unpublished',   'jar', tests.make_jar('owner', 'readers',  published => false),                  '{owner}'),
  ('jar readers',       'jar', tests.make_jar('owner', 'readers',  published => true, p_days_ago => 1),  '{owner,reader}'),
  ('jar everyone',      'jar', tests.make_jar('owner', 'everyone', published => true, p_days_ago => 2),  '{owner,reader,outsider,moderator}'),
  ('jar only_me',       'jar', tests.make_jar('owner', 'only_me',  published => true, p_days_ago => 3),  '{owner}'),
  ('outsider jar',      'jar', tests.make_jar('outsider', 'everyone', published => true),                '{owner,reader,outsider,blocked,blocker,moderator}');

create function pg_temp.o(p text) returns uuid language sql as $$ select id from obj where name = p $$;

-- moments: each status in the Readers jar, and a live moment in every jar state
insert into obj values
  ('moment live',                'moment', tests.make_moment(pg_temp.o('jar readers'), 'morning', 'live'),                       '{owner,reader}'),
  ('moment private',             'moment', tests.make_moment(pg_temp.o('jar readers'), 'evening', 'live', p_private => true),    '{owner}'),
  ('moment checking',            'moment', tests.make_moment(pg_temp.o('jar readers'), 'afternoon', 'checking'),                 '{owner}'),
  ('moment removed',             'moment', tests.make_moment(pg_temp.o('jar readers'), 'ootd', 'removed'),                       '{owner}'),
  ('moment uploading',           'moment', tests.make_moment(pg_temp.o('jar readers'), 'selfie', 'uploading'),                   '{owner}'),
  ('live moment in unpublished', 'moment', tests.make_moment(pg_temp.o('jar unpublished'), 'morning', 'live'),                   '{owner}'),
  ('live moment in everyone',    'moment', tests.make_moment(pg_temp.o('jar everyone'), 'morning', 'live'),                      '{owner,reader,outsider,moderator}'),
  ('private moment in everyone', 'moment', tests.make_moment(pg_temp.o('jar everyone'), 'evening', 'live', p_private => true),   '{owner}'),
  ('checking moment in everyone','moment', tests.make_moment(pg_temp.o('jar everyone'), 'afternoon', 'checking'),                '{owner}'),
  ('live moment in only_me',     'moment', tests.make_moment(pg_temp.o('jar only_me'), 'morning', 'live'),                       '{owner}');

-- comments on the owner's Everyone jar, and one by the blocked user on the outsider's jar.
-- Inserted as the superuser, so is_hidden and deleted_at are taken as given.
insert into public.comments (id, jar_id, user_id, body, is_hidden, deleted_at) values
  ('c7000000-0000-4000-8000-000000000001', pg_temp.o('jar everyone'), tests.id('reader'),   'visible', false, null),
  ('c7000000-0000-4000-8000-000000000002', pg_temp.o('jar everyone'), tests.id('outsider'), 'not checked yet', true, null),
  ('c7000000-0000-4000-8000-000000000003', pg_temp.o('jar everyone'), tests.id('reader'),   'deleted', false, now()),
  ('c7000000-0000-4000-8000-000000000004', pg_temp.o('outsider jar'), tests.id('blocked'),  'by the blocked user', false, null),
  ('c7000000-0000-4000-8000-000000000005', pg_temp.o('jar readers'),  tests.id('reader'),   'on a Readers jar', false, null);
insert into obj values
  ('comment visible',          'comment', 'c7000000-0000-4000-8000-000000000001', '{owner,reader,outsider,moderator}'),
  -- hidden until fn:moderate checks it: only its author sees it
  ('comment hidden',           'comment', 'c7000000-0000-4000-8000-000000000002', '{outsider}'),
  ('comment deleted',          'comment', 'c7000000-0000-4000-8000-000000000003', '{}'),
  -- the owner blocked its author, so the owner doesn't see it on someone else's jar
  ('comment by blocked user',  'comment', 'c7000000-0000-4000-8000-000000000004', '{reader,outsider,blocked,blocker,moderator}'),
  ('comment on readers jar',   'comment', 'c7000000-0000-4000-8000-000000000005', '{owner,reader}');

-- reactions (one per target)
insert into public.reactions (user_id, target, target_id) values
  (tests.id('reader'),   'jar',    pg_temp.o('jar readers')),
  (tests.id('outsider'), 'jar',    pg_temp.o('jar everyone')),
  (tests.id('owner'),    'moment', pg_temp.o('moment private')),
  (tests.id('reader'),   'moment', pg_temp.o('live moment in everyone')),
  (tests.id('owner'),    'moment', pg_temp.o('moment checking'));
insert into obj values
  ('reaction on readers jar',      'reaction', pg_temp.o('jar readers'),             '{owner,reader}'),
  ('reaction on everyone jar',     'reaction', pg_temp.o('jar everyone'),            '{owner,reader,outsider,moderator}'),
  ('reaction on private moment',   'reaction', pg_temp.o('moment private'),          '{owner}'),
  ('reaction on checking moment',  'reaction', pg_temp.o('moment checking'),         '{owner}'),
  ('reaction on live moment',      'reaction', pg_temp.o('live moment in everyone'), '{owner,reader,outsider,moderator}');

-- follows: reader -> owner, and blocked -> outsider (checked with author outsider below)
insert into public.follows (reader_id, author_id) values (tests.id('blocked'), tests.id('outsider'));
insert into obj values
  -- a follow is hidden from anyone on either side of a block with the reader or the author
  ('follow reader->owner',     'follow',             tests.id('reader'),  '{owner,reader,outsider,moderator}'),
  ('follow blocked->outsider', 'follow of outsider', tests.id('blocked'), '{reader,outsider,blocked,blocker,moderator}');

-- blocks: each is visible to the blocker only
insert into obj values
  ('block owner->blocked', 'block', tests.id('owner'),   '{owner}'),
  ('block blocker->owner', 'block', tests.id('blocker'), '{blocker}');

-- profiles
insert into obj values
  ('profile owner',    'profile', tests.id('owner'),    '{owner,reader,outsider,moderator}'),
  ('profile blocked',  'profile', tests.id('blocked'),  '{reader,outsider,blocked,blocker,moderator}');

-- safety rows and a notification
insert into public.moderation_items (id, moment_id, source, scores)
values ('a7000000-0000-4000-8000-000000000001', pg_temp.o('moment checking'), 'auto_check', '{"sexual": 0.5}');
insert into public.reports (id, reporter_id, target, target_id, reason)
values ('b7000000-0000-4000-8000-000000000001', tests.id('reader'), 'jar', pg_temp.o('jar readers'), 'spam');
insert into obj values
  ('moderation item', 'moderation_item', 'a7000000-0000-4000-8000-000000000001', '{moderator}'),
  -- the reporter can't read reports back, and the reported owner never learns who reported
  ('report',          'report',          'b7000000-0000-4000-8000-000000000001', '{moderator}'),
  ('notification new_reader', 'notification',
     (select id from public.notifications where user_id = tests.id('owner') and actor_id = tests.id('reader') and type = 'new_reader'),
     '{owner}');

grant select on obj, roles to authenticated, anon, service_role;

-- ---------------------------------------------------------------- the matrix
select is(tests.can_see(o.kind, r.role, o.id), r.role = any (o.sees),
          format('%s: %s %s', o.name, r.role, case when r.role = any (o.sees) then 'sees it' else 'does not see it' end))
from obj o cross join roles r
order by o.name, r.ord;

-- ---------------------------------------------------------------- suspended owner (D-11)
update public.profiles set status = 'suspended' where id = tests.id('owner');

-- Everything of the owner's that others could see before is now visible to the owner only.
select is(tests.can_see(o.kind, r.role, o.id), r.role = 'owner',
          format('suspended owner, %s: %s %s', o.name, r.role, case when r.role = 'owner' then 'sees it' else 'does not see it' end))
from obj o cross join roles r
where o.kind in ('jar', 'moment', 'profile') and o.name not in ('outsider jar', 'profile blocked')
order by o.name, r.ord;

-- ---------------------------------------------------------------- anon has no table access at all
select is((select count(*) from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p', 'S')
             and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
                  or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'))),
          0::bigint, 'anon holds no privilege on any table, view or sequence in public');
select ok(not has_function_privilege('anon', 'public.is_blocked_between(uuid, uuid)', 'execute'),
          'anon cannot ask whether two users blocked each other');

select * from finish();
rollback;
