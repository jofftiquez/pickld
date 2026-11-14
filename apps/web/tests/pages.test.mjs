// The shared-link pages in a 390 px Chromium (M4-13; FR-WEB-01, FR-WEB-03, FR-PRV-04). A stub stands in
// for fn:public-page, whose own rules (what is public, what gets signed) are tested against the local stack
// in supabase/functions/tests/public_page_test.ts. Run after `next build` (see the test script).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { after, before, test } from 'node:test';

import { chromium } from 'playwright';

const here = path.dirname(new URL(import.meta.url).pathname);
const images = path.join(here, '../../../design/images');
const ANON = 'stub-anon-key-0123456789abcdef';
const EVERYONE = '11111111-1111-4111-8111-111111111111';
const READERS = '22222222-2222-4222-8222-222222222222';
const COVERED = '66666666-6666-4666-8666-666666666666';

let stub, stubUrl, web, base, browser;
const SITE = 'https://pickld.test';
const TEAM = 'ABCDE12345';
const SECRET = 'stub-waitlist-secret-0123456789abcdef';
/** What the waitlist stub received; `next` is its next answer's status. */
const waitlist = { calls: [], next: 200 };
const CERT = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');
/** Photo paths the stub served, to see what a preview fetched. */
const served = [];

const author = (url) => ({
  id: '33333333-3333-4333-8333-333333333333',
  username: 'dale',
  display_name: 'Dale',
  bio: 'coffee, commutes and cats',
  lid_color: '#7fad33',
  reader_count: 3,
  author_count: 1,
  created_at: '2026-09-01T00:00:00Z',
  avatar: `${url}/img/av_dale.jpg`,
  cover: null,
});
const moment = (url, n, slot, extra = {}) => ({
  id: `44444444-4444-4444-8444-44444444444${n}`,
  slot,
  caption: null,
  captured_at: null,
  added_at: `2026-11-08T0${n}:00:00Z`,
  is_backfilled: false,
  edits: {},
  full: `${url}/img/${slot}.jpg`,
  thumb: `${url}/img/${slot}.jpg`,
  ...extra,
});

function pages(url) {
  // Out of slot order on purpose: the page sorts them.
  const moments = [
    moment(url, 3, 'evening', { caption: 'Early night. Ordinary and good.' }),
    moment(url, 1, 'morning', { caption: 'older caption', edits: { v: 1, filter: 'mono', overlays: [] } }),
    moment(url, 2, 'whereami'),
  ];
  return {
    jars: {
      [EVERYONE]: {
        kind: 'jar',
        assetBase: url,
        id: EVERYONE,
        local_date: '2026-11-08',
        visibility: 'everyone',
        readers_only: false,
        published_at: '2026-11-08T14:00:00Z',
        visible_count: 3,
        author: author(url),
        moments,
      },
      // The owner picked the morning moment as the cover (0069, D-56).
      [COVERED]: {
        kind: 'jar',
        assetBase: url,
        id: COVERED,
        local_date: '2026-11-08',
        visibility: 'everyone',
        readers_only: false,
        published_at: '2026-11-08T14:00:00Z',
        visible_count: 3,
        author: author(url),
        moments,
        cover_moment_id: moments[1].id,
      },
      [READERS]: {
        kind: 'jar',
        assetBase: url,
        id: READERS,
        local_date: '2026-11-07',
        visibility: 'readers',
        readers_only: true,
        published_at: '2026-11-07T14:00:00Z',
        visible_count: 8,
        author: author(url),
      },
    },
    profiles: {
      dale: {
        kind: 'profile',
        assetBase: url,
        profile: author(url),
        jars: [
          { id: EVERYONE, local_date: '2026-11-08', published_at: '2026-11-08T14:00:00Z', visible_count: 3, moments },
        ],
      },
    },
  };
}

