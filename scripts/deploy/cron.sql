-- Scheduled jobs for a hosted environment (staging, production). Not a migration: local development runs these
-- by hand. scripts/deploy/bootstrap.sh stores the URL, the anon key and the two job secrets in Vault first, so this
-- file holds no secret and re-running it updates the jobs in place (cron.schedule replaces a job of the same name).
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- fn:send-push every minute (M3-15): social push notifications.
select cron.schedule('send-push', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$job$);

-- fn:account-jobs every 2 minutes: data exports (D-45 draws a few copies per run), account deletions and purges,
-- and lifting expired suspensions (D-43).
select cron.schedule('account-jobs', '*/2 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/account-jobs',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-jobs-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'account_jobs_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000)
$job$);
