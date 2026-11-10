-- 0004 — Harden moments (docs/analysis.md S-2, G-12; FR-JAR-03, FR-JAR-06, FR-PUB-07, FR-CAP-10; M1-09).
-- Additive only: no column is dropped or renamed.

-- ---------------------------------------------------------------- G-12: pending content
-- A change to the photo, caption or edits of a submitted moment doesn't touch the visible version.
-- The trigger below writes the complete proposed content into pending_* and stamps pending_since;
-- fn:moderate checks it and, on approval, copies all four pending_* columns over the live ones and
-- clears them (pending_since is null again). The old version stays visible until then (FR-JAR-03).
alter table public.moments add column pending_photo_path text;
alter table public.moments add column pending_thumb_path text;
alter table public.moments add column pending_caption text check (char_length(pending_caption) <= 150);
alter table public.moments add column pending_edits jsonb;
alter table public.moments add column pending_since timestamptz;
comment on column public.moments.pending_since is
  'Set by the server when a content change awaits moderation; pending_* then hold the full proposed content.';

-- Pending content is unchecked, so other users must never read it. Replace the table-level SELECT
-- grant with a column list without pending_*; the owner reads them through my_pending_moments().
-- Anonymous visitors get no direct access (the web page uses narrow RPCs, G-16).
revoke select on public.moments from authenticated, anon;
grant select (id, jar_id, user_id, slot, photo_path, thumb_path, caption, captured_at, added_at,
              is_backfilled, is_private, edits, status, like_count)
  on public.moments to authenticated;
revoke insert, update, delete on public.moments from anon;

create or replace function public.my_pending_moments()
returns table (moment_id uuid, pending_photo_path text, pending_thumb_path text, pending_caption text,
               pending_edits jsonb, pending_since timestamptz)
language sql stable security definer set search_path = public as $$
  select id, pending_photo_path, pending_thumb_path, pending_caption, pending_edits, pending_since
  from moments where user_id = auth.uid() and pending_since is not null
$$;
revoke execute on function public.my_pending_moments() from public, anon;
grant execute on function public.my_pending_moments() to authenticated;

-- ---------------------------------------------------------------- S-2: insert
-- moments_bi (0001, security definer) checks the owner, the jar date, stamps added_at and computes
-- is_backfilled from jar_ends_at(), which reads jars.ends_at since 0003. This second trigger runs as
-- the caller, so it can tell clients from the server, and clears what clients must not set.
create or replace function public.moments_before_insert_client() returns trigger
language plpgsql as $$
begin
  if public.is_client_role() then
    new.like_count := 0;
    new.pending_photo_path := null;
    new.pending_thumb_path := null;
    new.pending_caption := null;
    new.pending_edits := null;
    new.pending_since := null;
  end if;
  return new;
end $$;
create trigger moments_bi_client before insert on public.moments
  for each row execute function public.moments_before_insert_client();

-- ---------------------------------------------------------------- S-2: update
-- Replaces 0001's guard (same trigger, moments_bu).
create or replace function public.moments_guard_status() returns trigger
language plpgsql as $$
declare
  has_pending boolean := old.pending_since is not null;
begin
  -- Every role: a moment stays in its jar (FR-CAP-10, D-3) and keeps its owner; server time and the
  -- backfill flag from insert are permanent.
  if new.jar_id is distinct from old.jar_id then
    raise exception 'a moment cannot move to another jar' using errcode = '42501';
  end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
    raise exception 'a moment''s id and owner cannot change' using errcode = '42501';
  end if;
  new.added_at := old.added_at;
  new.is_backfilled := old.is_backfilled;

  if not public.is_client_role() then
    return new; -- fn:moderate, fn:mod-action and other server code
  end if;

  if new.like_count is distinct from old.like_count then
    raise exception 'like_count is set by the server' using errcode = '42501';
  end if;
  if new.pending_photo_path is distinct from old.pending_photo_path
     or new.pending_thumb_path is distinct from old.pending_thumb_path
     or new.pending_caption is distinct from old.pending_caption
     or new.pending_edits is distinct from old.pending_edits
     or new.pending_since is distinct from old.pending_since then
    raise exception 'pending_* columns are set by the server; update photo_path, thumb_path, caption or edits'
      using errcode = '42501';
  end if;
  -- The only status change a client may make is submitting an uploaded moment for checking.
  if new.status is distinct from old.status and not (old.status = 'uploading' and new.status = 'checking') then
    raise exception 'status can only be set by the server' using errcode = '42501';
  end if;

  if new.photo_path is distinct from old.photo_path
     or new.thumb_path is distinct from old.thumb_path
     or new.caption is distinct from old.caption
     or new.edits is distinct from old.edits then
    if old.status = 'removed' then
      raise exception 'a removed moment cannot be edited' using errcode = '42501';
    end if;
    if old.status = 'uploading' then
      return new; -- not submitted yet: nothing has been checked, so edit in place
    end if;
    -- checking or live: propose the change; each field starts from the existing proposal if there is one.
    new.pending_photo_path := case when new.photo_path is distinct from old.photo_path then new.photo_path
                                   when has_pending then old.pending_photo_path else old.photo_path end;
    new.pending_thumb_path := case when new.thumb_path is distinct from old.thumb_path then new.thumb_path
                                   when has_pending then old.pending_thumb_path else old.thumb_path end;
    new.pending_caption    := case when new.caption is distinct from old.caption then new.caption
                                   when has_pending then old.pending_caption else old.caption end;
    new.pending_edits      := case when new.edits is distinct from old.edits then new.edits
                                   when has_pending then old.pending_edits else old.edits end;
    new.pending_since := now();
    new.photo_path := old.photo_path;
    new.thumb_path := old.thumb_path;
    new.caption := old.caption;
    new.edits := old.edits;
  end if;
  -- Slot moves within the jar are allowed; unique (jar_id, slot) refuses a filled slot.
  return new;
end $$;
