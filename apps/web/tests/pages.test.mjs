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

let stub, stubUrl, web, webEnv, base, browser;
const SITE = 'https://pickld.test';
const TEAM = 'ABCDE12345';
const TURNSTILE_SECRET = 'stub-turnstile-secret-0123456789';
const USER_TOKEN = 'stub-user-access-token';
const CODE = '123456';
/**
 * What the Supabase Auth, waitlist_join and Turnstile stubs received (INV-12). `otpStatus` is the next
 * /auth/v1/otp answer's status and `answer` what waitlist_join returns.
 */
const waitlist = { captcha: [], otp: [], verify: [], rpc: [], logout: 0, otpStatus: 200, answer: 'joined' };
const resetWaitlist = () =>
  Object.assign(waitlist, { captcha: [], otp: [], verify: [], rpc: [], logout: 0, otpStatus: 200, answer: 'joined' });
// Stands in for Cloudflare's script in the browser: the widget adds the token field the server checks.
const FAKE_TURNSTILE = `window.turnstile = { render(el) { const i = document.createElement('input');
  i.type = 'hidden'; i.name = 'cf-turnstile-response'; i.value = 'stub-token'; el.appendChild(i); return 'w1'; },
  remove() {} };`;
const CERT = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');
const FORWARD_SECRET = 'stub-forward-secret-0123456789abcdef';
/** What fn:invite answers per token (INV-05); anything else is unavailable. */
const dale = (url) => ({ username: 'dale', display_name: 'Dale', avatar: `${url}/img/av_dale.jpg` });
const INVITES = {
  K7M2QX: (url) => ({ kind: 'personal', inviter: dale(url) }),
  LINKAB1234: (url) => ({ kind: 'personal', inviter: dale(url) }),
  WAIT01: () => ({ kind: 'waitlist', inviter: null }),
  BUSY99: 'limited',
};
/** The checks fn:invite received. */
const invites = [];
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

/** A text overlay on the evening moment, drawn over its photo. */
const CAPTIONED = {
  v: 1,
  filter: 'original',
  overlays: [
    {
      id: 't1',
      type: 'text',
      text: 'Antok pa ko',
      font: 'serif',
      color: 'white',
      size: 40,
      align: 'center',
      x: 0.5,
      y: 0.6,
      scale: 0.7,
      rotation: 0,
    },
    // Saved before the tail could flip: no side, so its tail hangs on the left.
    { id: 'b1', type: 'bubble', text: 'Busog na', x: 0.35, y: 0.2, scale: 0.5, rotation: 0 },
    { id: 'b2', type: 'bubble', text: 'Tara na', tail: 'right', x: 0.6, y: 0.4, scale: 0.5, rotation: 0 },
    { id: 'b3', type: 'bubble', shape: 'thought', cloud: true, text: 'Hmm', x: 0.5, y: 0.8, scale: 0.5, rotation: 0 },
  ],
};

/** Texts in the newer styles: a pinched-up font on a solid background over two lines, and an outline. */
const STYLED = {
  v: 1,
  filter: 'original',
  overlays: [
    {
      id: 'solid',
      type: 'text',
      text: 'GAME DAY\nlet’s go',
      font: 'strong',
      color: 'yellow',
      background: 'solid',
      size: 30,
      align: 'center',
      x: 0.5,
      y: 0.3,
      scale: 0.6,
      rotation: 0,
    },
    {
      id: 'outlined',
      type: 'text',
      text: 'tara',
      font: 'marker',
      color: 'white',
      outline: 'ink',
      size: 30,
      align: 'left',
      x: 0.5,
      y: 0.7,
      scale: 0.5,
      rotation: 0,
    },
    // A place sticker: only its words and color are stored.
    { id: 'place', type: 'place', text: 'Baguio', color: 'butter', x: 0.5, y: 0.88, scale: 0.4, rotation: 0 },
    // A mention sticker (0172): the person's id and username.
    {
      id: 'mention',
      type: 'mention',
      userId: '6f0c1c39-3d4c-4f8e-9a2b-1c2d3e4f5a6b',
      username: 'mara.lim',
      color: 'sky',
      x: 0.3,
      y: 0.3,
      scale: 0.4,
      rotation: 0,
    },
  ],
};

