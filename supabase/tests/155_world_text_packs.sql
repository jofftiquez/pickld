-- 0155: six premium text packs of 30, each with its store product and a description.
begin;
\ir _helpers.psql
select plan(2);

select is((select count(*)::int from (
             select p.id from public.sticker_packs p join public.stickers s on s.pack_id = p.id and s.retired_at is null
             where p.slug in ('gym', 'foodie', 'travel', 'student', 'parents', 'fan-life')
               and p.tier = 'premium' and p.store_product_id = 'me.pickld.pack.' || replace(p.slug, '-', '_')
               and p.description is not null
             group by p.id having count(s.id) >= 30) full_packs), 6,
          'six premium text packs of at least 30, each with its store product and a description');
select is((select count(*)::int from public.stickers s join public.sticker_packs p on p.id = s.pack_id
           where p.slug in ('gym', 'foodie', 'travel', 'student', 'parents', 'fan-life') and (s.art_width is null or s.art_height is null)), 0,
          'every new sticker has its art size');

select * from finish();
rollback;
