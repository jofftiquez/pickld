# Alerts runbook

NFR-REL-01, M4-20 (#110), decision D-34. Every alert uses the Sentry and PostHog accounts Pickld already has; there is no other vendor. Set these up in staging first, run the drill, then repeat in production.

## What to set up

| Alert                               | Where                     | Target                                                                                                 | Rule                                                    |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| API down                            | Sentry Uptime Monitoring  | `GET https://<project>.supabase.co/functions/v1/health` with header `Authorization: Bearer <anon key>` | every 1 minute, alert after 2 failures                  |
| Site down                           | Sentry Uptime Monitoring  | `https://pickld.me`                                                                                    | every 1 minute, alert after 2 failures                  |
| Moderation queue older than 2 hours | Sentry Uptime Monitoring  | `GET https://<project>.supabase.co/functions/v1/health/queue` with the same header                     | every 5 minutes, alert after 1 failure                  |
| Upload failures above 2%            | PostHog insight and alert | `upload_result` events: failed / (uploaded + failed), last hour                                        | alert above 2% when there are at least about 50 results |
| New server errors                   | Sentry alert rule         | production environment, new issues                                                                     | notify the founders                                     |

The anon key is public by design (it is in the app), so it is fine in a monitor's header. Never put the service role key in a monitor.

`/health/queue` answers 200 or 503 and nothing else: no count, age or item details. Pending and escalated items count; kept and removed ones don't. The 2-hour limit is `QUEUE_MAX_AGE_MS` in `supabase/functions/health/handler.ts`.

## When the queue alert fires

1. Open the moderation console (mod.pickld.me). The queue is oldest first; the header shows the median wait.
2. Decide the oldest items. Escalated items can be decided by any moderator.
3. The monitor recovers on its next check once no open item is older than 2 hours.
4. If it fires often, add moderators or review the Auto-check thresholds (supabase/functions/moderate/thresholds.ts) with the replay test.

## Staging drill (acceptance for #110)

1. Queue age: in staging SQL, insert an old open item, wait for the alert, then delete it and watch the monitor recover:
   `insert into moderation_items (source, status, created_at) values ('report', 'pending', now() - interval '3 hours') returning id;`
   then `delete from moderation_items where id = '<id>';`
2. API down: pause the monitor's target by pointing a copy of the monitor at `/functions/v1/health-missing` and confirm it alerts.
3. Upload failures: temporarily lower the PostHog alert floor and threshold, send a few failed uploads from a TestFlight build in airplane mode until the retries give up, confirm the alert, then restore the values.
4. Server errors: trigger a test error from the Sentry project settings and confirm the notification.