before(async () => {
  stub = createServer((req, res) => {
    if (req.url.startsWith('/img/')) {
      served.push(req.url);
      const file = path.join(images, path.basename(req.url));
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      return res.end(readFileSync(file));
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      assert.equal(req.headers.authorization, `Bearer ${ANON}`);
      if (req.url === '/functions/v1/waitlist-join') {
        waitlist.calls.push({
          body: JSON.parse(body),
          secret: req.headers['x-waitlist-secret'],
          ip: req.headers['x-client-ip'],
        });
        res.writeHead(waitlist.next, { 'content-type': 'application/json' });
        return res.end(
          JSON.stringify(waitlist.next === 200 ? { data: { joined: true } } : { error: { code: 'x', message: 'x' } }),
        );
      }
      const input = JSON.parse(body);
      const data = pages(stubUrl);
      const found = input.jarId ? data.jars[input.jarId] : data.profiles[String(input.username).toLowerCase()];
      res.writeHead(found ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(found ? { data: found } : { error: { code: 'not_found', message: 'none' } }));
    });
  });
  await new Promise((r) => stub.listen(0, '127.0.0.1', r));
  stubUrl = `http://127.0.0.1:${stub.address().port}`;

  const port = 3200 + Math.floor(Math.random() * 500);
  base = `http://127.0.0.1:${port}`;
  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
  web = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: path.join(here, '..'),
    env: {
      ...process.env,
      SUPABASE_URL: stubUrl,
      SUPABASE_ANON_KEY: ANON,
      WAITLIST_SECRET: SECRET,
      SITE_URL: SITE,
      APPLE_TEAM_ID: TEAM,
      ANDROID_CERT_SHA256: ` ${CERT.toLowerCase()} `,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  web?.kill();
  stub?.close();
});

async function open(route) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const res = await page.goto(base + route);
  await page.waitForLoadState('networkidle');
  return { page, status: res.status() };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= 390);

test('an Everyone jar shows its moments in slot order with the newest caption', async () => {
  const { page, status } = await open(`/j/${EVERYONE}`);
  assert.equal(status, 200);
  assert.equal(await page.locator('h1').textContent(), 'Dale shared a Sunday jar');
  const alts = await page.locator('section img').evaluateAll((els) => els.map((e) => e.getAttribute('alt')));
  assert.deepEqual(alts, ['Dale’s #whereami moment', 'Dale’s #morning moment', 'Dale’s #evening moment']);
  // Every photo actually loaded.
  assert.ok(await page.locator('section img').evaluateAll((els) => els.every((e) => e.naturalWidth > 0)));
  assert.ok(await page.getByText('pickld.me/dale · Nov 8, 2026 · 3 of 8 moments').isVisible());
  assert.ok(await page.getByText('“Early night. Ordinary and good.”').isVisible());
  assert.equal(await page.getByText('older caption').count(), 0);
  // The morning moment's Mono filter is drawn, not baked in.
  assert.match(await page.locator('img[alt="Dale’s #morning moment"]').getAttribute('style'), /filter-mono/);
  assert.equal(
    await page.getByRole('link', { name: 'Open in the app' }).getAttribute('href'),
    `pickld://jar/${EVERYONE}`,
  );
  assert.ok(await page.getByRole('link', { name: 'Google Play' }).isVisible());
  assert.ok(await noSideScroll(page));
  assert.ok(!(await page.content()).includes(ANON), 'the anon key stays on the server');
  await page.close();
});

test('a jar with a cover shows it first, then slot order, with the cover’s caption (D-56)', async () => {
  const { page, status } = await open(`/j/${COVERED}`);
  assert.equal(status, 200);
  const alts = await page.locator('section img').evaluateAll((els) => els.map((e) => e.getAttribute('alt')));
  assert.deepEqual(alts, ['Dale’s #morning moment', 'Dale’s #whereami moment', 'Dale’s #evening moment']);
  assert.ok(await page.getByText('“older caption”').isVisible());
  assert.equal(await page.getByText('Early night. Ordinary and good.').count(), 0);
  await page.close();
});

test('a Readers jar is a teaser with no photos', async () => {
  const { page, status } = await open(`/j/${READERS}`);
  assert.equal(status, 200);
  assert.ok(await page.getByTestId('readers-teaser').isVisible());
  assert.ok(await page.getByText('Only Dale’s readers can see this jar').isVisible());
  assert.equal(await page.locator('section img').count(), 0);
  assert.ok(await noSideScroll(page));
  await page.close();
});

test('a profile lists its public jars, linking to each jar page', async () => {
  const { page, status } = await open('/dale');
  assert.equal(status, 200);
  assert.equal(await page.locator('h1').textContent(), 'Dale');
  const jar = page.getByRole('link', { name: 'Nov 8, 2026, 3 of 8 moments' });
  assert.equal(await jar.getAttribute('href'), `/j/${EVERYONE}`);
  assert.ok(await noSideScroll(page));
  await page.close();
});

