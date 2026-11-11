-- 0008 — ensure_jar RPC: get or create the caller's jar for a local date (FR-JAR-04, FR-JAR-05; D-1; M2-02).
-- Additive only: no column is dropped or renamed.
--
-- The app calls ensure_jar(local_date, tz) with the phone's local date and IANA zone before it inserts
-- a moment. The database decides (rule 1, rule 6):
--   * tz must be a real IANA zone (is_valid_tz, rule 7) and local_date must not be in the future in
--     that zone by the server clock. Past dates are allowed (backfill; moments there get Added later).
--   * Race-safe: two devices calling at once get the same jar. The insert relies on the
--     unique (user_id, local_date) constraint with ON CONFLICT, then reads the winning row.
--   * D-1 westward travel: when local_date is today in tz and a jar for that date already exists in
--     an earlier-ending zone, the jar is re-zoned to tz and ends_at moves to the next local midnight
--     in tz. ends_at never moves earlier: if tz would end the day sooner (eastward), or the date is
--     already over in tz (a backfill call), the jar is returned unchanged. So ends_at always stays the
--     next local midnight in the jar's own tz.
--
-- Returns the full jar row, so the app gets id, tz and ends_at (the "Added later" cut-off) in one round
-- trip. security definer because re-zoning writes server-owned columns (tz, ends_at) that the jar
-- guard refuses to clients; the function itself only ever touches the caller's own jar.

create or replace function public.ensure_jar(local_date date, tz text) returns public.jars
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  j jars;
  zone_ends timestamptz;
begin
  if uid is null then
    raise exception 'sign in to create a jar' using errcode = '42501';
  end if;
  -- security definer skips RLS, so the active-account rule (jars_active_insert, D-11) is checked here.
  if not is_active_user(uid) then
    raise exception 'this account cannot create jars' using errcode = '42501';
  end if;
  if not is_valid_tz(ensure_jar.tz) then
    raise exception 'tz must be an IANA time zone name, got %', ensure_jar.tz using errcode = '22023';
  end if;
  if ensure_jar.local_date is null then
    raise exception 'local_date is required' using errcode = '22023';
  end if;
  if ensure_jar.local_date > (now() at time zone ensure_jar.tz)::date then
    raise exception 'jar date is in the future for its time zone' using errcode = '22023';
  end if;

  zone_ends := ((ensure_jar.local_date + 1)::timestamp at time zone ensure_jar.tz);

  -- A concurrent call either inserts first (we wait for it, then do nothing and read its row) or loses
  -- to ours. The loop covers the jar being deleted between the insert and the read.
  loop
    insert into jars (user_id, local_date, tz)
    values (uid, ensure_jar.local_date, ensure_jar.tz)
    on conflict (user_id, local_date) do nothing
    returning * into j;
    if j.id is not null then
      return j;
    end if;

    select * into j from jars where user_id = uid and local_date = ensure_jar.local_date for update;
    if j.id is not null then
      exit;
    end if;
  end loop;

  -- D-1: re-zone today's jar only when that moves ends_at later.
  if ensure_jar.local_date = (now() at time zone ensure_jar.tz)::date
     and j.tz is distinct from ensure_jar.tz
     and zone_ends > j.ends_at then
    update jars set tz = ensure_jar.tz, ends_at = zone_ends, updated_at = now()
    where id = j.id
    returning * into j;
  end if;

  return j;
end $$;

revoke execute on function public.ensure_jar(date, text) from public, anon;
grant execute on function public.ensure_jar(date, text) to authenticated;
