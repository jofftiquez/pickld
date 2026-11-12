-- M3-22 (0022; FR-SAF-02, FR-PUB-06): Block and Blocked accounts. blocked_accounts() tried as owner,
-- reader, outsider, blocked user, blocker and anon; blocking removes follows both ways without notifying
-- either side; unblocking is the blocker's alone.
begin;
\ir _helpers.psql
select plan(14);

select tests.world();
-- owner and reader read each other before reader is blocked below.
insert into public.follows (reader_id, author_id) values (tests.id('owner'), tests.id('reader'));
create temp table who as select username::text as blocked_name from public.profiles where id = tests.id('blocked');
grant select on who to authenticated;

-- ---------------------------------------------------------------- blocked_accounts()
select tests.act_as('owner');
select is((select array_agg(username) from public.blocked_accounts()),
          array[(select blocked_name from who)],
          'owner sees the account they blocked');
select is((select display_name from public.blocked_accounts()), 'Blocked', 'with the name for the list');

select tests.act_as('blocked');
select is((select count(*) from public.blocked_accounts()), 0::bigint, 'the blocked user does not learn who blocked them');
select is((select count(*) from public.blocks), 0::bigint, 'nor through the blocks table');

select tests.act_as('blocker');
select is((select array_agg(id) from public.blocked_accounts()), array[tests.id('owner')],
          'the blocker sees only their own block');

select tests.act_as('outsider');
select is((select count(*) from public.blocked_accounts()), 0::bigint, 'an outsider sees nothing');

select tests.act_as_anon();
select throws_ok($$select * from public.blocked_accounts()$$, '42501', null, 'anon cannot call it');

-- ---------------------------------------------------------------- blocking
select tests.act_as('owner');
select lives_ok($$insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner'), tests.id('reader'))$$,
                'owner blocks reader');
select tests.reset_role();
select is((select count(*) from public.follows
           where (reader_id, author_id) in ((tests.id('owner'), tests.id('reader')), (tests.id('reader'), tests.id('owner')))),
          0::bigint, 'blocking removes follows both ways');
select is((select count(*) from public.notifications
           where (user_id, actor_id) in ((tests.id('owner'), tests.id('reader')), (tests.id('reader'), tests.id('owner')))),
          0::bigint, 'neither side is notified, and earlier notifications between them are cleared');

select tests.act_as('outsider');
select throws_ok($$insert into public.blocks (blocker_id, blocked_id) values (tests.id('owner'), tests.id('outsider'))$$,
                 '42501', null, 'nobody can block on someone else''s behalf');

-- ---------------------------------------------------------------- unblocking
select tests.act_as('reader');
delete from public.blocks where blocker_id = tests.id('owner') and blocked_id = tests.id('reader');
select tests.act_as('owner');
select is((select count(*) from public.blocked_accounts() where id = tests.id('reader')), 1::bigint,
          'the blocked person cannot lift the block');
delete from public.blocks where blocked_id = tests.id('reader');
select is((select count(*) from public.blocked_accounts() where id = tests.id('reader')), 0::bigint, 'the blocker can unblock');
select tests.reset_role();
select is((select count(*) from public.follows where reader_id = tests.id('reader') and author_id = tests.id('owner')),
          0::bigint, 'unblocking does not bring follows back');

select * from finish();
rollback;