function pages(url) {
  // Out of slot order on purpose: the page sorts them.
  const moments = [
    moment(url, 3, 'evening', { caption: 'Early night. Ordinary and good.', edits: CAPTIONED }),
    moment(url, 1, 'morning', { caption: 'older caption', edits: { v: 1, filter: 'mono', overlays: [] } }),
    moment(url, 2, 'whereami', { edits: STYLED }),
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
      const json = (status, value) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (req.url === '/turnstile') {
        const form = Object.fromEntries(new URLSearchParams(body));
        waitlist.captcha.push(form);
        return json(200, { success: form.secret === TURNSTILE_SECRET && form.response === 'stub-token' });
      }
      if (req.url === '/store') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<title>App Store</title>');
      }
      assert.equal(req.headers.apikey, ANON);
      if (req.url === '/rest/v1/rpc/waitlist_join' || req.url.startsWith('/auth/v1/logout')) {
        assert.equal(req.headers.authorization, `Bearer ${USER_TOKEN}`, 'as the new account');
        if (req.url.startsWith('/auth/v1/logout')) {
          waitlist.logout += 1;
          res.writeHead(204);
          return res.end();
        }
        waitlist.rpc.push(JSON.parse(body));
        return json(200, waitlist.answer);
      }
      assert.equal(req.headers.authorization, `Bearer ${ANON}`);
      if (req.url === '/auth/v1/otp') {
        waitlist.otp.push(JSON.parse(body));
        return json(waitlist.otpStatus, {});
      }
      if (req.url === '/auth/v1/verify') {
        const input = JSON.parse(body);
        waitlist.verify.push(input);
        return input.token === CODE
          ? json(200, { access_token: USER_TOKEN, refresh_token: 'r', user: { id: 'u' } })
          : json(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (req.url === '/functions/v1/invite') {
        const { token } = JSON.parse(body);
        invites.push({ token, ip: req.headers['x-client-ip'], secret: req.headers['x-waitlist-secret'] });
        const found = INVITES[token];
        if (found === 'limited') return json(429, { error: { code: 'rate_limited', message: 'Too many' } });
        return found
          ? json(200, { data: found(stubUrl) })
          : json(404, { error: { code: 'unavailable', message: 'This invite can’t be used.' } });
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
  webEnv = {
    ...process.env,
    SUPABASE_URL: stubUrl,
    SUPABASE_ANON_KEY: ANON,
    TURNSTILE_SECRET_KEY: TURNSTILE_SECRET,
    TURNSTILE_VERIFY_URL: `${stubUrl}/turnstile`,
    SITE_URL: SITE,
    APP_STORE_URL: `${stubUrl}/store`,
    WAITLIST_SECRET: FORWARD_SECRET,
    APPLE_TEAM_ID: TEAM,
    ANDROID_CERT_SHA256: ` ${CERT.toLowerCase()} `,
    WAITLIST_OPEN: 'true', // the build is open too (see the test script)
  };
  web = await startWeb(port, webEnv);
  browser = await chromium.launch();
});

/** `next start` on the build in .next with these settings, once it answers. */
async function startWeb(port, env) {
  const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: path.join(here, '..'),
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return child;
}

after(async () => {
  await browser?.close();
  web?.kill();
  stub?.close();
});

async function open(route) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('https://challenges.cloudflare.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: FAKE_TURNSTILE }),
  );
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

test('stickers and text sit on a photo only once it has loaded, never on the empty box', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let release;
  const held = new Promise((r) => (release = r));
  await page.route('**/img/evening.jpg', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`${base}/j/${EVERYONE}`, { waitUntil: 'domcontentloaded' });
  const overlays = page.locator('[data-overlays]').filter({ hasText: 'Antok pa ko' });
  // Long enough for the page to come alive; the photo is still on its way.
  await page.waitForTimeout(1000);
  assert.equal(await overlays.evaluate((el) => getComputedStyle(el).opacity), '0');
  release();
  await page.waitForFunction(
    () => [...document.querySelectorAll('[data-overlays]')].every((el) => getComputedStyle(el).opacity === '1'),
    null,
    { timeout: 10_000 },
  );
  assert.ok(await page.getByText('Antok pa ko').isVisible());
  await page.close();
});

test('a bubble’s tail hangs below it on its saved side; one saved without a side hangs on the left', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  const tail = async (text) => {
    const bubble = page.locator('span', { hasText: text }).filter({ has: page.locator('svg[data-bubble-tail]') });
    await bubble.waitFor();
    const svg = bubble.locator('svg[data-bubble-tail]');
    const side = await svg.getAttribute('data-bubble-tail');
    const b = await bubble.boundingBox();
    const t = await svg.locator('path').boundingBox();
    return { side, b, t, fill: await svg.locator('path').getAttribute('fill') };
  };
  const old = await tail('Busog na');
  assert.equal(old.side, 'left');
  assert.equal(old.fill, '#ffffff'); // the bubble's own fill (white)
  assert.ok(old.t.x + old.t.width < old.b.x + old.b.width / 2, 'the point sits in the left half');
  const flipped = await tail('Tara na');
  assert.equal(flipped.side, 'right');
  assert.ok(flipped.t.x > flipped.b.x + flipped.b.width / 2, 'the point sits in the right half');
  for (const { b, t } of [old, flipped]) {
    // Its base tucks just inside the bubble's bottom edge; it hangs 16 of the bubble's 200 units below it.
    assert.ok(t.y < b.y + b.height && t.y > b.y + b.height - 2, `base at ${t.y}, bubble ends at ${b.y + b.height}`);
    assert.ok(Math.abs(t.y + t.height - (b.y + b.height + (16 / 200) * b.width)) < 1, 'the tip');
  }
  await page.close();
});

