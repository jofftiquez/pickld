# Sign in with Apple runbook

FR-ACC-01, FR-PRV-03. Migration 0171, `fn:apple-token`, `supabase/functions/_shared/apple.ts`. Sign up and Sign in on iOS offer Continue with Apple next to the 6-digit email code. There is no Google sign-in. Android shows email only.

## How it works

- **Native, no web flow.** Apple's sheet on the phone returns an identity token; the app sends it to Supabase Auth (`signInWithIdToken`), which checks it against Apple's public keys and the app's bundle id. No Services ID, return URL or client secret is involved, so nothing expires every six months.
- **New account.** An Apple sign-up is an auth user with no profile, exactly like a new email sign-up: About you asks for the birthday (under 13 is purged the same way), the invite code and the invite period apply unchanged, and the account waits during the invite period like any other.
- **Same email, same account.** When the Apple email is the person's real address and an account already uses it, Supabase links Apple to that account (and sends the "New sign-in method" email). With Hide My Email the address is `…@privaterelay.appleid.com`, so it becomes a new account; a pickld.me waitlist place or emailed invite code doesn't carry over by itself, but the code can still be pasted or scanned on Sign up.
- **Name.** Apple shares the person's name only on the first sign-in; the app saves it so About you starts with it filled in.
- **Deleting.** Right after sign-in the app sends Apple's one-time authorization code to `fn:apple-token`, which trades it for a refresh token kept in `apple_tokens` (service role only). Deleting the account (Settings, or the Under 13 purge) revokes that token, which removes Pickld from the person's Apple Account → Sign in with Apple list (App Store Review Guideline 5.1.1(v)). Without the key below, sign-in still works and nothing is stored or revoked.

## One-time setup (founders)

### 1. Apple Developer: the capability

1. developer.apple.com → Account → Certificates, Identifiers & Profiles → Identifiers.
2. Open the App ID `com.teamops.apps.Pickld`. Tick **Sign In with Apple**, leave it **Enable as a primary App ID**, Save, Confirm.
3. Do the same for `com.teamops.apps.Pickld.local` (the Pickld Local build). Xcode's automatic signing usually does this one on the next build; tick it by hand if the build says the profile lacks the entitlement.
4. Nothing else is needed for EAS: the next `eas build` regenerates the provisioning profile with the new capability.

### 2. Apple Developer: the key for revoking (needed before App Review)

1. Certificates, Identifiers & Profiles → Keys → **+**.
2. Name `Pickld Sign in with Apple`, tick **Sign in with Apple** → Configure → Primary App ID `com.teamops.apps.Pickld` → Save → Continue → Register.
3. Note the **Key ID**, then **Download** the `AuthKey_<Key ID>.p8` file. Apple lets you download it once. Keep it in the founders' password manager; never paste it in a chat, an issue or the repo.

### 3. Put the key where the functions read it

The functions read `APPLE_TEAM_ID` (the team that owns the app), `APPLE_SIGN_IN_KEY_ID` and `APPLE_SIGN_IN_KEY` (the whole `.p8` file's text).

- **Staging (GitHub).** Repository → Settings → Environments → `staging`: variable `APPLE_SIGN_IN_KEY_ID` (the Key ID), secret `APPLE_SIGN_IN_KEY` (open the `.p8` in a text editor, copy everything, paste into GitHub's secret box). `APPLE_TEAM_ID` is already a variable there; check it is the team that owns `com.teamops.apps.Pickld`. The next staging deploy passes all three to the Edge Functions.
- **Production.** From a terminal on your own machine: `supabase secrets set --project-ref <ref> APPLE_TEAM_ID=<team id> APPLE_SIGN_IN_KEY_ID=<key id> APPLE_SIGN_IN_KEY="$(cat ~/Downloads/AuthKey_<key id>.p8)"`, then delete the downloaded file once it is in the password manager.
- **Local stack (optional).** Add the same three lines to `supabase/functions/.env` in the main checkout (git-ignored) and restart `pickld-functions`.

### 4. Supabase Auth: turn Apple on

`scripts/deploy/configure.sh` does this on every deploy (Apple on, Client IDs `com.teamops.apps.Pickld`). By hand: Supabase dashboard → Authentication → Sign In / Providers → Apple → Enable, **Client IDs** `com.teamops.apps.Pickld`, leave **Secret Key** empty, Save. The local stack reads `supabase/config.toml` (`auth.external.apple`, both bundle ids) after a stop and start.

### 5. Apple's email relay (for Hide My Email users)

Mail to `…@privaterelay.appleid.com` is dropped unless Apple knows the sender. Certificates, Identifiers & Profiles → Services → **Sign in with Apple for Email Communication** → Configure → add the domain `mail.pickld.me` and the address `hello@mail.pickld.me` (the Resend sender, `waitlist-codes.md`). Apple checks SPF, which Resend's records already set.

## Check

```sql
select count(*) from auth.identities where provider = 'apple';
select count(*) from apple_tokens;  -- grows only once the key is set
```

After deleting a test account that signed in with Apple, it should no longer appear under Settings → your name → Sign in with Apple on that iPhone.
