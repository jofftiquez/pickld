import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ImageResponse } from 'next/og';

import { colors, jar as jarColors } from '@/theme/tokens';

import { t } from '~/i18n/t';

import { bySlot, longDate, newestCaption, weekday } from './format';
import type { PublicAuthor, PublicMoment } from './publicPage';

// Link preview images (M4-14, FR-WEB-02; design: ShareCard). 1200×630 is the size Messenger, Facebook,
// X (summary_large_image) and iMessage all show uncropped. The share card's parts, laid out landscape:
// author, date and count, the slot-ordered grid, the newest caption and the wordmark. Built only from
// fn:public-page data, so private and unchecked moments never appear (rule 9); a Readers jar gets no photos.
// Photos are drawn as stored: Satori can't apply the color filter matrices, so filters and overlays are
// left out here (the page itself draws them).

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';

const LOGO_D = 'M248.2 108.0 L248.0 207.5 L278.5 207.8 L278.8 108.2ZM325.2 111.0 L324.5 112.0 L319.2 114.0 L317.5 116.0 L316.2 116.0 L312.5 120.0 L311.2 120.0 L308.0 123.2 L308.0 124.5 L303.0 130.2 L303.0 131.5 L299.0 138.2 L299.0 140.5 L298.0 141.2 L298.0 144.5 L297.0 145.2 L297.0 149.5 L296.0 150.2 L296.0 168.5 L297.0 169.2 L297.0 173.5 L298.0 174.2 L298.0 177.5 L299.0 178.2 L299.0 180.5 L301.0 183.2 L301.0 185.5 L303.0 187.2 L304.0 190.5 L308.0 194.2 L308.0 195.5 L310.2 197.8 L311.5 197.8 L317.2 202.8 L318.5 202.8 L323.2 205.8 L328.5 206.8 L329.2 207.8 L332.5 207.8 L333.2 208.8 L340.5 208.8 L341.2 209.8 L349.5 209.8 L350.2 208.8 L358.5 208.8 L359.2 207.8 L363.5 207.8 L364.2 206.8 L367.5 206.8 L368.8 205.5 L368.8 202.2 L367.8 201.5 L367.8 194.2 L366.8 193.5 L366.8 186.2 L365.8 185.5 L365.8 183.2 L359.2 184.0 L358.5 185.0 L346.2 185.0 L345.5 184.0 L343.2 184.0 L342.5 183.0 L337.2 181.0 L331.8 174.5 L331.8 173.2 L329.8 170.5 L329.8 168.2 L328.8 167.5 L328.8 164.2 L327.8 163.5 L327.8 152.2 L328.8 151.5 L328.8 148.2 L329.8 147.5 L329.8 145.2 L330.8 144.5 L331.8 141.2 L333.8 139.5 L333.8 138.2 L339.2 133.8 L340.5 133.8 L343.2 131.8 L346.5 131.8 L347.2 130.8 L356.5 130.8 L357.2 131.8 L362.5 131.8 L363.2 132.8 L365.5 132.8 L365.8 128.2 L366.8 127.5 L366.8 123.2 L367.8 122.5 L367.8 118.2 L368.8 117.5 L368.8 113.2 L369.8 112.5 L369.8 110.2 L368.5 109.0 L365.2 109.0 L364.5 108.0 L360.2 108.0 L359.5 107.0 L340.2 107.0 L339.5 108.0 L334.2 108.0 L333.5 109.0 L331.2 109.0 L330.5 110.0ZM616.5 72.0 L591.0 72.2 L590.5 122.0 L584.5 116.0 L583.2 116.0 L578.5 113.0 L575.2 113.0 L574.5 112.0 L560.2 112.0 L559.5 113.0 L556.2 113.0 L555.5 114.0 L548.2 117.0 L546.5 119.0 L545.2 119.0 L539.0 125.2 L539.0 126.5 L537.0 128.2 L537.0 129.5 L535.0 131.2 L535.0 132.5 L533.0 135.2 L533.0 137.5 L532.0 138.2 L532.0 140.5 L531.0 141.2 L531.0 143.5 L530.0 144.2 L530.0 148.5 L529.0 149.2 L529.0 172.5 L530.0 173.2 L530.0 177.5 L531.0 178.2 L531.0 181.5 L533.0 184.2 L533.0 186.5 L534.0 187.2 L535.0 190.5 L537.0 192.2 L537.0 193.5 L539.0 195.2 L539.0 196.5 L545.2 202.8 L546.5 202.8 L548.2 204.8 L549.5 204.8 L554.2 207.8 L557.5 207.8 L558.2 208.8 L573.5 208.8 L574.2 207.8 L579.5 206.8 L583.2 203.8 L584.5 203.8 L591.8 196.5 L592.2 194.8 L594.0 195.2 L594.0 203.5 L595.0 204.2 L595.2 207.8 L616.8 207.5ZM573.2 130.8 L574.5 130.8 L575.2 131.8 L579.5 131.8 L583.2 134.8 L584.5 134.8 L587.0 137.2 L587.0 138.5 L590.0 143.2 L590.0 145.5 L591.0 146.2 L591.0 174.5 L590.0 175.2 L590.0 177.5 L589.0 178.2 L588.0 181.5 L586.0 183.2 L586.0 184.5 L578.5 189.0 L568.2 189.0 L567.5 188.0 L564.2 187.0 L558.8 181.5 L558.8 180.2 L556.8 177.5 L556.8 175.2 L555.8 174.5 L555.8 172.2 L554.8 171.5 L554.8 165.2 L553.8 164.5 L553.8 157.2 L554.8 156.5 L554.8 150.2 L555.8 149.5 L555.8 146.2 L557.8 143.5 L557.8 141.2 L564.2 133.8 L565.5 133.8 L568.2 131.8 L572.5 131.8ZM487.2 72.0 L487.0 207.5 L511.5 207.8 L511.8 72.2ZM385.2 72.0 L385.0 207.5 L409.5 207.8 L410.8 206.5 L410.8 175.2 L417.5 167.8 L419.0 169.2 L421.0 174.5 L423.0 176.2 L426.0 183.5 L428.0 185.2 L431.0 192.5 L433.0 194.2 L435.0 199.5 L437.0 201.2 L437.0 202.5 L440.2 207.8 L469.5 207.8 L469.8 206.2 L467.8 204.5 L466.8 201.2 L464.8 199.5 L464.8 198.2 L462.8 196.5 L462.8 195.2 L458.8 190.5 L457.8 187.2 L455.8 185.5 L455.8 184.2 L451.8 179.5 L450.8 176.2 L448.8 174.5 L448.8 173.2 L444.8 168.5 L443.8 165.2 L441.8 163.5 L441.8 162.2 L437.8 157.5 L436.8 154.2 L434.8 152.5 L435.8 151.5 L435.8 150.2 L440.8 145.5 L440.8 144.2 L444.8 140.5 L444.8 139.2 L449.8 134.5 L449.8 133.2 L453.8 129.5 L453.8 128.2 L458.8 123.5 L458.8 122.2 L462.8 118.5 L462.8 117.2 L465.8 114.2 L436.2 114.0 L436.0 115.5 L434.0 117.2 L434.0 118.5 L432.0 120.2 L432.0 121.5 L430.0 123.2 L430.0 124.5 L428.0 126.2 L428.0 127.5 L426.0 129.2 L426.0 130.5 L424.0 132.2 L424.0 133.5 L422.0 135.2 L421.0 138.5 L419.0 140.2 L419.0 141.5 L415.0 146.2 L415.0 147.5 L411.2 154.0 L410.8 72.2ZM254.2 68.0 L249.0 73.2 L249.0 74.5 L248.0 75.2 L248.0 78.5 L247.0 79.2 L247.0 84.5 L248.0 85.2 L248.0 87.5 L251.0 91.2 L251.0 92.5 L252.2 93.8 L253.5 93.8 L255.2 95.8 L257.5 95.8 L258.2 96.8 L268.5 96.8 L269.2 95.8 L271.5 95.8 L273.2 93.8 L274.5 93.8 L276.8 91.5 L276.8 90.2 L278.8 87.5 L278.8 85.2 L279.8 84.5 L279.8 78.2 L278.8 77.5 L278.8 75.2 L275.8 71.5 L275.8 70.2 L274.2 70.0 L272.5 68.0 L271.2 68.0 L268.5 66.0 L258.2 66.0 L257.5 67.0ZM205.5 12.0 L29.0 36.2 L60.2 254.8 L96.8 233.5 L100.8 205.2 L103.2 201.8 L230.8 184.5ZM186.5 37.8 L203.0 150.5 L71.2 169.0 L54.8 56.2Z';