test('a cloud thought draws its puffs in its fill behind the text, with its dots below it', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  const bubble = page.locator('span', { hasText: 'Hmm' }).filter({ has: page.locator('svg[data-bubble-cloud]') });
  await bubble.waitFor();
  const b = await bubble.boundingBox();
  const cloud = await bubble.locator('svg[data-bubble-cloud]').boundingBox();
  assert.deepEqual([cloud.width, cloud.height].map(Math.round), [b.width, b.height].map(Math.round));
  // One line of text: 42 of the bubble's 200 units tall, as in the app.
  assert.ok(Math.abs(b.height - (42 / 200) * b.width) < 1, `${b.height} tall at ${b.width} wide`);
  assert.ok((await bubble.locator('svg[data-bubble-cloud] circle').count()) >= 8, 'puffs round the edge');
  assert.equal(await bubble.locator('svg[data-bubble-tail] circle').count(), 2);
  assert.equal(await bubble.locator('svg[data-bubble-tail]').getAttribute('data-bubble-tail'), 'left');
  await page.close();
});

test('text draws as the app lays it out: its lines, its font, sized with its box, on its background or outline', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  const read = (id) =>
    page.locator(`[data-text-overlay="${id}"]`).evaluate(async (el) => {
      const s = getComputedStyle(el);
      const photo = el.closest('[data-overlays]').getBoundingClientRect().width;
      return {
        text: el.textContent,
        width: el.getBoundingClientRect().width / photo,
        fontSize: parseFloat(s.fontSize) / photo,
        family: s.fontFamily,
        background: s.backgroundColor,
        color: s.color,
        shadows: s.textShadow === 'none' ? 0 : s.textShadow.split(/,(?![^(]*\))/).length,
        whiteSpace: s.whiteSpace,
        // The bundled face, first in the family, fetched for these words. Only that one: the fallback
        // after it is a local() font that a machine without it fails to load.
        loaded: (await document.fonts.load(`30px ${s.fontFamily.split(',')[0]}`, el.textContent)).some(
          (f) => f.status === 'loaded' && !f.family.includes('Fallback'),
        ),
      };
    });
  await page.locator('[data-text-overlay="solid"]').waitFor();
  const solid = await read('solid');
  assert.equal(solid.text, 'GAME DAY\nlet’s go');
  assert.equal(solid.whiteSpace, 'pre');
  // Anton letters are 0.5 em on average, a space 0.3: each line is 7 × 0.5 + 0.3 = 3.8 em, plus 0.4 em
  // padding each side on a background: a 4.6 em (138-point) box, 0.6 of the photo, so 30 points is
  // 0.6 × 30 / 138 of it.
  assert.ok(Math.abs(solid.width - 0.6) < 0.005, `${solid.width} of the photo wide`);
  assert.ok(Math.abs(solid.fontSize - (0.6 * 30) / 138) < 0.0005, `font size ${solid.fontSize}`);
  assert.equal(solid.background, 'rgb(253, 203, 92)'); // yellow fills the box
  assert.equal(solid.color, 'rgb(17, 20, 13)'); // in black, which reads on yellow
  assert.equal(solid.shadows, 0);
  assert.ok(solid.loaded, `${solid.family} is loaded`);

  const outlined = await read('outlined');
  assert.equal(outlined.background, 'rgba(0, 0, 0, 0)');
  assert.equal(outlined.color, 'rgb(255, 255, 255)');
  assert.equal(outlined.shadows, 16, 'sixteen copies of the words round them');
  assert.ok(outlined.loaded, `${outlined.family} is loaded`);
  await page.close();
});

