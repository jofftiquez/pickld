-- 0157 — Fish Moods grows from 16 to 30 stickers (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('fish-moods', 17, 'Bored', 'stickers/fish-moods/bored.png', '{fish,mood}'::text[], null, 1024, 776),
  ('fish-moods', 18, 'Excited', 'stickers/fish-moods/excited.png', '{fish,mood,happy}'::text[], null, 949, 1024),
  ('fish-moods', 19, 'Thinking', 'stickers/fish-moods/thinking.png', '{fish,mood}'::text[], 'mebusywith', 1024, 955),
  ('fish-moods', 20, 'Grateful', 'stickers/fish-moods/grateful.png', '{fish,mood,happy}'::text[], null, 1024, 948),
  ('fish-moods', 21, 'Sorry', 'stickers/fish-moods/sorry.png', '{fish,mood,sad}'::text[], null, 1024, 1003),
  ('fish-moods', 22, 'Hug me', 'stickers/fish-moods/hug-me.png', '{fish,mood,love}'::text[], 'whoamiwith', 989, 1024),
  ('fish-moods', 23, 'Determined', 'stickers/fish-moods/determined.png', '{fish,mood,work}'::text[], 'mebusywith', 1024, 1009),
  ('fish-moods', 24, 'Cold', 'stickers/fish-moods/cold.png', '{fish,mood,cold}'::text[], null, 1024, 978),
  ('fish-moods', 25, 'Hot', 'stickers/fish-moods/hot.png', '{fish,mood,summer}'::text[], 'afternoon', 1024, 796),
  ('fish-moods', 26, 'Dizzy', 'stickers/fish-moods/dizzy.png', '{fish,mood,funny}'::text[], null, 1011, 1024),
  ('fish-moods', 27, 'Eye roll', 'stickers/fish-moods/eye-roll.png', '{fish,mood,funny}'::text[], null, 1024, 937),
  ('fish-moods', 28, 'Wink', 'stickers/fish-moods/wink.png', '{fish,mood,funny}'::text[], 'selfie', 1024, 1006),
  ('fish-moods', 29, 'Thumbs up', 'stickers/fish-moods/thumbs-up.png', '{fish,mood,win}'::text[], null, 1024, 977),
  ('fish-moods', 30, 'Good night', 'stickers/fish-moods/good-night.png', '{fish,mood,sleepy}'::text[], 'evening', 1024, 956)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
