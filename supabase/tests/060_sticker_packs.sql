-- T-507 (0060): every pack offers at least 10 stickers, seven new premium packs, and five more milestones.
begin;
\ir _helpers.psql
select plan(7);

select tests.world();

select is((select count(*)::int from (
             select p.id from public.sticker_packs p left join public.stickers s on s.pack_id = p.id and s.retired_at is null
             group by p.id having count(s.id) < 10) short), 0,
          'every pack offers at least 10 stickers');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug in ('olivia', 'fish-moods') and s.retired_at is null), 32, 'Olivia and Fish Moods: 16 pictures each');
select is((select count(*)::int from public.sticker_packs
           where slug in ('olivia', 'fish-moods', 'corporate', 'gen-z', 'trentahin', 'pride', 'cyclists')
             and tier = 'premium' and store_product_id = 'me.pickld.pack.' || replace(slug, '-', '_') and description is not null),
          7, 'the seven new packs are premium, with a store product and a description');
select is((select count(*)::int from public.stickers where id <> md5('pickld-sticker:' || asset_path)::uuid), 0,
          'new ids derive from the asset path');

-- New milestones: granted at their counts, and each unlocks its own sticker.
select tests.make_moment(tests.make_jar('owner', p_days_ago => d), 'morning', 'live') from generate_series(0, 6) d;
select ok(exists (select 1 from public.milestones where user_id = tests.id('owner') and key = 'jars_7'), '7 jars grants jars_7');
select ok(not exists (select 1 from public.milestones where user_id = tests.id('owner') and key = 'jars_50'), 'but not jars_50');
select tests.act_as('owner');
select is((select array_agg(s.milestone_key order by s.milestone_key) from public.stickers s where s.sticker_usable and s.milestone_key is not null),
          array['jars_7'], 'the jars_7 sticker is the only milestone sticker the owner can use');

select * from finish();
rollback;
