# Invite period runbook

INV-02 (#373), migrations 0130 and 0131. While the invite period runs, people can still sign up, but a new account waits (status `waiting`) until it redeems an invite code, the founders let it in, or the period ends. A waiting account can't add moments, comment, like or follow, and nobody can find it; it can still edit its profile and delete itself.

There is no invite period until a founder sets an end date. Don't set one until the app's Waiting screen (INV-06) is in the App Store build people use, or new sign-ups get stuck in onboarding.

## Start or move the period

In the Supabase SQL editor (production):

```sql
update app_settings set invite_period_ends_at = '<end date and time, with zone>', updated_at = now();
select invite_period_active();  -- true
```

## End it early

Set the date to now (or `null`). The next `fn:account-jobs` run (cron) lets everyone still waiting in, and each of them gets the "You're in. Fill your first jar." push.

```sql
update app_settings set invite_period_ends_at = now(), updated_at = now();
```

## Let some people in by hand

Founders do this from the console (INV-10), which calls `admit_waiting(n)`: the first `n` in line, first come, first served. A pickld.me waitlist sign-up counts from when it joined the waitlist. Founders are moderators whose auth `app_metadata` also has `"founder": true`; set that in the Supabase dashboard (Authentication, the user, raw app metadata).

## Check

```sql
select status, count(*) from profiles group by status;
select count(*) from notifications where type = 'admitted' and push_result is null;  -- pushes still to go out
```