test('a mention sticker draws as the app does, as plain text that links nowhere', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  const pill = page.locator('[data-mention-overlay="mention"]');
  await pill.waitFor();
  const got = await pill.evaluate((el) => {
    const photo = el.closest('[data-overlays]').getBoundingClientRect().width;
    const box = el.getBoundingClientRect();
    return {
      text: el.textContent,
      aspect: box.height / box.width,
      background: getComputedStyle(el).backgroundColor,
      link: el.closest('a') !== null || el.querySelector('a') !== null,
      width: box.width / photo,
    };
  });
  // '@mara.lim': 2 × 14 padding + 9 × 17 × 0.62 letters = 123 reference points wide, 40 tall.
  assert.equal(got.text, '@mara.lim');
  assert.ok(Math.abs(got.width - 0.4) < 0.005, `${got.width} of the photo wide`);
  assert.ok(Math.abs(got.aspect - 40 / 123) < 0.01, `aspect ${got.aspect}`);
  assert.equal(got.background, 'rgb(219, 232, 243)');
  assert.equal(got.link, false);
  await page.close();
});

test('a place sticker draws as the app does: a pill in its color, the pin and the name, sized with its box', async () => {
  const { page } = await open(`/j/${EVERYONE}`);
  const pill = page.locator('[data-place-overlay="place"]');
  await pill.waitFor();
  const got = await pill.evaluate((el) => {
    const photo = el.closest('[data-overlays]').getBoundingClientRect().width;
    const box = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      text: el.textContent,
      width: box.width / photo,
      aspect: box.height / box.width,
      fontSize: parseFloat(s.fontSize) / photo,
      background: s.backgroundColor,
      color: s.color,
      pin: el.querySelectorAll('svg path').length,
      fits: el.scrollWidth <= el.clientWidth + 1,
    };
  });
  // 'Baguio': 2 × 14 padding + 18 pin + 6 gap + 6 × 17 × 0.62 letters = 116 reference points wide, 40 tall.
  assert.equal(got.text, 'Baguio');
  assert.ok(Math.abs(got.width - 0.4) < 0.005, `${got.width} of the photo wide`);
  assert.ok(Math.abs(got.aspect - 40 / 116) < 0.01, `aspect ${got.aspect}`);
  assert.ok(Math.abs(got.fontSize - (0.4 * 17) / 116) < 0.0005, `font size ${got.fontSize}`);
  assert.equal(got.background, 'rgb(255, 224, 138)');
  assert.equal(got.color, 'rgb(17, 20, 13)');
  assert.equal(got.pin, 1);
  assert.ok(got.fits, 'the name fits on its one line');
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
  // Each row fans three example photos, with the moment's #tag on the front one.
  const rows = page.getByRole('list', { name: 'The eight moments' }).getByRole('listitem');
  assert.equal(await rows.nth(2).locator('.mk-fan img').count(), 3);
  assert.equal(await rows.nth(2).locator('.mk-fan span').innerText(), '#whoamiwith');
  assert.equal(
    await page.getByRole('link', { name: 'Ideas for all eight moments →' }).getAttribute('href'),
    '/moments',
  );
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

test('New in Pickld shows two featured screenshots and a handful of features, linked from the footer', async () => {
  const { page } = await open('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'New in Pickld' }).click();
  await page.waitForURL(`${base}/features`);
  assert.match(await page.locator('h1').innerText(), /Made for your people\./);
  assert.deepEqual(await page.locator('.mk-panel h3').allTextContents(), ['Close friends', 'Calm controls']);
  assert.equal(await page.locator('.mk-card').count(), 6);
  for (const img of await page.locator('.mk-phone img').all()) {
    await img.scrollIntoViewIfNeeded();
    assert.ok(await img.evaluate((i) => i.complete && i.naturalWidth > 0), await img.getAttribute('alt'));
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no side scroll');
  await page.close();
});

test('on a phone the header’s Menu reaches every marketing page and closes after a pick', async () => {
  const { page } = await open('/');
  const header = page.getByRole('banner');
  const visible = await header.locator('a:visible').allTextContents();
  assert.ok(!visible.includes('Why Pickld') && !visible.includes('Stickers'), 'page links wait behind Menu');
  await header.getByText('Menu').click();
  const items = header.locator('.mk-menu').getByRole('link');
  assert.deepEqual(await items.allTextContents(), [
    'The eight moments',
    'New in Pickld',
    'Why Pickld',
    'Our mission',
    'Stickers',
    'Our story',
    'FAQ',
  ]);
  await items.filter({ hasText: 'Our mission' }).click();
  await page.waitForURL(`${base}/mission`);
  assert.equal(await header.locator('.mk-menu').evaluate((d) => d.open), false);
  await page.close();
});

test('the moments page gives each moment its own fanned row with the app’s question and eight ideas', async () => {
  const { page, status } = await open('/moments');
  assert.equal(status, 200);
  const slots = await page.getByRole('list', { name: 'The eight moments' }).locator('b').allTextContents();
  assert.equal(slots.length, 8);
  for (const slot of slots) {
    const section = page.getByRole('region', { name: slot, exact: true });
    assert.equal(await section.getByRole('listitem').count(), 8, slot);
    assert.equal(await section.locator('.mk-fan img').count(), 3, slot);
  }
  const who = page.getByRole('region', { name: '#whoamiwith', exact: true });
  assert.ok(await who.getByText('Pickld asks: “Who are you with?”').isVisible());
  assert.ok(await who.getByText('Your dog, waiting by the door').isVisible());
  assert.ok(await noSideScroll(page));
  await page.close();
});

test('joining the waitlist checks the captcha, emails a code, then joins as the new account and signs out', async () => {
  resetWaitlist();
  const { page } = await open('/');
  await page.locator('input[name="cf-turnstile-response"]').first().waitFor({ state: 'attached' });
  await page.getByLabel('Email address').first().fill('  Mika@Example.com ');
  await page.getByRole('button', { name: 'Join the waitlist' }).first().click();
  await page.waitForURL(`${base}/waitlist/code`);
  assert.equal(waitlist.captcha[0].response, 'stub-token');
  assert.deepEqual(waitlist.otp, [{ email: 'Mika@Example.com', create_user: true }]);
  assert.match(await page.locator('main').innerText(), /Mika@Example\.com/);
  assert.ok(!page.url().includes('Mika'), 'the address never goes in a URL');

  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await page.waitForURL(`${base}/waitlist/code?error=badcode`);
  assert.equal(
    await page.locator('#waitlist-code-error').textContent(),
    'That code didn’t work. Check the latest email and try again.',
  );
  assert.equal(waitlist.rpc.length, 0);

  await page.getByLabel('6-digit code').fill(CODE);
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await page.waitForURL(`${base}/waitlist?status=joined`);
  assert.equal(await page.locator('h1').textContent(), 'You’re on the list');
  assert.deepEqual(waitlist.verify.at(-1), { type: 'email', email: 'Mika@Example.com', token: CODE });
  assert.deepEqual(waitlist.rpc, [{ p_source: 'hero' }]);
  assert.equal(waitlist.logout, 1, 'the web session is signed out');
  const html = await page.content();
  assert.ok(
    !html.includes(TURNSTILE_SECRET) && !html.includes(USER_TOKEN),
    'secrets and the session stay on the server',
  );
  assert.deepEqual(await page.context().cookies(), [], 'nothing is left behind');
  await page.close();
});

test('with the waitlist closed, its pages 404 and its actions email no one, even when posted by hand', async () => {
  resetWaitlist();
  const port = 3700 + Math.floor(Math.random() * 200);
  const closedBase = `http://127.0.0.1:${port}`;
  const closed = await startWeb(port, { ...webEnv, WAITLIST_OPEN: '' });
  try {
    for (const route of ['/waitlist', '/waitlist/code']) {
      assert.equal((await fetch(closedBase + route)).status, 404, route);
    }
    // The same build's action ids, posted the way a stale page or a script would.
    const manifest = JSON.parse(
      readFileSync(path.join(here, '../.next/server/server-reference-manifest.json'), 'utf8'),
    );
    const ids = Object.entries(manifest.node).filter(([, v]) => ['requestCode', 'verifyCode'].includes(v.exportedName));
    assert.equal(ids.length, 2);
    const post = (origin, id) => {
      // What a browser without JavaScript posts for <form action={serverAction}>.
      const form = new FormData();
      form.set(`$ACTION_ID_${id}`, '');
      form.set('email', 'mika@example.com');
      form.set('source', 'hero');
      form.set('cf-turnstile-response', 'stub-token');
      form.set('code', CODE);
      return fetch(`${origin}/`, { method: 'POST', headers: { Origin: origin }, body: form, redirect: 'manual' });
    };
    // Control: the open server takes this post as far as the captcha check.
    await post(base, ids.find(([, v]) => v.exportedName === 'requestCode')[0]);
    assert.equal(waitlist.captcha.length, 1);
    resetWaitlist();
    for (const [id] of ids) await post(closedBase, id);
    assert.deepEqual([waitlist.captcha, waitlist.otp, waitlist.verify, waitlist.rpc], [[], [], [], []]);
  } finally {
    closed.kill();
  }
});

test('an email that already has an account or is on the list gets its own answer', async () => {
  for (const [answer, title] of [
    ['member', 'You’re already on Pickld'],
    ['already', 'You’re already on the list'],
  ]) {
    resetWaitlist();
    waitlist.answer = answer;
    const { page } = await open('/waitlist');
    await page.locator('input[name="cf-turnstile-response"]').waitFor({ state: 'attached' });
    await page.getByLabel('Email address').fill('dale@example.com');
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await page.waitForURL(`${base}/waitlist/code`);
    await page.getByLabel('6-digit code').fill(CODE);
    await page.getByRole('button', { name: 'Join the waitlist' }).click();
    await page.waitForURL(`${base}/waitlist?status=${answer}`);
    assert.equal(await page.locator('h1').textContent(), title);
    assert.deepEqual(waitlist.rpc, [{ p_source: 'waitlist' }]);
    await page.close();
  }
});

test('without the captcha no code is sent, and Auth rate limits say so', async () => {
  resetWaitlist();
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJs = await context.newPage();
  await noJs.goto(`${base}/waitlist`);
  await noJs.getByLabel('Email address').fill('dale@example.com');
  await noJs.getByRole('button', { name: 'Join the waitlist' }).click();
  await noJs.waitForURL(`${base}/waitlist?status=captcha`);
  assert.equal(await noJs.locator('h1').textContent(), 'Please try that again');
  assert.equal(waitlist.otp.length, 0, 'no email without a captcha token');
  await context.close();

  waitlist.otpStatus = 429;
  const { page } = await open('/waitlist');
  await page.locator('input[name="cf-turnstile-response"]').waitFor({ state: 'attached' });
  await page.getByLabel('Email address').fill('dale@example.com');
  await page.getByRole('button', { name: 'Join the waitlist' }).click();
  await page.waitForURL(`${base}/waitlist?status=limited`);
  assert.equal(await page.locator('h1').textContent(), 'Too many sign-ups from here');
  await page.close();
});

test('the code page without a pending email asks to start again', async () => {
  const { page, status } = await open('/waitlist/code');
  assert.equal(status, 200);
  assert.equal(await page.locator('h1').textContent(), 'That took a little too long');
  assert.equal(await page.getByLabel('6-digit code').count(), 0);
  await page.close();
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

test('Our story is linked from the home page and tells the four steps, with the waitlist', async () => {
  const { page } = await open('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Our story' }).click();
  await page.waitForURL(`${base}/story`);
  assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), 'We said we’d come back.');
  const steps = await page.getByRole('region', { name: 'How we got here' }).locator('h2').allTextContents();
  assert.deepEqual(steps, ['The first Pickld', 'A bigger calling', 'A promise', 'Pickld, again']);
  assert.equal(await page.getByRole('button', { name: 'Join the waitlist' }).count(), 1);
  assert.ok(await noSideScroll(page));
  // The 2016 video is a poster linking to YouTube until it's played, then the no-cookie player.
  const video = page.getByRole('link', { name: /You Deserve to Be You!/ });
  assert.equal(await video.getAttribute('href'), 'https://www.youtube.com/watch?v=ATowlE1aWV4');
  assert.equal(await page.locator('iframe').count(), 0);
  await video.click();
  const src = await page.locator('iframe').getAttribute('src');
  assert.ok(src.startsWith('https://www.youtube-nocookie.com/embed/ATowlE1aWV4'), src);
  await page.close();
});

test('Why Pickld and Our mission are linked from every marketing page, cite their studies and link to each other', async () => {
  const { page } = await open('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Why Pickld' }).click();
  await page.waitForURL(`${base}/why`);
  assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), 'Your people. In order.');
  assert.deepEqual(
    await page.getByRole('region', { name: 'How Pickld decides what you see' }).locator('.mk-pill').allTextContents(),
    ['Moments', 'Jars', 'Discover'],
  );
  const studies = await page.getByRole('link', { name: /^Read “/ }).evaluateAll((as) => as.map((a) => a.href));
  assert.deepEqual(studies, [
    'https://doi.org/10.1038/s41586-026-10098-2',
    'https://doi.org/10.1126/science.abp9364',
    'https://www.hhs.gov/surgeongeneral/reports-and-publications/youth-mental-health/social-media/index.html',
    'https://eur-lex.europa.eu/eli/reg/2022/2065/oj',
  ]);
  // Every harm names its source, and each source is listed under Sources.
  const harms = page.getByRole('region', { name: 'What engagement algorithms do to us' });
  assert.equal(await harms.locator('h3').count(), 6);
  assert.equal(await harms.locator('a[href="#research"]').count(), 6);
  // Honest copy: never "algorithm-free" as a claim, only as the thing we say we aren't.
  const text = await page.locator('main').innerText();
  // Both pages start from the first Pickld, more than ten years ago.
  assert.match(text, /more than ten years ago/);
  assert.match(text, /We don’t claim to be “algorithm-free”/);
  assert.equal(await page.getByRole('button', { name: 'Join the waitlist' }).count(), 1);
  assert.ok(await noSideScroll(page));

  await page.getByRole('link', { name: 'Read our mission →' }).click();
  await page.waitForURL(`${base}/mission`);
  assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), 'Help people keep up with each other.');
  assert.equal(await page.getByRole('region', { name: 'What we hold ourselves to' }).locator('h3').count(), 6);
  assert.match(await page.locator('main').innerText(), /More than ten years ago, we wanted one simple thing/);
  assert.equal(await page.getByRole('link', { name: 'Read our story →' }).getAttribute('href'), '/story');
  assert.ok(await noSideScroll(page));
  await page.getByRole('link', { name: 'How Pickld works →' }).click();
  await page.waitForURL(`${base}/why`);
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

