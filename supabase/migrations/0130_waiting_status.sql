-- 0130 (INV-02, #373): a new account status, `waiting`, for people who signed up during the invite period
-- and have no invite code yet. On its own because Postgres can't use a new enum value in the transaction that
-- adds it; 0131 uses it.
alter type public.profile_status add value if not exists 'waiting';
