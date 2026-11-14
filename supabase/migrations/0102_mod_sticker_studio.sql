-- 0102 — The console's Sticker Studio (FR-MOD-10): moderators stage free sticker packs as drafts, add PNG art,
-- edit labels, tags and slot hints, retire stickers, and publish. Additive: new functions only. Catalog tables
-- keep their 0012 grants (writes are service-role only); these functions are the one other way to write them.
-- Like mod_suspend() (0090) they refuse anyone without app_metadata.role = 'moderator' in the JWT, need the
-- moderator to have a profile (the audit row names them), are owned by the migration owner, and write an
-- audit row for every change. Audit rows carry the pack slug and sticker name in data; target stays null
-- because target_type has no sticker value.
--
-- Only free packs are edited here: premium, earned and seasonal packs carry store, milestone and date rules
-- the Studio doesn't manage, so they are read-only in the console.
--
-- 0100's rules still apply underneath: a pack goes draft → published, never back; in a published pack a
-- sticker's art (asset_path, art_version) never changes, so new art is a new name; every live sticker needs
-- its size before publishing.
--
--   mod_studio_create_pack(slug, name, description)        a new free draft pack.
--   mod_studio_edit_pack(pack, name, description)
--   mod_studio_art_key(pack, name)                          the object key fn:sticker-studio may upload to,
--                                                           and whether it replaces a draft sticker's art.
--   mod_studio_put_art(pack, name, label, width, height)    after the upload: adds the sticker, or (draft
--                                                           packs only) records the replaced art and bumps
--                                                           art_version so clients fetch the new file.
--   mod_studio_edit_sticker(sticker, label, tags, slot)
--   mod_studio_set_retired(sticker, retired)                retire or restore.
--   mod_studio_publish(pack)

create or replace function public.mod_studio_actor() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  actor uuid := public.mod_require_moderator();
begin
  if not exists (select 1 from profiles where id = actor) then
    raise exception 'the moderator has no profile' using errcode = '42501';
  end if;
  return actor;
end $$;