// ---------------------------------------------------------------- invite page (INV-05)

test('an invite names its sender, shows the code and copies it before opening the App Store', async () => {
  served.length = 0;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  await page.goto(`${base}/i/k7m2qx`); // case doesn't matter
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('h1').textContent(), 'Dale invited you to Pickld');
  assert.ok(await page.getByText('Dale · @dale').isVisible());
  assert.ok(await page.getByText('You and Dale will read each other’s jars.', { exact: false }).isVisible());
  assert.equal(await page.getByTestId('invite-code').textContent(), 'K7M2QX');
  assert.ok(await page.getByRole('region', { name: 'Your invite code: K 7 M 2 Q X' }).isVisible());
  // Only the inviter's photo: no moments, on the page or fetched (rule 9).
  assert.deepEqual(await page.locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('alt'))), [
    'Dale’s photo',
  ]);
  assert.deepEqual(served, ['/img/av_dale.jpg']);
  assert.equal(await page.getByRole('link', { name: 'Open the app' }).getAttribute('href'), 'pickld://i/K7M2QX');
  assert.ok(await noSideScroll(page));
  await page.getByRole('link', { name: 'Get the app' }).last().click();
  await page.waitForURL(`${stubUrl}/store`);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'K7M2QX');
  await context.close();
});

