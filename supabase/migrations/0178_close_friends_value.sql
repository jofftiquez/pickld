-- 0178 — Close friends audience, part 1 of 2: the enum value. Additive: one value on jar_visibility.
-- Postgres can't use a new enum value in the transaction that adds it, so 0179 has the rules.
alter type public.jar_visibility add value if not exists 'close_friends';
