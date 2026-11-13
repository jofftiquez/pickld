-- Local only: Up to 60 full, published Everyone jars from mika and aya (both read by dale), days 2..31 ago (days that already have a jar are skipped),
-- so dale's feed is long enough to measure scrolling. Remove with feed-seed-down.sql.
alter table public.moments disable trigger moments_bi;

with authors(uid, n, tz) as (values
  ('a0000000-0000-4000-8000-000000000002'::uuid, 0, 'Asia/Manila'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 1, 'Asia/Tokyo')),
days as (select generate_series(2, 31) as d),
ins as (
  insert into public.jars (id, user_id, local_date, tz, visibility, published_at)
  select ('e0000000-0000-4000-8000-' || lpad((a.n * 100 + d)::text, 12, '0'))::uuid, a.uid,
         (now() at time zone a.tz)::date - d, a.tz, 'everyone', now() - make_interval(days => d - 1)
  from authors a cross join days
  on conflict (user_id, local_date) do nothing
  returning id, user_id, tz, local_date
)
insert into public.moments (jar_id, user_id, slot, photo_path, thumb_path, caption, captured_at, added_at, is_backfilled, visibility, status)
select ins.id, ins.user_id, s.slot::slot, 'seed/photos/' || s.img || '.jpg', 'seed/thumbs/' || s.img || '.jpg',
       null, (ins.local_date::timestamp at time zone ins.tz) + s.at, (ins.local_date::timestamp at time zone ins.tz) + s.at + interval '1 minute',
       false, 'everyone', 'live'
from ins cross join (values
  ('whereami', 'whereami', interval '8 hours'), ('mebusywith', 'busy', interval '10 hours'),
  ('whoamiwith', 'whoamiwith', interval '12 hours'), ('ootd', 'ootd', interval '9 hours'),
  ('selfie', 'selfie', interval '11 hours'), ('morning', 'morning', interval '7 hours'),
  ('afternoon', 'afternoon', interval '15 hours'), ('evening', 'evening', interval '20 hours')) as s(slot, img, at);

alter table public.moments enable trigger moments_bi;