test('an invite link shows its id as the code to paste', async () => {
  const { page } = await open('/i/LINKAB1234');
  assert.equal(await page.getByTestId('invite-code').textContent(), 'LINKAB1234');
  assert.equal(await page.getByRole('link', { name: 'Open the app' }).getAttribute('href'), 'pickld://i/LINKAB1234');
  assert.ok(await noSideScroll(page));
  await page.close();
});

test('a waitlist code names no one', async () => {
  const { page } = await open('/i/WAIT01');
  assert.equal(await page.locator('h1').textContent(), 'You’re invited to Pickld');
  assert.equal(await page.locator('img').count(), 0);
  assert.equal(await page.getByTestId('invite-code').textContent(), 'WAIT01');
  await page.close();
});

test('every invite that can’t be used gets one page that names no one', async () => {
  for (const token of ['USED00', 'ZZZZZZZZZZ', 'not-a-code!']) {
    invites.length = 0;
    const { page, status } = await open(`/i/${encodeURIComponent(token)}`);
    assert.equal(status, 200);
    assert.equal(await page.locator('h1').textContent(), 'This invite can’t be used');
    assert.equal(await page.locator('img').count(), 0);
    assert.equal(await page.getByText('Dale').count(), 0);
    assert.equal(await page.getByTestId('invite-code').count(), 0);
    assert.equal(await page.getByRole('link', { name: 'Open the app' }).getAttribute('href'), 'pickld://');
    // Something that isn't a code or link id never reaches fn:invite.
    assert.equal(invites.length, token === 'not-a-code!' ? 0 : 1);
    await page.close();
  }
  // The preview image is a 404 too, and the tags name no one.
  const tags = await meta('/i/USED00');
  const image = new URL(tags['og:image']);
  assert.equal((await fetch(base + image.pathname + image.search)).status, 404);
  assert.equal(tags['og:title'], 'This invite can’t be used');
});

