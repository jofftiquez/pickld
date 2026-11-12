# M5-03 · Load test (NFR-PERF-02, NFR-REL-01)

## What is tested

`scripts/load/feed.js` (k6) does what the app does when a reader opens the Jars tab:
- `feed_page` (first page)
- `fn:photo-urls` for that page's thumbnails, where the visibility check runs in Postgres as the caller
- `feed_authors`
- the second page and its thumbnails

Each virtual reader then waits 2–4 s and opens the feed again. The target and pass rule are D-38: 50 readers held for 2 minutes, with p95 under 300 ms for `feed_page` and `fn:photo-urls` and under 1% failed requests.

## Local results (2026-11-12)

The test ran against the local Supabase stack on one orb (8 vCPU, 15 GB). Postgres, the Edge runtime, the photo worker and k6 all shared that machine. The feed had 63 jars from 4 readers (`scripts/perf/feed-seed.sql` loaded). k6 ran from the `grafana/k6` Docker image via `scripts/load/run.sh`.

| Run | Requests | Failed | `feed_page` p95 | `photo-urls` p95 | Whole feed open p95 | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Target: 50 readers, 2 min | 9,859 (64/s) | 0 | **57 ms** | **32 ms** | 148 ms | ✅ pass |
| Stress: 200 readers, 1 min | 18,871 (203/s) | 6 (0.03%) | 463 ms | 878 ms | 1.56 s | ✗ over 300 ms |

At 4× the target, the single local machine saturates. The six failures were dropped connections at the local gateway. This shows where the local stack runs out, not how staging behaves, because staging runs Postgres and the Edge runtime on separate managed hardware.

## Still needed (staging, founders)

- **The staging run:** run `feed.js` with `API_URL`, `ANON_KEY` and `TOKENS` set to staging and to tokens of seeded staging readers. Load a feed of a similar size first. #116 stays open until that passes.
- **Moderation throughput** can't be measured meaningfully yet: `fn:moderate` auto-approves (D-22). Load-test it when the real check returns, before public launch.
