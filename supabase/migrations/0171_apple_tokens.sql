-- 0171 (FR-ACC-01, FR-PRV-03): Sign in with Apple refresh tokens, kept only so deleting an account can revoke the
-- person's Sign in with Apple link (App Store Review Guideline 5.1.1(v); Apple TN3194). fn:apple-token stores the
-- token right after sign-in; the account purges (fn:account-jobs, fn:account-purge) revoke it, and the row goes
-- with the auth user. Service role only: no client grants. Additive: a new table, nothing existing changes.
create table public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  client_id text not null,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
comment on table public.apple_tokens is
  'Sign in with Apple refresh token per account, for revoking at account deletion (0171). Service role only.';
comment on column public.apple_tokens.client_id is 'The bundle id the token was issued to (me.pickld.app or the local variant).';

alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from public, anon, authenticated;