test('too many checks from one visitor says try again later', async () => {
  const { page } = await open('/i/BUSY99');
  assert.equal(await page.locator('h1').textContent(), 'Try again in a bit');
  await page.close();
});

test('the invite page passes the visitor’s IP to fn:invite with the server secret', async () => {
  invites.length = 0;
  const res = await fetch(`${base}/i/K7M2QX`, { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } });
  assert.equal(res.status, 200);
  assert.deepEqual(invites, [{ token: 'K7M2QX', ip: '203.0.113.7', secret: FORWARD_SECRET }]);
  assert.match(await res.text(), /<meta name="robots" content="noindex, nofollow"/);
});

test('an invite preview shows the sender and the jar, never a moment', async () => {
  const tags = await meta('/i/K7M2QX');
  assert.equal(tags['og:title'], 'Dale invited you to Pickld');
  assert.equal(tags['og:url'], `${SITE}/i/K7M2QX`);
  assert.equal(tags['twitter:card'], 'summary_large_image');
  served.length = 0;
  await preview(tags);
  assert.deepEqual(served, ['/img/av_dale.jpg']);
});

// ---------------------------------------------------------------- universal links / app links (M4-15)

test('the AASA file lets the app open profile, jar and sign-in links but not legal or marketing pages', async () => {
  const res = await fetch(`${base}/.well-known/apple-app-site-association`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const [detail] = (await res.json()).applinks.details;
  assert.deepEqual(detail.appIDs, [`${TEAM}.me.pickld.app`]);
  const excluded = detail.components.filter((c) => c.exclude).map((c) => c['/']);
  assert.deepEqual(excluded, [
    '/terms',
    '/privacy',
    '/guidelines',
    '/',
    '/stickers',
    '/story',
    '/why',
    '/mission',
    '/moments',
    '/features',
    '/waitlist',
    '/waitlist/*',
    '/.well-known/*',
  ]);
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
