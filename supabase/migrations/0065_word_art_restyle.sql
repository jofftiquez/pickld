-- 0065 — Styled word-art lettering and a Hashtags pack (T-511, #283; FR-STK-02, FR-STK-05).
-- Additive only: new rows and retired_at set on old ones. Nothing is dropped, renamed or deleted, and no existing
-- price, tier or free pack changes.
--
-- Product owner, Nov 13: the T-507 word-art packs "look like chips"; make the lettering more stylish (3D, striped,
-- retro script). And a new pack of Pinoy hashtags in speech bubbles (#TGIF, #ExamNa, #Traffic, #LunesNaNaman).
--
--   Corporate, Gen Z, Trentahin, Pride, Cyclists   12 pills retired → the same 12 phrases as styled lettering
--   Hashtags      16 hashtag bubbles         premium
--
-- Art never changes under a key (the photo Worker caches it as immutable, upload-stickers.ts), so the restyled art
-- gets new file names (<name>-v2.png) and new rows. The old pill rows are retired (0032), not deleted: moments that
-- already use them still draw them, and their art stays bundled. Nobody owns these packs yet (their store products
-- don't exist), so this changes nothing anyone has bought.
--
-- Store product for the new pack: me.pickld.pack.hashtags, to be created in App Store Connect and RevenueCat; until
-- then the shop shows it without a price or a Get button (0029).
--
-- Art: rendered by scripts/render-stickers.mjs (lettering and bubbles in scripts/word-art.mjs). Upload with
-- `cd workers/photos && deno task stickers`.

-- ---------------------------------------------------------------- restyled word art
insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort)
select md5('pickld-sticker:' || v2.path)::uuid, s.pack_id, s.label, v2.path, s.tags, s.slot_hint, s.stamp, s.milestone_key, s.sort
from public.stickers s
join public.sticker_packs p on p.id = s.pack_id
cross join lateral (select replace(s.asset_path, '.png', '-v2.png') as path) v2
where p.slug in ('corporate', 'gen-z', 'trentahin', 'pride', 'cyclists') and s.retired_at is null;

update public.stickers s set retired_at = '2026-11-13 12:00+08'
from public.sticker_packs p
where p.id = s.pack_id and p.slug in ('corporate', 'gen-z', 'trentahin', 'pride', 'cyclists')
  and s.retired_at is null and s.asset_path not like '%-v2.png';

-- ---------------------------------------------------------------- Hashtags
insert into public.sticker_packs (slug, name, tier, store_product_id, sort, description, available_from, available_to) values
  ('hashtags', 'Hashtags', 'premium', 'me.pickld.pack.hashtags', 22, '#TGIF, #ExamNa, #LunesNaNaman. The hashtags of every Pinoy week, in speech bubbles.', null, null);

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort
from (values
  (1 , '#TGIF'           , 'stickers/hashtags/tgif.png'             , '{hashtag,friday,weekend,popular}'::text[], 'evening'),
  (2 , '#LunesNaNaman'   , 'stickers/hashtags/lunes-na-naman.png'   , '{hashtag,monday,work,school,filipino}'::text[], 'morning'),
  (3 , '#ExamNa'         , 'stickers/hashtags/exam-na.png'          , '{hashtag,school,study,exam,filipino}'::text[], 'mebusywith'),
  (4 , '#Traffic'        , 'stickers/hashtags/traffic.png'          , '{hashtag,commute,traffic,filipino}'::text[], 'whereami'),
  (5 , '#Sahod'          , 'stickers/hashtags/sahod.png'            , '{hashtag,payday,sahod,work,filipino}'::text[], null),
  (6 , '#PetsaDePeligro' , 'stickers/hashtags/petsa-de-peligro.png' , '{hashtag,money,ipon,filipino}'::text[], null),
  (7 , '#WalangPasok'    , 'stickers/hashtags/walang-pasok.png'     , '{hashtag,holiday,rain,school,filipino}'::text[], null),
  (8 , '#TagUlan'        , 'stickers/hashtags/tag-ulan.png'         , '{hashtag,rain,weather,filipino}'::text[], null),
  (9 , '#KainTayo'       , 'stickers/hashtags/kain-tayo.png'        , '{hashtag,food,family,barkada,filipino}'::text[], 'afternoon'),
  (10, '#Gala'           , 'stickers/hashtags/gala.png'             , '{hashtag,travel,barkada,filipino}'::text[], 'whereami'),
  (11, '#Puyat'          , 'stickers/hashtags/puyat.png'            , '{hashtag,sleep,night,filipino}'::text[], 'evening'),
  (12, '#SanaAll'        , 'stickers/hashtags/sana-all.png'         , '{hashtag,love,funny,filipino}'::text[], null),
  (13, '#Lodi'           , 'stickers/hashtags/lodi.png'             , '{hashtag,friends,idol,filipino}'::text[], 'whoamiwith'),
  (14, '#BeachPa'        , 'stickers/hashtags/beach-pa.png'         , '{hashtag,beach,summer,travel,filipino}'::text[], 'whereami'),
  (15, '#HappyWeekend'   , 'stickers/hashtags/happy-weekend.png'    , '{hashtag,weekend,rest}'::text[], null),
  (16, '#Throwback'      , 'stickers/hashtags/throwback.png'        , '{hashtag,memories,throwback}'::text[], null)
) as v(sort, label, asset_path, tags, slot_hint)
join public.sticker_packs p on p.slug = 'hashtags';
