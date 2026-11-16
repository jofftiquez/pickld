-- 0152 — pickld.me/why and pickld.me/mission are marketing pages (Why Pickld, Our mission), and pickld.me/<username>
-- shares their namespace (C-2, 0016), so both words are reserved usernames. Additive only.
insert into public.reserved_usernames (name) values ('why'), ('mission') on conflict do nothing;
