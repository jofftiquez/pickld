-- 0018 — Profile image keys (M3-15; FR-SOC-11, NFR-SEC-02). Additive only: two check constraints on
-- profiles. No table or column is added, dropped or renamed.
--
--   * avatar_path and cover_path stay free for the owner to change (0002), but only to a key of their own
--     kind that names the row's own id (supabase/functions/_shared/object_keys.ts, newProfileImageKey):
--       avatar_path  avatars/<id>/<uuid>.jpg   or a local seed key seed/avatars/<name>.jpg
--       cover_path   covers/<id>/<uuid>.jpg    or a local seed key seed/photos/<name>.jpg
--     Without this, a user could point avatar_path at someone else's photo (a private moment, say) and
--     fn:photo-urls would sign it for everyone who views their profile. fn:photo-urls repeats the owner
--     check before signing, so neither layer relies on the other alone.
--   * Existing rows pass: the seed sets seed/avatars/* avatars and no covers, and keys issued by
--     fn:upload-url (newProfileImageKey) already have this shape.

alter table public.profiles
  add constraint profiles_avatar_path_format check (
    avatar_path is null
    or avatar_path ~ ('^avatars/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    or avatar_path ~ '^seed/avatars/[a-z0-9_]{1,40}\.jpg$'
  ),
  add constraint profiles_cover_path_format check (
    cover_path is null
    or cover_path ~ ('^covers/' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    or cover_path ~ '^seed/photos/[a-z0-9_]{1,40}\.jpg$'
  );

comment on constraint profiles_avatar_path_format on public.profiles is
  'avatars/<own id>/<uuid>.jpg or seed/avatars/<name>.jpg (0018).';
comment on constraint profiles_cover_path_format on public.profiles is
  'covers/<own id>/<uuid>.jpg or seed/photos/<name>.jpg (0018).';
