-- 0162 — Work From Wherever (FR-STK-02, FR-STK-06). Additive only: new rows, and retired_at set on the pack's
-- plain text stickers. Nothing is dropped, renamed or deleted.
--
-- Product owner, Nov 18: every pack has at least 30 stickers; drawing packs carry drawings only (words go in the
-- editor's Text tool). Retired stickers stay drawable in moments that already use them (0032); their art stays
-- bundled.
-- Art: drawn at 1024 px (longest side), trimmed and quantised, bundled in stickerArt.ts. Upload with
-- `cd workers/photos && deno task stickers`.

update public.stickers set retired_at = now()
where retired_at is null and asset_path in (
  'stickers/work-from-wherever/camera-off.png',
  'stickers/work-from-wherever/ooo.png',
  'stickers/work-from-wherever/could-be-an-email.png',
  'stickers/work-from-wherever/per-my-last-email.png',
  'stickers/work-from-wherever/on-mute.png',
  'stickers/work-from-wherever/deadline-mode.png',
  'stickers/work-from-wherever/focus-time.png',
  'stickers/work-from-wherever/logged-off.png');

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, sort, art_width, art_height)
select md5('pickld-sticker:' || v.asset_path)::uuid, p.id, v.label, v.asset_path, v.tags, v.slot_hint::slot, v.sort, v.w, v.h
from (values
  ('work-from-wherever', 9, 'Cafe office', 'stickers/work-from-wherever/cafe-desk.png', '{work,coffee,cafe}'::text[], 'whereami', 1024, 1019),
  ('work-from-wherever', 10, 'Beach office', 'stickers/work-from-wherever/beach-desk.png', '{work,beach,travel}'::text[], 'whereami', 1024, 964),
  ('work-from-wherever', 11, 'Bed office', 'stickers/work-from-wherever/bed-desk.png', '{work,home,rest}'::text[], 'whereami', 1024, 855),
  ('work-from-wherever', 12, 'Five o''clock', 'stickers/work-from-wherever/five-oclock.png', '{work,win}'::text[], 'evening', 1024, 959),
  ('work-from-wherever', 13, 'All done', 'stickers/work-from-wherever/all-done.png', '{work,win}'::text[], 'mebusywith', 994, 1024),
  ('work-from-wherever', 14, 'Crunch time', 'stickers/work-from-wherever/crunch-time.png', '{work,coffee,deadline}'::text[], 'mebusywith', 1024, 923),
  ('work-from-wherever', 15, 'Night shift', 'stickers/work-from-wherever/desk-lamp.png', '{work,night}'::text[], 'evening', 1024, 964),
  ('work-from-wherever', 16, 'Clacky keyboard', 'stickers/work-from-wherever/keyboard.png', '{work,desk}'::text[], 'mebusywith', 1024, 588),
  ('work-from-wherever', 17, 'Mouse', 'stickers/work-from-wherever/mouse.png', '{work,desk,funny}'::text[], null, 861, 1024),
  ('work-from-wherever', 18, 'Team call', 'stickers/work-from-wherever/video-meeting.png', '{work,meeting,coworkers}'::text[], 'mebusywith', 1024, 947),
  ('work-from-wherever', 19, 'Comfy chair', 'stickers/work-from-wherever/comfy-chair.png', '{work,home,desk}'::text[], null, 760, 1024),
  ('work-from-wherever', 20, 'Workation', 'stickers/work-from-wherever/workation.png', '{work,travel}'::text[], 'whereami', 554, 1024),
  ('work-from-wherever', 21, 'Full signal', 'stickers/work-from-wherever/full-wifi.png', '{work,wifi,win}'::text[], null, 1024, 887),
  ('work-from-wherever', 22, 'Low battery', 'stickers/work-from-wherever/low-battery.png', '{work,tired,funny}'::text[], 'evening', 1024, 950),
  ('work-from-wherever', 23, 'Balcony office', 'stickers/work-from-wherever/balcony-office.png', '{work,home,cat}'::text[], 'whereami', 1024, 680),
  ('work-from-wherever', 24, 'Stay hydrated', 'stickers/work-from-wherever/water-bottle.png', '{work,health,desk}'::text[], null, 745, 1024),
  ('work-from-wherever', 25, 'Focus timer', 'stickers/work-from-wherever/focus-timer.png', '{work,focus}'::text[], 'mebusywith', 1016, 1024),
  ('work-from-wherever', 26, 'Laptop bag', 'stickers/work-from-wherever/laptop-bag.png', '{work,commute}'::text[], 'morning', 1010, 1024),
  ('work-from-wherever', 27, 'Stretch break', 'stickers/work-from-wherever/stretch-break.png', '{work,break,health}'::text[], null, 1024, 762),
  ('work-from-wherever', 28, 'Paperwork', 'stickers/work-from-wherever/paperwork.png', '{work,desk,busy}'::text[], 'mebusywith', 1024, 931),
  ('work-from-wherever', 29, 'Bright idea', 'stickers/work-from-wherever/bright-idea.png', '{work,idea,win}'::text[], null, 855, 1024),
  ('work-from-wherever', 30, 'Train office', 'stickers/work-from-wherever/train-office.png', '{work,travel,commute}'::text[], 'whereami', 1024, 890)
) as v(pack_slug, sort, label, asset_path, tags, slot_hint, w, h)
join public.sticker_packs p on p.slug = v.pack_slug;