test('/u/<username> redirects to the canonical profile link', async () => {
  const res = await fetch(`${base}/u/dale`, { redirect: 'manual' });
  assert.equal(res.status, 308);
  assert.equal(new URL(res.headers.get('location'), base).pathname, '/dale');
});

test('anything not public is a 404', async () => {
  for (const route of ['/j/55555555-5555-4555-8555-555555555555', '/j/not-a-uuid', '/nobody_here', '/a']) {
    const { page, status } = await open(route);
    assert.equal(status, 404, route);
    assert.ok(await page.getByText('Nothing to see here').isVisible(), route);
    await page.close();
  }
});

test('legal pages are reachable from the footer', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  for (const [name, route] of [
    ['Terms', '/terms'],
    ['Privacy Policy', '/privacy'],
    ['Community Guidelines', '/guidelines'],
  ]) {
    await page.getByRole('link', { name }).click();
    await page.waitForURL(base + route);
    assert.equal(await page.locator('h1').textContent(), name);
    await page.goBack();
  }
  await page.close();
});

// ---------------------------------------------------------------- marketing pages and the waitlist

test('the home page shows the pitch, the eight moments and loaded screenshots without side scroll', async () => {
  const { page, status } = await open('/');
  assert.equal(status, 200);
  assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), 'Eight moments. One real day.');
  const moments = await page.getByRole('list', { name: 'The eight moments' }).locator('b').allTextContents();
  assert.deepEqual(moments, [
    '#whereami',
    '#mebusywith',
    '#whoamiwith',
    '#ootd',
    '#selfie',
    '#morning',
    '#afternoon',
    '#evening',
  ]);
  const imgs = page.locator('main img');
  assert.ok((await imgs.count()) >= 15);
  // Lazy images load as they scroll in; the floating stickers animate, so scroll with the DOM, not Playwright.
  for (const img of await imgs.all()) {
    const ok = await img.evaluate(async (e) => {
      e.scrollIntoView({ block: 'center' });
      await e.decode().catch(() => {});
      return e.complete && e.naturalWidth > 0;
    });
    assert.ok(ok, await img.getAttribute('src'));
  }
  // Decorative stickers are hidden from screen readers; every other image says what it shows.
  assert.ok(await imgs.evaluateAll((els) => els.every((e) => e.hasAttribute('alt'))));
  assert.equal(await page.getByRole('link', { name: 'Google Play' }).count(), 0, 'iPhone first');
  assert.ok(await noSideScroll(page));
  await page.close();
});

test('the waitlist form posts the address with the secret and visitor IP, then thanks them', async () => {
  waitlist.calls.length = 0;
  waitlist.next = 200;
  const { page } = await open('/');
  await page.getByLabel('Email address').first().fill('  Mika@Example.com ');
  await page.getByRole('button', { name: 'Join the waitlist' }).first().click();
  await page.waitForURL(`${base}/waitlist?status=joined`);
  assert.equal(await page.locator('h1').textContent(), 'You’re on the list');
  assert.equal(waitlist.calls.length, 1);
  assert.deepEqual(waitlist.calls[0].body, { email: 'Mika@Example.com', source: 'hero' });
  assert.equal(waitlist.calls[0].secret, SECRET);
  assert.ok(waitlist.calls[0].ip);
  assert.ok(!(await page.content()).includes(SECRET), 'the secret stays on the server');
  await page.close();
});

