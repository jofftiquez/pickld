-- M3-15 (0018): avatar_path and cover_path hold only the owner's own key of the right kind (or a local
-- seed key), so nobody can point their profile at someone else's photo (FR-SOC-11, NFR-SEC-02).
begin;
\ir _helpers.psql
select plan(14);

select tests.world();
create function pg_temp.key(prefix text, who text) returns text language sql as $$
  select prefix || '/' || tests.id(who) || '/' || gen_random_uuid() || '.jpg'
$$;
create temp table k as select
  pg_temp.key('avatars', 'owner') as own_avatar,
  pg_temp.key('covers', 'owner') as own_cover,
  pg_temp.key('avatars', 'reader') as reader_avatar,
  pg_temp.key('covers', 'reader') as reader_cover,
  'moments/' || tests.id('reader') || '/' || gen_random_uuid() || '/full.jpg' as reader_moment,
  'moments/' || tests.id('owner') || '/' || gen_random_uuid() || '/full.jpg' as own_moment;
grant select on k to authenticated;

select tests.act_as('owner');

-- ---------------------------------------------------------------- allowed
select lives_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$, (select own_avatar from k)),
                'the owner sets their own avatar key');
select lives_ok(format($$update public.profiles set cover_path = %L where id = auth.uid()$$, (select own_cover from k)),
                'the owner sets their own cover key');
select is((select array[avatar_path, cover_path] from public.profiles where id = auth.uid()),
          (select array[own_avatar, own_cover] from k), 'both keys are stored');
select lives_ok($$update public.profiles set avatar_path = 'seed/avatars/av_mika.jpg', cover_path = 'seed/photos/p_01.jpg'
                  where id = auth.uid()$$, 'local seed keys are allowed');

-- ---------------------------------------------------------------- refused
select throws_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$, (select reader_avatar from k)),
                 '23514', null, 'another user''s avatar key is refused');
select throws_ok(format($$update public.profiles set cover_path = %L where id = auth.uid()$$, (select reader_cover from k)),
                 '23514', null, 'another user''s cover key is refused');
select throws_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$, (select reader_moment from k)),
                 '23514', null, 'another user''s moment key is refused as an avatar');
select throws_ok(format($$update public.profiles set cover_path = %L where id = auth.uid()$$, (select own_moment from k)),
                 '23514', null, 'even the owner''s own moment key is refused as a cover');
select throws_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$, (select own_cover from k)),
                 '23514', null, 'a cover key is refused as an avatar');
select throws_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$,
                        'avatars/' || tests.id('owner') || '/../x.jpg'),
                 '23514', null, 'a malformed key is refused');
select throws_ok($$update public.profiles set avatar_path = 'seed/photos/p_01.jpg' where id = auth.uid()$$,
                 '23514', null, 'a seed photo is not a seed avatar');
select throws_ok(format($$update public.profiles set avatar_path = %L where id = auth.uid()$$,
                        upper((select own_avatar from k))),
                 '23514', null, 'keys are lower case only');

-- ---------------------------------------------------------------- clearing
select lives_ok($$update public.profiles set avatar_path = null, cover_path = null where id = auth.uid()$$,
                'null clears both');
select is((select array[avatar_path, cover_path] from public.profiles where id = auth.uid()), array[null, null]::text[],
          'both are cleared');

select * from finish();
rollback;
