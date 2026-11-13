-- T-511 (0065): the word-art packs get styled lettering under new file names, and a Hashtags pack.
begin;
\ir _helpers.psql
select plan(6);

select tests.world();

select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug in ('corporate', 'gen-z', 'trentahin', 'pride', 'cyclists') and s.retired_at is null
             and s.asset_path like '%-v2.png'), 60, 'the five word-art packs offer 60 restyled stickers');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug in ('corporate', 'gen-z', 'trentahin', 'pride', 'cyclists') and s.retired_at is not null
             and s.asset_path not like '%-v2.png'), 60, 'the 60 pills are retired, not deleted');
select is((select count(*)::int from public.stickers old join public.stickers new
             on new.asset_path = replace(old.asset_path, '.png', '-v2.png')
           where old.retired_at is not null and new.label = old.label and new.sort = old.sort
             and new.pack_id = old.pack_id and new.tags = old.tags), 60, 'each restyle keeps its label, pack, order and tags');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug = 'hashtags' and p.tier = 'premium' and p.store_product_id = 'me.pickld.pack.hashtags'
             and s.retired_at is null and s.label like '#%'), 16, 'Hashtags: 16 premium hashtag stickers');
select is((select count(*)::int from (
             select p.id from public.sticker_packs p left join public.stickers s on s.pack_id = p.id and s.retired_at is null
             group by p.id having count(s.id) < 10) short), 0,
          'every pack still offers at least 10 stickers');

-- A moment that already uses a retired pill still draws it: the public catalog keeps returning it.
select ok(exists (select 1 from public.public_sticker_catalog() where asset_path = 'stickers/gen-z/slay.png'),
          'the retired pill stays in the public catalog');

select * from finish();
rollback;
