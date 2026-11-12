-- 0024 — Clear contact_hashes for device-made hashes (FR-ONB-06; D-28; M4-08).
-- Additive only: no schema change. Nothing is dropped, renamed or altered.
--
-- D-28: the phone now normalizes and SHA-256-hashes each contact, and fn:contacts-match keys that device
-- hash with HMAC-SHA256(CONTACT_HASH_SECRET, sha256hex("email:" + email)). Rows written by the old
-- formula, HMAC(secret, "email:" + email), would never match again, and contact_hashes_pending() (0015)
-- only refreshes rows that are missing or older than the auth record, so it would never replace them.
-- contact_hashes is a derived cache the function refills on every call (0015's note on key rotation:
-- truncate the table and let calls refill it), so emptying it is safe and is all this does.

truncate public.contact_hashes;
