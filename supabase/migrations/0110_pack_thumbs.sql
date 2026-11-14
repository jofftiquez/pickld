-- 0110 — Thumbs up on sticker packs (FR-STK-07). Additive: one table, one trigger and four functions. Nothing
-- is dropped or renamed.
--
-- A signed-in person gives a published pack one thumbs up, and can take it back. Pack preview shows the
-- count and the viewer's own thumb; the shop shows the count on each card; the console's Stickers section
-- shows thumbs per pack.
--
--   pack_thumbs                 one row per person per pack (primary key). Clients read only their own rows
--                               and never write the table directly: set_pack_thumb() is the one way in.
--   set_pack_thumb(pack, on)    sets the caller's thumb on or off and returns { thumbed, thumbs }. Setting it
--                               to what it already is changes nothing, so retries and fast taps are safe (the
--                               last request wins). Refused for a signed-out or inactive caller (suspended or
--                               deleted, D-11) and for a pack that isn't published (drafts, 0100) or doesn't
--                               exist.
--   pack_thumbs()               every published pack with its count and whether the caller gave a thumb. The
--                               count leaves out people whose account isn't active and people with a block
--                               either way with the caller, so it is per viewer. Their rows stay and count
--                               again if the account is restored or the block lifted.
--   mod_sticker_thumbs(days)    moderators only: thumbs per pack, all time and in the last 7–90 days, from
--                               active accounts (no block filter: it is not one viewer's view).
--
-- Thumbs are only ever counts: nobody can see who gave one, so a thumb never reveals one person to another.

-- ---------------------------------------------------------------- table
create table public.pack_thumbs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id uuid not null references public.sticker_packs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);
create index pack_thumbs_pack_idx on public.pack_thumbs (pack_id, created_at);
comment on table public.pack_thumbs is
  'One thumbs up per person per published sticker pack (0110). Written only through set_pack_thumb().';

alter table public.pack_thumbs enable row level security;
revoke all on public.pack_thumbs from public, anon, authenticated;
grant select on public.pack_thumbs to authenticated;
create policy pack_thumbs_select_own on public.pack_thumbs for select to authenticated
  using (user_id = auth.uid());

-- The database refuses a thumb on a draft pack, whoever writes it (service role included).
create or replace function public.pack_thumbs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from sticker_packs where id = new.pack_id and status = 'published') then
    raise exception 'only a published sticker pack can get a thumbs up' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.pack_thumbs_guard() from public, anon, authenticated;
create trigger pack_thumbs_guard before insert or update on public.pack_thumbs
  for each row execute function public.pack_thumbs_guard();

-- ---------------------------------------------------------------- counts
-- A pack's count as `viewer` sees it: thumbs from active accounts with no block either way with viewer.
create or replace function public.pack_thumb_count(p_pack uuid, viewer uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int
  from pack_thumbs t
  join profiles p on p.id = t.user_id and p.status = 'active'
  where t.pack_id = p_pack
    and not exists (select 1 from blocks b
                    where (b.blocker_id = viewer and b.blocked_id = t.user_id)
                       or (b.blocker_id = t.user_id and b.blocked_id = viewer))
$$;
revoke execute on function public.pack_thumb_count(uuid, uuid) from public, anon, authenticated;

create or replace function public.pack_thumbs()
returns table (pack_id uuid, thumbs int, mine boolean)
language sql stable security definer set search_path = public as $$
  select sp.id,
         coalesce(c.n, 0)::int,
         exists (select 1 from pack_thumbs m where m.pack_id = sp.id and m.user_id = auth.uid())
  from sticker_packs sp
  left join (
    select t.pack_id, count(*) as n
    from pack_thumbs t
    join profiles p on p.id = t.user_id and p.status = 'active'
    where not exists (select 1 from blocks b
                      where (b.blocker_id = auth.uid() and b.blocked_id = t.user_id)
                         or (b.blocker_id = t.user_id and b.blocked_id = auth.uid()))
    group by t.pack_id
  ) c on c.pack_id = sp.id
  where sp.status = 'published' and auth.uid() is not null
$$;
revoke execute on function public.pack_thumbs() from public, anon;
grant execute on function public.pack_thumbs() to authenticated;
comment on function public.pack_thumbs() is
  'Every published pack with its thumbs-up count as the caller sees it (active accounts, no block either way) and whether the caller gave one (0110).';

-- ---------------------------------------------------------------- on and off
create or replace function public.set_pack_thumb(p_pack uuid, p_on boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not is_active_user(uid) then
    raise exception 'an active account is required' using errcode = '42501';
  end if;
  if p_on is null then
    raise exception 'p_on is required' using errcode = '22023';
  end if;
  if not exists (select 1 from sticker_packs where id = p_pack and status = 'published') then
    raise exception 'sticker pack not found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into pack_thumbs (user_id, pack_id) values (uid, p_pack) on conflict (user_id, pack_id) do nothing;
  else
    delete from pack_thumbs where user_id = uid and pack_id = p_pack;
  end if;
  return jsonb_build_object('thumbed', p_on, 'thumbs', pack_thumb_count(p_pack, uid));
end $$;
revoke execute on function public.set_pack_thumb(uuid, boolean) from public, anon;
grant execute on function public.set_pack_thumb(uuid, boolean) to authenticated;
comment on function public.set_pack_thumb(uuid, boolean) is
  'Sets the caller''s thumbs up on a published pack on or off; returns { thumbed, thumbs } (0110).';

-- ---------------------------------------------------------------- console
create or replace function public.mod_sticker_thumbs(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  days int := least(greatest(coalesce(p_days, 30), 7), 90);
  first_day date;
  out jsonb;
begin
  perform mod_require_moderator();
  first_day := (mod_day_start() at time zone 'Asia/Manila')::date - (days - 1);

  with t as (
    select t.pack_id, (t.created_at at time zone 'Asia/Manila')::date >= first_day as recent
    from pack_thumbs t join profiles p on p.id = t.user_id and p.status = 'active'),
       per_pack as (
    select pack_id, count(*) as thumbs, count(*) filter (where recent) as thumbs_window from t group by pack_id)
  select jsonb_build_object(
    'days', days,
    'first_day', first_day,
    'total', (select count(*) from t),
    'total_window', (select count(*) from t where recent),
    'packs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sp.id, 'slug', sp.slug, 'name', sp.name, 'tier', sp.tier, 'status', sp.status,
               'thumbs', coalesce(pp.thumbs, 0), 'thumbs_window', coalesce(pp.thumbs_window, 0))
             order by coalesce(pp.thumbs, 0) desc, sp.sort, sp.name)
      from sticker_packs sp left join per_pack pp on pp.pack_id = sp.id), '[]'::jsonb))
  into out;
  return out;
end $$;
revoke all on function public.mod_sticker_thumbs(int) from public, anon;
grant execute on function public.mod_sticker_thumbs(int) to authenticated;
comment on function public.mod_sticker_thumbs(int) is
  'Moderators only: thumbs up per pack from active accounts, all time and in the last p_days (7–90) Manila days (0110).';
