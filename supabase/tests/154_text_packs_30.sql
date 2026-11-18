-- 0154: Stamps and the text packs offer at least 30 stickers each, and 100% real replaces 100% totoo.
begin;
\ir _helpers.psql
select plan(3);

select is((select count(*)::int from (
             select p.id from public.sticker_packs p left join public.stickers s on s.pack_id = p.id and s.retired_at is null
             where p.slug in ('stamps', 'corporate', 'gen-z', 'trentahin', 'pride', 'cyclists', 'hashtags')
             group by p.id having count(s.id) >= 30) full_packs), 7,
          'Stamps and the six text packs offer at least 30 stickers each');
select is((select retired_at is not null from public.stickers where asset_path = 'stickers/stamps/totoo.png'), true,
          '100% totoo is retired');
select is((select count(*)::int from public.stickers where asset_path = 'stickers/stamps/100-real.png' and retired_at is null), 1,
          '100% real is live');

select * from finish();
rollback;
