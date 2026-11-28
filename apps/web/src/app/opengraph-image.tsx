import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from 'next/og';

import { colors, slots } from '@/theme/tokens';

import { t } from '~/i18n/t';
import { siteUrl, waitlistOpen } from '~/lib/env';
import { LOGO_D, OG_SIZE, OG_TYPE, fonts } from '~/lib/og';

// The site's link preview (pickld.me and every page without its own): a teaser jar with three of its eight moments
// shown. Prerendered at build, where it reads the example photos and sticker from disk; cf:build copies the PNG
// into the Worker's static assets (with its type in _headers), so Cloudflare serves it without running the Worker,
// which has neither the files nor a cache of prerendered routes.
// Messenger, Facebook, X and iMessage show it whole; WhatsApp and Telegram's small cards crop a centered
// square, so all words sit inside the middle 630 px and the crop's edges fall between tiles.

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = t('og.site.alt');

const TILE_W = 132;
const TILE_H = 176;
const GAP = 28;

const base64 = async (file: Promise<Buffer>, type: string) => `data:${type};base64,${(await file).toString('base64')}`;
const jpeg = (file: Promise<Buffer>) => base64(file, 'image/jpeg');

export default async function Image() {
  // Literal paths, so the build traces just these files. The three moments shown; the rest stay a question.
  const cwd = process.cwd();
  const [sticker, ootd, morning, evening] = await Promise.all([
    base64(readFile(path.join(cwd, '../../assets/stickers/olivia/judging-you.png')), 'image/png'),
    jpeg(readFile(path.join(cwd, 'src/marketing/moments/ootd-1.jpg'))),
    jpeg(readFile(path.join(cwd, 'src/marketing/moments/morning-1.jpg'))),
    jpeg(readFile(path.join(cwd, 'src/marketing/moments/evening-1.jpg'))),
  ]);
  const shown: Partial<Record<(typeof slots)[number], string>> = { ootd, morning, evening };
  const left = (i: number) => OG_SIZE.width / 2 - 4 * TILE_W - 3.5 * GAP + i * (TILE_W + GAP);
  const host = new URL(siteUrl()).host;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        background: colors.ink,
        color: colors.surface,
        fontFamily: 'Jakarta',
      }}
    >
      <svg width={110} height={45} viewBox="29 12 588 243" style={{ position: 'absolute', left: 64, top: 44 }}>
        <path fill={colors.brandLayer} fillRule="evenodd" d={LOGO_D} />
      </svg>
      <div
        style={{
          display: 'flex',
          marginTop: 54,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1,
          color: colors.brandLayer,
        }}
      >
        {t('marketing.hero.eyebrow').toUpperCase()}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginTop: 14,
          fontSize: 68,
          fontWeight: 800,
          letterSpacing: -3,
          lineHeight: 1.04,
        }}
      >
        <span>{t('og.site.title1')}</span>
        <span>{t('og.site.title2')}</span>
      </div>
      <div style={{ display: 'flex', marginTop: 16, fontSize: 26, fontWeight: 500, color: colors.onDarkMuted }}>
        {t('og.site.body')}
      </div>
      {waitlistOpen() ? (
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            padding: '12px 26px',
            borderRadius: 999,
            background: colors.brand,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {t('og.site.cta', { host })}
        </div>
      ) : (
        <div style={{ display: 'flex', marginTop: 30, fontSize: 24, fontWeight: 700 }}>{host}</div>
      )}
      {slots.map((slot, i) =>
        shown[slot] ? (
          <div key={slot} style={{ display: 'flex', position: 'absolute', left: left(i), top: 410 }}>
            <img
              src={shown[slot]}
              width={TILE_W}
              height={TILE_H}
              style={{ borderRadius: 14, objectFit: 'cover' }}
              alt=""
            />
            <div
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                display: 'flex',
                padding: '4px 8px',
                borderRadius: 999,
                background: colors.glass,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              #{slot}
            </div>
          </div>
        ) : (
          <div
            key={slot}
            style={{
              position: 'absolute',
              left: left(i),
              top: 410,
              width: TILE_W,
              height: TILE_H,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 14,
              background: colors.onDarkWell,
              border: `2px dashed ${colors.onDarkControl}`,
            }}
          >
            <div style={{ display: 'flex', fontSize: 52, fontWeight: 800, color: colors.brandLayer }}>?</div>
            <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: colors.onDarkMuted }}>#{slot}</div>
          </div>
        ),
      )}
      <img
        src={sticker}
        width={104}
        height={104}
        style={{ position: 'absolute', left: left(4) + 84, top: 362, transform: 'rotate(10deg)' }}
        alt=""
      />
    </div>,
    { ...OG_SIZE, fonts: await fonts() },
  );
}