-- Slugs and sticker names become object keys: stickers/<slug>/<name>.png (0012's asset_path check). Letters,
-- digits and inner hyphens.
create or replace function public.mod_studio_valid_part(p text, p_max int) returns boolean
language sql immutable set search_path = public as $$
  select p is not null and char_length(p) <= p_max and p ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
$$;

create or replace function public.mod_studio_text(p text, p_max int) returns text
language plpgsql immutable set search_path = public as $$
declare
  v text := btrim(coalesce(p, ''));
begin
  if char_length(v) = 0 or char_length(v) > p_max then
    raise exception 'text of 1 to % characters is required', p_max using errcode = '22023';
  end if;
  return v;
end $$;

create or replace function public.mod_studio_description(p text) returns text
language plpgsql immutable set search_path = public as $$
declare
  v text := nullif(btrim(coalesce(p, '')), '');
begin
  if char_length(v) > 200 then
    raise exception 'a description is at most 200 characters' using errcode = '22023';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------- packs
create or replace function public.mod_studio_create_pack(p_slug text, p_name text, p_description text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  v_name text := public.mod_studio_text(p_name, 40);
  v_description text := public.mod_studio_description(p_description);
  v_id uuid;
begin
  if not public.mod_studio_valid_part(p_slug, 40) then
    return jsonb_build_object('result', 'bad_slug');
  end if;
  if exists (select 1 from sticker_packs where slug = p_slug) then
    return jsonb_build_object('result', 'slug_taken');
  end if;
  insert into sticker_packs (slug, name, tier, status, description, sort)
  values (p_slug, v_name, 'free', 'draft', v_description, (select coalesce(max(sort), 0) + 1 from sticker_packs))
  returning id into v_id;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, 'studio_pack_create', v_id, jsonb_build_object('pack', p_slug));
  return jsonb_build_object('result', 'created', 'id', v_id);
end $$;

create or replace function public.mod_studio_edit_pack(p_pack uuid, p_name text, p_description text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  v_name text := public.mod_studio_text(p_name, 40);
  v_description text := public.mod_studio_description(p_description);
  p sticker_packs;
begin
  select * into p from sticker_packs where id = p_pack for update;
  if p.id is null then return jsonb_build_object('result', 'not_found'); end if;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  update sticker_packs set name = v_name, description = v_description where id = p.id;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, 'studio_pack_edit', p.id, jsonb_build_object('pack', p.slug));
  return jsonb_build_object('result', 'saved');
end $$;

create or replace function public.mod_studio_publish(p_pack uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  p sticker_packs;
  live int;
begin
  select * into p from sticker_packs where id = p_pack for update;
  if p.id is null then return jsonb_build_object('result', 'not_found'); end if;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  if p.status = 'published' then return jsonb_build_object('result', 'already_published'); end if;
  select count(*) into live from stickers where pack_id = p.id and retired_at is null;
  if live = 0 then return jsonb_build_object('result', 'empty'); end if;
  if exists (select 1 from stickers
             where pack_id = p.id and retired_at is null and (art_width is null or art_height is null)) then
    return jsonb_build_object('result', 'missing_size');
  end if;
  update sticker_packs set status = 'published' where id = p.id;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, 'studio_pack_publish', p.id, jsonb_build_object('pack', p.slug, 'count', live));
  return jsonb_build_object('result', 'published', 'count', live);
end $$;

-- ---------------------------------------------------------------- art
create or replace function public.mod_studio_art_key(p_pack uuid, p_name text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p sticker_packs;
  key text;
  existing stickers;
begin
  perform public.mod_studio_actor();
  if not public.mod_studio_valid_part(p_name, 60) then return jsonb_build_object('result', 'bad_name'); end if;
  select * into p from sticker_packs where id = p_pack;
  if p.id is null then return jsonb_build_object('result', 'not_found'); end if;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  key := 'stickers/' || p.slug || '/' || p_name || '.png';
  select * into existing from stickers where asset_path = key;
  -- Published art is cached for a year under its key (D-25), so a published key is never written again.
  if existing.id is not null and p.status = 'published' then
    return jsonb_build_object('result', 'name_taken');
  end if;
  return jsonb_build_object('result', 'ok', 'key', key, 'replace', existing.id is not null);
end $$;

create or replace function public.mod_studio_put_art(
  p_pack uuid, p_name text, p_label text, p_width int, p_height int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  p sticker_packs;
  key text;
  existing stickers;
  v_label text;
  v_id uuid;
  v_version int;
begin
  if not public.mod_studio_valid_part(p_name, 60) then return jsonb_build_object('result', 'bad_name'); end if;
  if p_width is null or p_height is null or p_width not between 1 and 2048 or p_height not between 1 and 2048 then
    raise exception 'art is 1 to 2048 pixels on each side' using errcode = '22023';
  end if;
  -- Locks the pack, so publishing waits for this row.
  select * into p from sticker_packs where id = p_pack for update;
  if p.id is null then return jsonb_build_object('result', 'not_found'); end if;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  key := 'stickers/' || p.slug || '/' || p_name || '.png';
  select * into existing from stickers where asset_path = key for update;

  if existing.id is not null then
    if p.status = 'published' then return jsonb_build_object('result', 'name_taken'); end if;
    v_label := case when nullif(btrim(coalesce(p_label, '')), '') is null then existing.label
                    else public.mod_studio_text(p_label, 40) end;
    update stickers
    set art_width = p_width, art_height = p_height, art_version = art_version + 1, retired_at = null,
        label = v_label
    where id = existing.id
    returning id, art_version into v_id, v_version;
    insert into audit_log (actor_id, action, target_id, data)
    values (actor, 'studio_sticker_replace', p.id,
            jsonb_build_object('pack', p.slug, 'sticker', p_name, 'version', v_version));
    return jsonb_build_object('result', 'replaced', 'id', v_id, 'version', v_version);
  end if;

  -- An empty label becomes the name in words: "blue-heart" → "Blue heart".
  v_label := case when nullif(btrim(coalesce(p_label, '')), '') is null
                  then upper(left(replace(p_name, '-', ' '), 1)) || substr(replace(p_name, '-', ' '), 2)
                  else public.mod_studio_text(p_label, 40) end;
  insert into stickers (pack_id, label, asset_path, art_width, art_height, sort)
  values (p.id, left(v_label, 40), key, p_width, p_height,
          (select coalesce(max(sort), 0) + 1 from stickers where pack_id = p.id))
  returning id, art_version into v_id, v_version;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, 'studio_sticker_add', p.id, jsonb_build_object('pack', p.slug, 'sticker', p_name));
  return jsonb_build_object('result', 'added', 'id', v_id, 'version', v_version);
end $$;

-- ---------------------------------------------------------------- stickers
create or replace function public.mod_studio_edit_sticker(
  p_sticker uuid, p_label text, p_tags text[] default '{}', p_slot_hint slot default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  v_label text := public.mod_studio_text(p_label, 40);
  v_tags text[];
  s stickers;
  p sticker_packs;
begin
  -- Tags are search words: lower case, trimmed, no duplicates, at most 12 of up to 24 characters.
  select coalesce(array_agg(t order by first), '{}') into v_tags
  from (select t, min(n) as first
        from unnest(coalesce(p_tags, '{}')) with ordinality as u(raw, n), lower(btrim(raw)) as t
        where t <> '' group by t) x;
  if cardinality(v_tags) > 12 or exists (select 1 from unnest(v_tags) t where char_length(t) > 24) then
    raise exception 'at most 12 tags of up to 24 characters' using errcode = '22023';
  end if;
  select * into s from stickers where id = p_sticker for update;
  if s.id is null then return jsonb_build_object('result', 'not_found'); end if;
  select * into p from sticker_packs where id = s.pack_id;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  update stickers set label = v_label, tags = v_tags, slot_hint = p_slot_hint where id = s.id;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, 'studio_sticker_edit', p.id,
          jsonb_build_object('pack', p.slug, 'sticker', regexp_replace(s.asset_path, '^.*/|\.png$', '', 'g')));
  return jsonb_build_object('result', 'saved');
end $$;

create or replace function public.mod_studio_set_retired(p_sticker uuid, p_retired boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := public.mod_studio_actor();
  s stickers;
  p sticker_packs;
begin
  select * into s from stickers where id = p_sticker for update;
  if s.id is null then return jsonb_build_object('result', 'not_found'); end if;
  select * into p from sticker_packs where id = s.pack_id;
  if p.tier <> 'free' then return jsonb_build_object('result', 'not_editable'); end if;
  if (s.retired_at is not null) = coalesce(p_retired, false) then
    return jsonb_build_object('result', 'unchanged');
  end if;
  -- Retired stickers leave the picker but still draw on moments that used them (D-42).
  update stickers set retired_at = case when p_retired then now() end where id = s.id;
  insert into audit_log (actor_id, action, target_id, data)
  values (actor, case when p_retired then 'studio_sticker_retire' else 'studio_sticker_restore' end, p.id,
          jsonb_build_object('pack', p.slug, 'sticker', regexp_replace(s.asset_path, '^.*/|\.png$', '', 'g')));
  return jsonb_build_object('result', case when p_retired then 'retired' else 'restored' end);
end $$;

-- ---------------------------------------------------------------- grants
revoke all on function public.mod_studio_actor() from public, anon, authenticated;
revoke all on function public.mod_studio_valid_part(text, int) from public, anon, authenticated;
revoke all on function public.mod_studio_text(text, int) from public, anon, authenticated;
revoke all on function public.mod_studio_description(text) from public, anon, authenticated;
revoke all on function public.mod_studio_create_pack(text, text, text) from public, anon;
revoke all on function public.mod_studio_edit_pack(uuid, text, text) from public, anon;
revoke all on function public.mod_studio_publish(uuid) from public, anon;
revoke all on function public.mod_studio_art_key(uuid, text) from public, anon;
revoke all on function public.mod_studio_put_art(uuid, text, text, int, int) from public, anon;
revoke all on function public.mod_studio_edit_sticker(uuid, text, text[], slot) from public, anon;
revoke all on function public.mod_studio_set_retired(uuid, boolean) from public, anon;
grant execute on function public.mod_studio_create_pack(text, text, text) to authenticated;
grant execute on function public.mod_studio_edit_pack(uuid, text, text) to authenticated;
grant execute on function public.mod_studio_publish(uuid) to authenticated;
grant execute on function public.mod_studio_art_key(uuid, text) to authenticated;
grant execute on function public.mod_studio_put_art(uuid, text, text, int, int) to authenticated;
grant execute on function public.mod_studio_edit_sticker(uuid, text, text[], slot) to authenticated;
grant execute on function public.mod_studio_set_retired(uuid, boolean) to authenticated;