test('the waitlist works without JavaScript and says when there were too many sign-ups', async () => {
  waitlist.calls.length = 0;
  waitlist.next = 429;
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/waitlist`);
  await page.getByLabel('Email address').fill('dale@example.com');
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await page.waitForURL(`${base}/waitlist?status=limited`);
  assert.equal(await page.locator('h1').textContent(), 'Too many sign-ups from here');
  assert.equal(waitlist.calls[0].body.source, 'waitlist');
  waitlist.next = 200;
  await context.close();
});

test('/stickers lists every pack, Olivia first, with its kind', async () => {
  const { page, status } = await open('/stickers');
  assert.equal(status, 200);
  const names = await page.locator('main h2[id^="pack-"]').allTextContents();
  assert.equal(names[0], 'Olivia');
  assert.equal(names.length, 17);
  assert.ok(names.includes('Everyday') && names.includes('Pinoy Life'));
  const olivia = page.getByRole('list', { name: 'Olivia stickers' }).locator('img');
  assert.equal(await olivia.count(), 16);
  assert.equal(await olivia.first().getAttribute('alt'), 'Queen');
  assert.ok(await page.getByRole('heading', { name: 'Everyday' }).locator('..').getByText('Free').isVisible());
  assert.ok(await noSideScroll(page));
  await page.close();
});

// ---------------------------------------------------------------- link previews (M4-14, FR-WEB-02)

async function meta(route) {
  const html = await (await fetch(base + route)).text();
  const tags = {};
  for (const m of html.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)"/g))
    tags[m[1]] ??= m[2];
  return tags;
}

/** PNG width and height from the IHDR chunk. */
const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

async function preview(tags) {
  const url = new URL(tags['og:image']);
  assert.equal(url.origin, SITE, 'absolute URL on the public origin');
  const res = await fetch(base + url.pathname + url.search);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  const png = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(pngSize(png), { width: 1200, height: 630 });
  return png;
}

test('jar links carry the tags Messenger, Facebook, X and iMessage read', async () => {
  const tags = await meta(`/j/${EVERYONE}`);
  assert.equal(tags['og:title'], 'Dale’s Sunday on Pickld');
  assert.equal(tags['og:description'], '3 of 8 moments from Dale’s Sunday.');
  assert.equal(tags['og:url'], `${SITE}/j/${EVERYONE}`);
  assert.equal(tags['og:type'], 'article');
  assert.equal(tags['og:site_name'], 'Pickld');
  assert.equal(tags['og:image:width'], '1200');
  assert.equal(tags['og:image:height'], '630');
  assert.equal(tags['twitter:card'], 'summary_large_image');
  assert.equal(tags['twitter:image'], tags['og:image']);
  await preview(tags);
  const profile = await meta('/dale');
  assert.equal(profile['og:url'], `${SITE}/dale`);
  assert.equal(profile['twitter:card'], 'summary_large_image');
  await preview(profile);
});

test('a Readers jar preview fetches no moment photos', async () => {
  const tags = await meta(`/j/${READERS}`);
  assert.equal(tags['og:description'], 'A jar for Dale’s readers.');
  served.length = 0;
  await preview(tags);
  assert.deepEqual(served, ['/img/av_dale.jpg']);
});

test('the jar preview matches its snapshot', async () => {
  const png = await preview(await meta(`/j/${EVERYONE}`));
  const ref = path.join(here, 'snapshots/og-jar.png');
  if (process.env.UPDATE_SNAPSHOTS || !existsSync(ref)) writeFileSync(ref, png);
  const page = await browser.newPage();
  // Share of pixels whose channels differ by more than 32 of 255 (font hinting stays well under that).
  const diff = await page.evaluate(
    async ([a, b]) => {
      const load = async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height).data;
      };
      const [x, y] = await Promise.all([load(a), load(b)]);
      let off = 0;
      for (let i = 0; i < x.length; i += 4) {
        if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > 32) off++;
      }
      return off / (x.length / 4);
    },
    [
      `data:image/png;base64,${png.toString('base64')}`,
      `data:image/png;base64,${readFileSync(ref).toString('base64')}`,
    ],
  );
  await page.close();
  assert.ok(diff < 0.001, `${(diff * 100).toFixed(2)}% of pixels differ from tests/snapshots/og-jar.png`);
});

// ---------------------------------------------------------------- universal links / app links (M4-15)

test('the AASA file lets the app open profile, jar and sign-in links but not legal or marketing pages', async () => {
  const res = await fetch(`${base}/.well-known/apple-app-site-association`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const [detail] = (await res.json()).applinks.details;
  assert.deepEqual(detail.appIDs, [`${TEAM}.me.pickld.app`]);
  const excluded = detail.components.filter((c) => c.exclude).map((c) => c['/']);
  assert.deepEqual(excluded, ['/terms', '/privacy', '/guidelines', '/', '/stickers', '/waitlist', '/.well-known/*']);
  // iOS takes the first matching component, so the exclusions must come before the catch-all.
  const all = detail.components.map((c) => c['/']);
  assert.ok(all.indexOf('/terms') < all.indexOf('/*'));
});

test('assetlinks.json names the app and its normalised signing certificate', async () => {
  const res = await fetch(`${base}/.well-known/assetlinks.json`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  const [link] = await res.json();
  assert.deepEqual(link.relation, ['delegate_permission/common.handle_all_urls']);
  assert.deepEqual(link.target, {
    namespace: 'android_app',
    package_name: 'me.pickld.app',
    sha256_cert_fingerprints: [CERT],
  });
});