async function fonts() {
  const dir = path.join(process.cwd(), 'src/fonts');
  const load = (file: string) => readFile(path.join(dir, file));
  return [
    { name: 'Jakarta', data: await load('PlusJakartaSans_500Medium.ttf'), weight: 500 as const },
    { name: 'Jakarta', data: await load('PlusJakartaSans_700Bold.ttf'), weight: 700 as const },
    { name: 'Jakarta', data: await load('PlusJakartaSans_800ExtraBold.ttf'), weight: 800 as const },
  ];
}

function Logo() {
  return (
    <svg width={136} height={56} viewBox="29 12 588 243">
      <path fill={colors.brand} fillRule="evenodd" d={LOGO_D} />
    </svg>
  );
}

function Jar() {
  return (
    <svg width={192} height={240} viewBox="0 0 48 60">
      <rect x={5} y={15} width={38} height={42} rx={10} fill={jarColors.glass} />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={7} y={50 - i * 4.6} width={34} height={4.8} fill={i % 2 ? colors.brandLayer : colors.brand} />
      ))}
      {/* Satori doesn't clip, so a ring in the card's color rounds the layers' corners. */}
      <rect x={3} y={13} width={42} height={46} rx={12} fill="none" stroke={colors.surface} strokeWidth={4} />
      <rect x={5} y={15} width={38} height={42} rx={10} fill="none" stroke={colors.dashed} strokeWidth={2} />
      <rect x={13} y={10} width={22} height={5} rx={1.5} fill="none" stroke={colors.dashed} strokeWidth={2} />
      <rect x={10} y={2} width={28} height={8} rx={3} fill={colors.brand} />
    </svg>
  );
}

