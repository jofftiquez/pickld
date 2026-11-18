-- 0153 — pickld.me/story is a marketing page (the Pickld story), and pickld.me/<username> shares its namespace
-- (C-2, 0016), so story is a reserved username too. Additive only.
insert into public.reserved_usernames (name) values ('story') on conflict do nothing;
