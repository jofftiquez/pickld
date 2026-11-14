-- 0072 (INV-12): a waitlist row belongs to a verified auth user with no profile yet. Anon and unconfirmed
-- emails are refused, a member (has a profile) gets 'member' and nothing is written, joining twice is one row,
-- an email-only row from the first form becomes the account's row, my_waitlist_status() answers for the caller
-- only, nobody can touch the table directly, and the row goes with the auth user.
begin;
\ir _helpers.psql
select plan(18);

select tests.world();

-- Auth users without a profile, as the web form makes them: one confirmed, one that never entered the code,
-- and one whose email is already on the list from the first form.
create function tests.auth_only(p_name text, p_confirmed boolean) returns uuid language plpgsql as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
          p_name || '@tests.pickld.test', '', case when p_confirmed then now() end,
          '{"provider":"email"}', '{}', now(), now());
  insert into tests.users (name, id) values (p_name, uid);
  return uid;
end $$;
select tests.auth_only('ana', true);
select tests.auth_only('ben', false);
select tests.auth_only('cai', true);
insert into public.waitlist (email, ip_hash, source) values ('Cai@tests.pickld.test', repeat('a', 64), 'hero');

-- ---------------------------------------------------------------- no direct access
select ok(not has_table_privilege('anon', 'public.waitlist', 'select,insert,update,delete')
          and not has_table_privilege('authenticated', 'public.waitlist', 'select,insert,update,delete'),
          'anon and signed-in users still have no privileges on waitlist');
select ok(not has_function_privilege('anon', 'public.waitlist_join(text)', 'execute')
          and not has_function_privilege('anon', 'public.my_waitlist_status()', 'execute'),
          'anon may not call waitlist_join(source) or my_waitlist_status()');

select tests.act_as_anon();
select throws_ok($$select public.waitlist_join('hero')$$, '42501', null, 'anon cannot join');
select tests.reset_role();

-- ---------------------------------------------------------------- joining
select tests.act_as('ben');
select throws_ok($$select public.waitlist_join('hero')$$, '42501', null, 'an unconfirmed email cannot join');
select tests.reset_role();

select tests.act_as('ana');
select is(public.my_waitlist_status(), 'none', 'before joining the status is none');
select is(public.waitlist_join('final'), 'joined', 'a confirmed account without a profile joins');
select is(public.waitlist_join('hero'), 'already', 'joining again says already');
select is(public.my_waitlist_status(), 'waiting', 'after joining the status is waiting');
select throws_ok($$select count(*) from public.waitlist$$, '42501', null, 'the account still cannot read waitlist');
select tests.reset_role();

select is((select count(*)::int from public.waitlist where user_id = tests.id('ana')), 1, 'one row per account');
select is((select concat_ws('|', email, source, coalesce(ip_hash, 'no hash')) from public.waitlist
           where user_id = tests.id('ana')),
          'ana@tests.pickld.test|final|no hash', 'the row has the auth email, the first source and no IP hash');

select tests.act_as('cai');
select is(public.waitlist_join('story'), 'already', 'an email already on the list from the first form says already');
select tests.reset_role();
select is((select concat_ws('|', user_id, source) from public.waitlist where email = 'cai@tests.pickld.test'),
          concat_ws('|', tests.id('cai'), 'hero'), 'that row now belongs to the account and keeps its source');

select tests.act_as('owner');
select is(public.waitlist_join('hero'), 'member', 'someone with a profile is already a member');
select tests.reset_role();
select is((select count(*)::int from public.waitlist where user_id = tests.id('owner')), 0, 'a member gets no row');

-- ---------------------------------------------------------------- status is the caller's own
update public.waitlist set admitted_at = now() where user_id = tests.id('cai');
select tests.act_as('cai');
select is(public.my_waitlist_status(), 'admitted', 'an admitted account sees admitted');
select tests.reset_role();
select tests.act_as('ana');
select is(public.my_waitlist_status(), 'waiting', 'another account''s admission does not change the caller''s status');
select tests.reset_role();

-- ---------------------------------------------------------------- the row goes with the account
delete from auth.users where id = tests.id('ana');
select is((select count(*)::int from public.waitlist where email = 'ana@tests.pickld.test'), 0,
          'deleting the auth user deletes their waitlist row');

select * from finish();
rollback;
