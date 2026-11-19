-- 0169 — Keep a past day to myself (FR-DAY-02, FR-PUB-01). Additive: one nullable column; jars_before_insert
-- (0003) and jars_before_update (0069) are replaced with the same body plus the rules for it. Nothing is
-- dropped, renamed or rewritten; existing jars start with kept_at null.
--
-- My jars lists the owner's ended, unpublished jars from the last 7 days under "Not published", each with
-- Publish and Keep to myself. kept_at is when the owner chose Keep to myself: the jar leaves that list for good
-- and is never asked about again. It changes nothing about who sees the jar or its moments (each moment's own
-- visibility decides that, 0066), and the day page still offers Publish.
--   * Only the owner sets it (jars_update RLS, as for visibility and the cover), stamped with the server clock;
--     the owner may also clear it. A client insert never carries it.
--   * Publishing clears it, so a published jar, the only kind anyone else can read (can_view_jar), never shows
--     that its owner once kept it to themselves.

alter table public.jars add column if not exists kept_at timestamptz;
comment on column public.jars.kept_at is
  'When the owner chose Keep to myself for this unpublished day (My jars, Not published); null otherwise and once published (0169).';

-- ---------------------------------------------------------------- insert (0003): no kept_at from clients
create or replace function public.jars_before_insert() returns trigger
language plpgsql as $$
begin
  if not public.is_valid_tz(new.tz) then
    raise exception 'tz must be an IANA time zone name, got %', new.tz using errcode = '22023';
  end if;
  if new.local_date > (now() at time zone new.tz)::date then
    raise exception 'jar date is in the future for its time zone' using errcode = '22023';
  end if;
  new.ends_at := ((new.local_date + 1)::timestamp at time zone new.tz);
  if public.is_client_role() then
    new.moment_count := 0;
    new.visible_count := 0;
    new.like_count := 0;
    new.comment_count := 0;
    new.created_at := now();
    new.updated_at := now();
    new.kept_at := null;
    if new.published_at is not null then new.published_at := now(); end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- update (0069): owners may keep a jar
create or replace function public.jars_before_update() returns trigger
language plpgsql as $$
begin
  if new.ends_at < old.ends_at then
    raise exception 'ends_at can only move later' using errcode = '22023';
  end if;
  if new.tz is distinct from old.tz and not public.is_valid_tz(new.tz) then
    raise exception 'tz must be an IANA time zone name, got %', new.tz using errcode = '22023';
  end if;
  if public.is_client_role() then
    -- Owners change only visibility, published_at, the cover (0069) and kept_at (0169); every other column is
    -- server-owned, including any column added later. (is_full is generated, so NEW has no value for it yet.)
    if (to_jsonb(new) - array['visibility', 'published_at', 'cover_moment_id', 'kept_at', 'updated_at', 'is_full'])
       is distinct from (to_jsonb(old) - array['visibility', 'published_at', 'cover_moment_id', 'kept_at', 'updated_at', 'is_full']) then
      raise exception 'only visibility and published_at can be changed' using errcode = '42501';
    end if;
    if new.published_at is distinct from old.published_at then
      -- Unpublishing is done by switching to only_me; publishing uses the server clock.
      if new.published_at is null then
        raise exception 'a published jar cannot be unpublished; set visibility to only_me' using errcode = '42501';
      end if;
      new.published_at := case when old.published_at is null then now() else old.published_at end;
    end if;
    -- Keeping uses the server clock; clearing is allowed.
    if new.kept_at is distinct from old.kept_at and new.kept_at is not null then
      new.kept_at := coalesce(old.kept_at, now());
    end if;
    new.updated_at := now();
  end if;
  -- A published jar is never marked kept (it is readable by others).
  if new.published_at is not null then
    new.kept_at := null;
  end if;
  return new;
end $$;
