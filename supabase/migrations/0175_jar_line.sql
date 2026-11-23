-- 0175 — A line for the day (feature list item 5). Additive: one nullable column with a check, and
-- jars_before_insert / jars_before_update (0169) replaced with the same body plus the rules for it. Nothing is
-- dropped, renamed or rewritten; existing jars start with line null.
--
-- jars.line is one optional sentence the owner writes about the day ("Moved into the new flat"), shown with that
-- day's jar. It belongs to the jar row, so whoever may read the jar reads it and nobody else (can_view_jar, 0001):
-- the owner always, others only once the jar is published and its visibility lets them. RPCs that return jar
-- data to others without opening the jar (moment_jar 0067, feed_page, public_jar) list their columns and don't
-- include it.
--   * Only the owner writes it (jars_update RLS, as for the cover and kept_at), on insert or update.
--   * The server trims it and stores an empty line as null; at most 80 characters, one line (no line breaks).
--   * Like bios, it auto-passes moderation in the early version (D-22); the jar's Report covers it.
--   * Changing it never moves the jar in anyone's feed: feed order is published_at and moments' added_at.

alter table public.jars add column if not exists line text
  constraint jars_line_check check (line is null or (char_length(line) between 1 and 80 and line !~ '[\r\n]'));
comment on column public.jars.line is
  'The owner''s one line for the day, trimmed, 1–80 characters, no line breaks; null when unset (0175).';

-- ---------------------------------------------------------------- insert (0169): a trimmed line is allowed
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
  new.line := nullif(btrim(new.line), '');
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

-- ---------------------------------------------------------------- update (0169): owners may write the line
create or replace function public.jars_before_update() returns trigger
language plpgsql as $$
begin
  if new.ends_at < old.ends_at then
    raise exception 'ends_at can only move later' using errcode = '22023';
  end if;
  if new.tz is distinct from old.tz and not public.is_valid_tz(new.tz) then
    raise exception 'tz must be an IANA time zone name, got %', new.tz using errcode = '22023';
  end if;
  new.line := nullif(btrim(new.line), '');
  if public.is_client_role() then
    -- Owners change only visibility, published_at, the cover (0069), kept_at (0169) and the line (0175); every
    -- other column is server-owned, including any column added later. (is_full is generated, so NEW has no
    -- value for it yet.)
    if (to_jsonb(new) - array['visibility', 'published_at', 'cover_moment_id', 'kept_at', 'line', 'updated_at', 'is_full'])
       is distinct from (to_jsonb(old) - array['visibility', 'published_at', 'cover_moment_id', 'kept_at', 'line', 'updated_at', 'is_full']) then
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
