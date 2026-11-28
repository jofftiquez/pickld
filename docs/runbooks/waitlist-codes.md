# Waitlist codes runbook

INV-09 (#380), migration 0143 and `fn:waitlist-send`. Founders email a one-use invite code to the earliest people on the pickld.me waitlist who aren't in yet. Each email has its own code and a link to `pickld.me/i/<code>`; the code lasts 14 days from when the email went out. Email goes through Resend.

Sending codes doesn't start the invite period. Codes work whether the period is on or off; see `invite-period.md`.

## One-time setup (founders)

1. **Resend account.** Sign up at resend.com with the founders' shared address.
2. **Domain.** Resend → Domains → Add `mail.pickld.me` (a subdomain keeps the main domain's mail reputation separate). Add the records Resend shows (SPF `TXT`, DKIM `TXT`, the `MX` for bounces) in Cloudflare → pickld.me → DNS → Records (DNS only, grey cloud), then add a DMARC record if pickld.me has none: `TXT _dmarc.mail` with `v=DMARC1; p=none; rua=mailto:<founders' address>`. Wait until Resend shows the domain as Verified.
3. **API key.** Resend → API Keys → Create, permission "Sending access", domain `mail.pickld.me`. Copy it once; don't paste it anywhere else.
4. **Staging.** On the GitHub environment `staging`: secret `RESEND_API_KEY` (the key) and variable `EMAIL_FROM` (`Pickld <hello@mail.pickld.me>`). The next staging deploy passes both to the Edge Functions, with `SITE_URL` from `WEB_URL`.
5. **Production.** Set the same values on the production project: `supabase secrets set --project-ref <ref> RESEND_API_KEY=… EMAIL_FROM='Pickld <hello@mail.pickld.me>' SITE_URL=https://pickld.me`.
6. **Sign-in codes (same account).** The next deploy does this once `RESEND_API_KEY` and `EMAIL_FROM` are on the GitHub environment (`scripts/deploy/configure.sh`). By hand: Supabase → Authentication → SMTP Settings → enable custom SMTP: host `smtp.resend.com`, port `465`, username `resend`, password the API key, sender `hello@mail.pickld.me`, name `Pickld`. Then raise the email rate limit (Authentication → Rate Limits). This replaces Supabase's built-in sender and its organization-members-only limit (see `staging.md`).

Before a large send, check the Resend account's daily sending limit; it is low on the free plan. A send that hits it stops, and the rest keep their codes for the next send.

## Send a batch

Console → Waitlist → Send codes. Founders only (moderators whose auth `app_metadata` has `"founder": true`); other moderators see "Only founders can send codes."

- **How many**: 1 to 500. The earliest on the waitlist go first. People already in (let in early, or signed up and active) are skipped.
- **Also send a new code to people whose code ran out**: off by default. When ticked, people whose code expired unused get a new code and a new email.
- Nobody gets the same email twice otherwise. A code made but not emailed (because a send failed) is reused next time.

The tiles above the form count people **ready for a code**, **code sent**, **code used** and **code ran out**. The audit log gets one `waitlist_codes_sent` row per batch of up to 100, with the count but no emails.

## When a send fails

The console says "Sent N of M, then the email service failed." Emails already sent are marked; the rest keep their codes. Fix the cause and send again with the same number:

- "Email isn't set up yet": `RESEND_API_KEY` or `EMAIL_FROM` is missing on that project. Set them (steps 4 and 5).
- Resend refused: check Resend → Logs. Common causes are an unverified domain, a key without access to `mail.pickld.me`, or the daily limit.

Each batch has a Resend idempotency key made from its codes, so retrying the same batch within 24 hours doesn't send it twice.

## By hand (if the console or Resend is down)

Use the console when you can: the functions check the founder flag on your own session, which the SQL editor doesn't have. To see who is next without changing anything, in the Supabase SQL editor:

```sql
select email, created_at from waitlist w
where admitted_at is null and invited_at is null
  and not exists (select 1 from profiles p where p.id = w.user_id and p.status <> 'waiting')
order by created_at, email limit 50;
```

Download the CSV from Console → Waitlist for the full list. Don't email codes from a personal mailbox; codes made outside `waitlist_release` aren't counted on the page.

## Check

```sql
select count(*) filter (where invited_at is not null) as sent,
       count(*) filter (where ic.uses > 0) as used
from waitlist w left join invite_codes ic on ic.code = w.invite_code;
```
