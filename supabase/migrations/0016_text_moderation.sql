-- 0016 — Text moderation for the early version (M3-10; FR-SOC-06, FR-ACC-03, FR-SOC-11; D-22, C-2).
-- Additive only: one new table, three functions and two triggers. No column is dropped or renamed.
--
--   * Comments: a client's comment is inserted hidden (0005). fn:moderate checks its text through the
--     provider seam (D-22: auto-approve, nothing is called) and hands the verdict to
--     moderation_apply_comment(), owned by pickld_moderation like moderation_apply() (0011). That is now
--     the only way is_hidden changes (rule 4): clients have no update right on comments (0005), and a
--     guard refuses every other role, service_role included.
--   * Usernames: route words are reserved (C-2: pickld.me/<username> shares the namespace with the web
--     routes and the app's deep links). The database refuses them at save, in any letter case, through
--     a trigger on profiles, so no client path can skip the check. Existing rows are not re-validated.
--     Usernames and bios otherwise auto-pass (D-22); they have nothing to hide while checked.

-- ---------------------------------------------------------------- reserved usernames
create table public.reserved_usernames (
  name citext primary key
);
comment on table public.reserved_usernames is
  'Usernames nobody may take (C-2): web and app route words and names that could pose as Pickld. '
  'Read only through is_reserved_username(); no client grants.';
alter table public.reserved_usernames enable row level security;
revoke all on public.reserved_usernames from anon, authenticated;

-- Only names the username format allows (3–20 of [A-Za-z0-9._]) are listed; shorter routes such as
-- /j/<id> and /u/<username> can't collide.
insert into public.reserved_usernames (name) values
  ('about'), ('account'), ('accounts'), ('admin'), ('administrator'), ('api'), ('app'), ('apps'),
  ('assets'), ('auth'), ('authors'), ('blocked'), ('blog'), ('callback'), ('camera'), ('capture'),
  ('check'), ('checkemail'), ('comments'), ('contact'), ('crop'), ('delete'), ('dev'), ('download'),
  ('edit'), ('explore'), ('feed'), ('help'), ('home'), ('intro'), ('invite'), ('jar'), ('jars'),
  ('legal'), ('login'), ('logout'), ('memories'), ('mine'), ('mod'), ('moderation'), ('moderator'),
  ('moment'), ('moments'), ('mydays'), ('notifications'), ('null'), ('official'), ('pack'), ('pickld'),
  ('pickldapp'), ('privacy'), ('profile'), ('publish'), ('readers'), ('root'), ('search'), ('security'),
  ('settings'), ('setup'), ('share'), ('shop'), ('signin'), ('signup'), ('staff'), ('static'),
  ('status'), ('stickers'), ('support'), ('system'), ('team'), ('terms'), ('today'), ('undefined'),
  ('welcome'), ('www');

create or replace function public.is_reserved_username(candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from reserved_usernames r where r.name = candidate::citext)
$$;
revoke execute on function public.is_reserved_username(text) from public, anon;
grant execute on function public.is_reserved_username(text) to authenticated, service_role;

create or replace function public.profiles_refuse_reserved_username() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username)
     and public.is_reserved_username(new.username) then
    raise exception 'username_reserved' using errcode = '23514',
      hint = 'This username is reserved. Choose another one.';
  end if;
  return new;
end $$;
create trigger profiles_reserved_username before insert or update of username on public.profiles
  for each row execute function public.profiles_refuse_reserved_username();

-- ---------------------------------------------------------------- comments: only moderation unhides
grant select, update on public.comments to pickld_moderation;
create policy comments_moderation_select on public.comments for select to pickld_moderation using (true);
create policy comments_moderation_update on public.comments for update to pickld_moderation
  using (true) with check (true);

create or replace function public.comments_guard_hidden() returns trigger
language plpgsql as $$
begin
  if new.is_hidden is distinct from old.is_hidden and current_user <> 'pickld_moderation' then
    raise exception 'comment visibility can only be set by moderation' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger comments_guard_hidden before update of is_hidden on public.comments
  for each row execute function public.comments_guard_hidden();

-- Applies fn:moderate's verdict on a comment's text. Returns:
--   visible            approved: others can see it now
--   queued             left hidden for a human (a moderation_items row, source auto_check, pending)
--   removed            refused: stays hidden, a decided moderation_items row is recorded
--   nothing_to_check   already visible, or deleted
--   not_found
-- While an auto_check item for the comment is open, a human decides and the result is 'queued'.
create or replace function public.moderation_apply_comment(
  p_comment_id uuid,
  p_decision text,
  p_provider text,
  p_scores jsonb default '{}'::jsonb,
  p_reason text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  c comments;
  item jsonb := jsonb_build_object('provider', p_provider, 'scores', coalesce(p_scores, '{}'::jsonb));
begin
  if p_decision is null or p_decision not in ('approve', 'review', 'remove') then
    raise exception 'decision must be approve, review or remove' using errcode = '22023';
  end if;
  if p_provider is null or p_provider = '' then
    raise exception 'provider is required' using errcode = '22023';
  end if;

  select * into c from comments where id = p_comment_id for update;
  if c.id is null then
    return 'not_found';
  end if;
  if not c.is_hidden or c.deleted_at is not null then
    return 'nothing_to_check';
  end if;
  if exists (select 1 from moderation_items
             where comment_id = c.id and source = 'auto_check' and status in ('pending', 'escalated')) then
    return 'queued';
  end if;

  if p_decision = 'approve' then
    update comments set is_hidden = false where id = c.id;
    return 'visible';
  end if;
  if p_decision = 'review' then
    insert into moderation_items (comment_id, source, scores, status, decision_reason)
    values (c.id, 'auto_check', item, 'pending', p_reason);
    return 'queued';
  end if;
  insert into moderation_items (comment_id, source, scores, status, decided_at, decision_reason)
  values (c.id, 'auto_check', item, 'removed', now(), p_reason);
  return 'removed';
end $$;

-- Changing the owner needs CREATE on the schema; the role keeps no such right afterwards.
grant create on schema public to pickld_moderation;
alter function public.moderation_apply_comment(uuid, text, text, jsonb, text) owner to pickld_moderation;
revoke create on schema public from pickld_moderation;
revoke execute on function public.moderation_apply_comment(uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.moderation_apply_comment(uuid, text, text, jsonb, text) to service_role;
