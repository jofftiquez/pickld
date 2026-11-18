-- 0168 — Milestone badges (FR-STK-05). Additive only: new rows and retired_at set on old ones. Nothing is dropped,
-- renamed or deleted, and no milestone, grant rule or owned pack changes.
--
-- Product owner, Nov 18: the milestone stickers are underwhelming; make them brighter, like a reward. The 12 green
-- pills (0012, 0060, 0135) become gold rosette badges: a big number on a gold medal and a ribbon banner whose colour
-- tells the kind apart (jars green, full jars pink, friends blue, the year purple).
--
-- Art never changes under a key (the photo Worker caches it as immutable), so the badges get new file names
-- (<name>-v2.png) and new rows with the same label, tags, milestone_key and sort. The pill rows are retired (0032),
-- not deleted: moments that already use them still draw them, and their art stays bundled. Who may use a badge is
-- unchanged: it needs its own milestone (sticker_usable, 0012).
--
-- Art: rendered by scripts/render-stickers.mjs at 1024 px (longest side), quantised, bundled in stickerArt.ts.
-- Upload with `cd workers/photos && deno task stickers`.

insert into public.stickers (id, pack_id, label, asset_path, tags, slot_hint, stamp, milestone_key, sort, art_width, art_height)
select md5('pickld-sticker:' || v2.path)::uuid, s.pack_id, s.label, v2.path, s.tags, s.slot_hint, s.stamp, s.milestone_key, s.sort,
       896, 1024
from public.stickers s
join public.sticker_packs p on p.id = s.pack_id
cross join lateral (select replace(s.asset_path, '.png', '-v2.png') as path) v2
where p.slug = 'milestones' and s.retired_at is null and s.asset_path not like '%-v2.png'
on conflict (id) do nothing;

update public.stickers s set retired_at = '2026-11-19 04:00+08'
from public.sticker_packs p
where p.id = s.pack_id and p.slug = 'milestones' and s.retired_at is null and s.asset_path not like '%-v2.png';
