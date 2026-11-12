// k6 load test for the Jars feed (M5-03, NFR-PERF-02). Each iteration is what the app does when a reader
// opens the Jars tab: feed_page (first page), fn:photo-urls for that page's thumbnails (the visibility
// check runs in Postgres as the caller), feed_authors, then the second page and its thumbnails.
//
//   scripts/load/run.sh                   local stack, tokens minted from `supabase status`
//   API_URL=… ANON_KEY=… TOKENS=a,b k6 run scripts/load/feed.js   staging (tokens of test readers)
//
// Target (D-38): 50 readers opening the feed at once, each every ~3 s, held for 2 minutes; feed p95 < 300 ms.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const API = __ENV.API_URL;
const ANON = __ENV.ANON_KEY;
const TOKENS = (__ENV.TOKENS || '').split(',').filter(Boolean);
const VUS = Number(__ENV.VUS || 50);
const HOLD = __ENV.HOLD || '2m';

const feedPage = new Trend('feed_page_ms', true);
const photoUrls = new Trend('photo_urls_ms', true);
const feedOpen = new Trend('feed_open_ms', true);

export const options = {
  scenarios: {
    readers: {
      executor: 'ramping-vus',
      stages: [
        { duration: '20s', target: VUS },
        { duration: HOLD, target: VUS },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    feed_page_ms: ['p(95)<300'],
    photo_urls_ms: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

function headers(token) {
  return { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function page(token, cursor) {
  const res = http.post(`${API}/rest/v1/rpc/feed_page`, JSON.stringify(cursor ?? {}), {
    headers: headers(token),
    tags: { name: 'feed_page' },
  });
  feedPage.add(res.timings.duration);
  check(res, { 'feed_page 200': (r) => r.status === 200 });
  const rows = res.status === 200 ? res.json() : [];
  const ids = rows.flatMap((r) => r.preview_moment_ids);
  if (ids.length > 0) {
    const urls = http.post(`${API}/functions/v1/photo-urls`, JSON.stringify({ momentIds: ids.slice(0, 100) }), {
      headers: headers(token),
      tags: { name: 'photo_urls' },
    });
    photoUrls.add(urls.timings.duration);
    check(urls, { 'photo-urls 200': (r) => r.status === 200 });
  }
  const last = rows[rows.length - 1];
  return last ? { cursor_at: last.feed_at, cursor_id: last.jar_id } : null;
}

export default function () {
  const token = TOKENS[(__VU - 1) % TOKENS.length];
  const started = Date.now();
  const next = page(token, null);
  const authors = http.post(`${API}/rest/v1/rpc/feed_authors`, '{}', {
    headers: headers(token),
    tags: { name: 'feed_authors' },
  });
  check(authors, { 'feed_authors 200': (r) => r.status === 200 });
  feedOpen.add(Date.now() - started);
  if (next) page(token, next);
  sleep(2 + Math.random() * 2);
}
