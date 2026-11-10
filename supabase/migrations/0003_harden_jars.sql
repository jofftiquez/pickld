-- 0003 — Harden jars, add travel and visible-count fields (docs/analysis.md S-5, S-9, G-1, G-11; D-1, D-9; M1-08).
-- Additive only: no column is dropped or renamed.

-- ---------------------------------------------------------------- S-9: IANA zone names
-- A zone must be a real IANA region name (rule 7): "Asia/Manila" or "UTC". Offsets ("+08:00"),
-- abbreviations ("PST"), POSIX rules ("PST8PDT") and the posix/ and right/ aliases are refused.
create or replace function public.is_valid_tz(name text) returns boolean
language sql stable as $$
  select name is not null
     and (name = 'UTC' or (name like '%/%' and name not like 'posix/%' and name not like 'right/%'))
     and exists (select 1 from pg_timezone_names t where t.name = is_valid_tz.name)
$$;

-- ---------------------------------------------------------------- D-1, D-9: new columns
alter table public.jars add column ends_at timestamptz;
alter table public.jars add column visible_count smallint not null default 0;
comment on column public.jars.ends_at is
  'End of the jar''s day, set by the server: next local midnight in tz. Only ever moves later (D-1).';
comment on column public.jars.visible_count is
  'Live, non-private moments: the count others see. moment_count (all non-removed) is the owner''s count (D-9).';

update public.jars set ends_at = ((local_date + 1)::timestamp at time zone tz) where ends_at is null;
alter table public.jars alter column ends_at set not null;

-- The jar's end is now the stored value, so moving it later (D-1) also moves the "Added later" cut-off.
create or replace function public.jar_ends_at(j public.jars) returns timestamptz
language sql stable as $$
  select coalesce(j.ends_at, ((j.local_date + 1)::timestamp at time zone j.tz))
$$;

-- ---------------------------------------------------------------- S-5, S-9: guards
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
    if new.published_at is not null then new.published_at := now(); end if;
  end if;
  return new;
end $$;
create trigger jars_bi before insert on public.jars for each row execute function public.jars_before_insert();

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
    -- Owners change only visibility and published_at; every other column is server-owned,
    -- including any column added later. (is_full is generated, so NEW has no value for it yet.)
    if (to_jsonb(new) - array['visibility', 'published_at', 'updated_at', 'is_full'])
       is distinct from (to_jsonb(old) - array['visibility', 'published_at', 'updated_at', 'is_full']) then
      raise exception 'only visibility and published_at can be changed' using errcode = '42501';
    end if;
    if new.published_at is distinct from old.published_at then
      -- Unpublishing is done by switching to only_me; publishing uses the server clock.
      if new.published_at is null then
        raise exception 'a published jar cannot be unpublished; set visibility to only_me' using errcode = '42501';
      end if;
      new.published_at := case when old.published_at is null then now() else old.published_at end;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger jars_bu before update on public.jars for each row execute function public.jars_before_update();

-- ---------------------------------------------------------------- D-9: counters
-- moment_count: every moment that isn't removed (the owner's "n of 8", Full jar, jar_count).
-- visible_count: live, non-private moments (what others see).
create or replace function public.moments_count_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  jid uuid;
begin
  foreach jid in array array_remove(array[old.jar_id, new.jar_id], null) loop
    update jars set
      moment_count  = (select count(*) from moments where jar_id = jid and status <> 'removed'),
      visible_count = (select count(*) from moments where jar_id = jid and status = 'live' and not is_private),
      updated_at = now()
    where id = jid;
    update profiles p set jar_count = (select count(*) from jars where user_id = p.id and moment_count > 0)
    where p.id = (select user_id from jars where id = jid);
  end loop;
  return null;
end $$;
drop trigger moments_count on public.moments;
create trigger moments_count after insert or delete or update of status, is_private, jar_id on public.moments
  for each row execute function public.moments_count_sync();

update public.jars j set visible_count =
  (select count(*) from public.moments m where m.jar_id = j.id and m.status = 'live' and not m.is_private);
