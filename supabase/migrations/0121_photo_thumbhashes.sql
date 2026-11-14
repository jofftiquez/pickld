-- 0121: ThumbHash placeholders for moment photos (NFR-PERF-02). A ThumbHash is a ~25-byte blurred preview of a
-- photo that the app draws while the real photo loads. The phone makes it from the thumbnail and sends it to
-- fn:upload-url, which stores it here under the thumbnail's object key. fn:photo-urls returns it next to a
-- thumbnail URL, so it reaches only people who may see that thumbnail.
--
-- Keyed by thumb_path rather than kept on moments: the hash belongs to one photo, and a photo's key already moves
-- through pending proposals, moderation and replacement (0011, 0013) without anything here having to follow it.
--
-- Only server code (service role) reads or writes the table: a client could otherwise read the preview of a
-- private or unpublished moment by guessing nothing more than its key.

create table public.photo_thumbhashes (
  thumb_path text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  thumbhash text not null check (thumbhash ~ '^[A-Za-z0-9+/]{8,64}={0,2}$'),
  created_at timestamptz not null default now(),
  -- A key always sits under its owner's folder (object_keys.ts), so a row can't claim someone else's photo.
  check (thumb_path like 'moments/' || user_id::text || '/%')
);
create index photo_thumbhashes_user_idx on public.photo_thumbhashes (user_id);
comment on table public.photo_thumbhashes is
  'ThumbHash placeholder per moment thumbnail key (0121). Written by fn:upload-url, read by fn:photo-urls.';

alter table public.photo_thumbhashes enable row level security;
revoke all on public.photo_thumbhashes from public, anon, authenticated;
grant select, insert, delete on public.photo_thumbhashes to service_role;
