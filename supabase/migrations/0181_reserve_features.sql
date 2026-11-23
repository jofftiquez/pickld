-- 0181 — pickld.me/features is a marketing page (what's new in Pickld), and pickld.me/<username> shares its
-- namespace (C-2, 0016), so features is a reserved username too. Additive only.
insert into public.reserved_usernames (name) values ('features') on conflict do nothing;
