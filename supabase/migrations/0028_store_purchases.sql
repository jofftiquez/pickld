-- 0028 — Store purchases unlock packs (FR-STK-07; M6-01). Additive only: no column is dropped or renamed.
--
-- fn:revenuecat-webhook (and, from M6-03, the app's "check my purchases" call) reads a buyer's verified
-- one-time purchases from RevenueCat's REST API and hands them here. Postgres maps each store product to its
-- pack through sticker_packs.store_product_id and makes the buyer's `purchase` rows in owned_packs match the
-- list exactly: new purchases are granted, and purchases RevenueCat no longer lists (a refund, or a restore
-- that transferred them to another account) are taken away. Earned and other rows are never touched, and a
-- pack the user already has another way keeps that row. Seasonal packs stay owned after their season
-- (FR-STK-07): availability dates only control what the shop sells, never what a buyer keeps.
--
-- Only the service role may call it (Edge Functions); clients still can't write owned_packs (0010).

create or replace function public.store_purchases_sync(p_user uuid, p_purchases jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  granted text[];
  revoked text[];
begin
  if p_purchases is null or jsonb_typeof(p_purchases) <> 'array' then
    raise exception 'p_purchases must be a JSON array' using errcode = '22023';
  end if;
  -- An id RevenueCat knows but Pickld doesn't (deleted account, another environment): nothing to do.
  if not exists (select 1 from profiles where id = p_user) then
    return null;
  end if;

  -- One statement: both changes see the same snapshot and touch different rows.
  with bought as (
    select distinct on (sp.id) sp.id as pack_id, x.transaction_id
    from jsonb_to_recordset(p_purchases) as x(product_id text, transaction_id text)
    join sticker_packs sp on sp.store_product_id = x.product_id
    order by sp.id, x.transaction_id
  ), ins as (
    insert into owned_packs (user_id, pack_id, source, store_transaction_id)
    select p_user, b.pack_id, 'purchase', b.transaction_id from bought b
    on conflict (user_id, pack_id) do nothing
    returning pack_id
  ), del as (
    delete from owned_packs o
    where o.user_id = p_user and o.source = 'purchase'
      and not exists (select 1 from bought b where b.pack_id = o.pack_id)
    returning o.pack_id
  )
  select
    coalesce((select array_agg(sp.slug order by sp.sort) from ins join sticker_packs sp on sp.id = ins.pack_id), '{}'),
    coalesce((select array_agg(sp.slug order by sp.sort) from del join sticker_packs sp on sp.id = del.pack_id), '{}')
  into granted, revoked;

  return jsonb_build_object('granted', to_jsonb(granted), 'revoked', to_jsonb(revoked));
end;
$$;

revoke execute on function public.store_purchases_sync(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_purchases_sync(uuid, jsonb) to service_role;