/**
 * Photos are fetched here and embedded, rather than left for the renderer to fetch: the URLs are the
 * signed ones fn:public-page returned (nothing else is ever fetched), and a photo that fails to load
 * becomes a placeholder instead of failing the whole preview.
 */
async function embed(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

export type OgInput =
  | { kind: 'jar'; author: PublicAuthor; localDate: string; count: number; moments: PublicMoment[] }
  | { kind: 'readers'; author: PublicAuthor; localDate: string }
  | { kind: 'profile'; author: PublicAuthor; moments: PublicMoment[] };

export async function ogImage(input: OgInput): Promise<ImageResponse> {
  const { author } = input;
  const name = author.display_name;
  const moments = input.kind === 'readers' ? [] : bySlot(input.moments).slice(0, 8);
  const caption = input.kind === 'jar' ? newestCaption(moments) : null;
  const title =
    input.kind === 'jar'
      ? t('og.jarTitle', { name, weekday: weekday(input.localDate) })
      : input.kind === 'readers'
        ? t('og.readersTitle', { name, weekday: weekday(input.localDate) })
        : name;
  const meta =
    input.kind === 'jar'
      ? t('og.jarMeta', { date: longDate(input.localDate), count: String(input.count) })
      : input.kind === 'readers'
        ? t('og.readersBody', { name })
        : t('og.profileMeta', { username: author.username });
  const [avatar, ...photos] = await Promise.all([
    embed(author.avatar),
    ...moments.map((m) => embed(m.full ?? m.thumb)),
  ]);
  const tileW = 172; // 4 across and 2 down inside the white card, 3:4
  const tileH = 229;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: colors.background,
          padding: 48,
          gap: 40,
          fontFamily: 'Jakarta',
          color: colors.ink,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 300, flexShrink: 0 }}>
          {avatar ? (
            <img src={avatar} width={96} height={96} style={{ borderRadius: 48, objectFit: 'cover' }} alt="" />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 48, background: colors.brandTint }} />
          )}
          <div style={{ display: 'flex', marginTop: 24, fontSize: 40, fontWeight: 800, letterSpacing: -1, lineHeight: 1.15 }}>
            {title}
          </div>
          <div style={{ display: 'flex', marginTop: 10, fontSize: 24, fontWeight: 500, color: colors.muted }}>{meta}</div>
          {caption ? (
            <div style={{ display: 'flex', marginTop: 22, fontSize: 24, fontWeight: 500, lineHeight: 1.4, color: colors.inkSoft }}>
              {t('jar.caption', { caption: caption.length > 90 ? `${caption.slice(0, 88)}…` : caption })}
            </div>
          ) : null}
          <div style={{ display: 'flex', marginTop: 'auto' }}>
            <Logo />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flex: 1,
            background: colors.surface,
            borderRadius: 32,
            padding: 16,
            flexWrap: 'wrap',
            gap: 10,
            alignContent: 'center',
            justifyContent: moments.length ? 'flex-start' : 'center',
            alignItems: 'center',
          }}
        >
          {moments.length
            ? moments.map((m, i) =>
                photos[i] ? (
                  <img
                    key={m.id}
                    src={photos[i]}
                    width={tileW}
                    height={tileH}
                    style={{ borderRadius: 16, objectFit: 'cover' }}
                    alt=""
                  />
                ) : (
                  <div key={m.id} style={{ width: tileW, height: tileH, borderRadius: 16, background: colors.photoPlaceholder }} />
                ),
              )
            : <Jar />}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
