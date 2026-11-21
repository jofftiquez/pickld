import type { CSSProperties } from 'react';

import {
  bubbleAspect,
  bubbleTailGeometry,
  bubbleTailSide,
  cloudGeometry,
  isCloud,
  tailPathData,
} from '@/features/edit/bubble/bubbleLayout';
import { parseEdits, type Bubble, type Mention, type Overlay, type Place } from '@/features/edit/edits';
import { mentionReferenceWidth, mentionText } from '@/features/edit/mention/mentionLayout';
import { PIN_PATH, PIN_VIEWBOX, placeReferenceWidth } from '@/features/edit/place/placeLayout';
import {
  BACKGROUND_RADIUS,
  layoutText,
  outlineOffsets,
  textBoxColors,
  textColorValues,
  TEXT_REF_WIDTH,
  TEXT_TRACKING,
  textStyleOf,
  type TextFont,
  type TextOverlay,
} from '@/features/edit/text/textOverlay';
import { bubble, bubbleColors, colors, place as placeStyle, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import type { PublicMoment } from '~/lib/publicPage';

import { LoadedPhoto } from './LoadedPhoto';

// One 3:4 moment with its edits drawn over it, as the app draws them (FR-CAP-08: edits are data, never
// burned into the photo). Overlay positions are fractions of the photo, so they scale with the tile;
// sizes measured on the 390-point reference photo use container query units. Text is laid out as in the
// app (layoutText), so its lines and size match the moment detail.

function place(o: Overlay): CSSProperties {
  return {
    position: 'absolute',
    left: `${o.x * 100}%`,
    top: `${o.y * 100}%`,
    width: `${o.scale * 100}%`,
    transform: `translate(-50%, -50%) rotate(${o.rotation}rad)`,
    pointerEvents: 'none',
  };
}

const cq = (points: number) => `${(points / TEXT_REF_WIDTH) * 100}cqw`;

/**
 * A bubble's tail hanging below it on its side, from the app's geometry (bubbleTailGeometry): a point, or
 * a thought's two dots. It spans the bubble's width in the app's reference units, so it scales with the
 * bubble; its top sits `tailOverlap` up into the body (a percentage margin is of the bubble's width).
 */
function BubbleTailArt({ overlay, fill }: { overlay: Bubble; fill: string }) {
  const tail = bubbleTailSide(overlay);
  // A cloud's dots follow its puffs, so they are placed below its box's real height; the rest only need
  // the part below the box.
  const height = isCloud(overlay) ? cloudHeight(overlay) : 0;
  const geometry = bubbleTailGeometry(overlay.shape, tail, height, isCloud(overlay));
  const top = bubble.tailOverlap;
  return (
    <svg
      aria-hidden
      data-bubble-tail={tail}
      viewBox={`0 ${height - top} ${bubble.referenceWidth} ${top + geometry.extent}`}
      style={{
        position: 'absolute',
        left: 0,
        top: '100%',
        width: '100%',
        marginTop: `${(-top / bubble.referenceWidth) * 100}%`,
        overflow: 'visible',
        display: 'block',
      }}
    >
      {geometry.kind === 'dots' ? (
        geometry.dots.map((d, i) => <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={fill} />)
      ) : (
        <path d={tailPathData(geometry.points)} fill={fill} />
      )}
    </svg>
  );
}

/** A cloud thought's box height in the app's reference units (its width is bubble.referenceWidth). */
const cloudHeight = (o: Bubble) => bubbleAspect(o) * bubble.referenceWidth;

/** A cloud thought's body (the app's cloudGeometry), filling the bubble's box behind its text. */
function CloudArt({ overlay, fill }: { overlay: Bubble; fill: string }) {
  const height = cloudHeight(overlay);
  const { core, puffs } = cloudGeometry(height);
  return (
    <svg
      aria-hidden
      data-bubble-cloud
      viewBox={`0 0 ${bubble.referenceWidth} ${height}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: -1, display: 'block' }}
    >
      <rect x={core.x} y={core.y} width={core.width} height={core.height} fill={fill} />
      {puffs.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={fill} />
      ))}
    </svg>
  );
}

// The text tool's faces: the bundled ones by the variables layout.tsx sets, and the phone faces Type and
// Serif use, with the free faces the export draws them in as stand-ins.
const TEXT_FAMILY: Record<TextFont, string> = {
  clean: 'var(--font-jakarta)',
  bold: 'var(--font-jakarta)',
  type: 'Menlo, "DejaVu Sans Mono", monospace',
  serif: 'Georgia, Gelasio, serif',
  script: 'var(--font-script)',
  strong: 'var(--font-strong)',
  marker: 'var(--font-marker)',
  hand: 'var(--font-hand)',
};
const TEXT_WEIGHT: Partial<Record<TextFont, number>> = { clean: 600, bold: 800 };

/**
 * A text overlay as the app's TextOverlayView draws it: the lines layoutText chose (never wrapped here),
 * sized with its box so a pinch zoom shows, on its background, with its outline (copies of the words
 * round a circle, as text shadows) or, when plain, the legibility shadow.
 */
function TextArt({ overlay }: { overlay: TextOverlay }) {
  const style = textStyleOf(overlay);
  const layout = layoutText(overlay);
  // Reference points to container width: the box is overlay.scale of the photo and layout.width points.
  const u = (points: number) => `${((points * overlay.scale) / layout.width) * 100}cqw`;
  const size = layout.fontSize;
  const { words, box } = textBoxColors(style);
  const { outline } = style;
  const shadow =
    outline !== undefined
      ? outlineOffsets()
          .map(({ dx, dy }) => `${u(dx * size)} ${u(dy * size)} 0 ${textColorValues[outline]}`)
          .join(', ')
      : style.background === 'none'
        ? `0 ${u((2 * size) / 30)} ${u((10 * size) / 30)} ${style.color === 'ink' ? colors.textOverlayShadowOnDark : colors.textOverlayShadow}`
        : undefined;
  return (
    <span
      data-text-overlay={overlay.id}
      style={{
        ...place(overlay),
        boxSizing: 'border-box',
        padding: `${u(layout.padY)} ${u(layout.padX)}`,
        background: box,
        borderRadius: box ? u(BACKGROUND_RADIUS * size) : undefined,
        color: words,
        fontFamily: TEXT_FAMILY[style.font],
        fontWeight: TEXT_WEIGHT[style.font] ?? 400,
        fontStyle: style.font === 'serif' ? 'italic' : 'normal',
        fontSize: u(size),
        lineHeight: u(layout.lineHeight),
        letterSpacing: u(TEXT_TRACKING[style.font] * size),
        textAlign: style.align,
        textShadow: shadow,
        whiteSpace: 'pre',
      }}
    >
      {layout.lines.join('\n')}
    </span>
  );
}

/**
 * A place sticker as the app's PlaceOverlay draws it: a pill in its bubble color with the pin and the
 * name on one line, laid out in reference points (placeReferenceWidth) and scaled to its box.
 */
function PlaceArt({ overlay }: { overlay: Place }) {
  const pair = bubbleColors[overlay.color];
  const refWidth = placeReferenceWidth(overlay.text);
  // Reference points to container width: the box is overlay.scale of the photo and refWidth points wide.
  const u = (points: number) => `${((points * overlay.scale) / refWidth) * 100}cqw`;
  return (
    <span
      data-place-overlay={overlay.id}
      style={{
        ...place(overlay),
        aspectRatio: `${refWidth} / ${placeStyle.referenceHeight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: u(placeStyle.gap),
        padding: `0 ${u(placeStyle.paddingX)}`,
        boxSizing: 'border-box',
        borderRadius: 9999,
        background: pair.fill,
        color: pair.text,
        fontSize: u(placeStyle.fontSize),
        fontWeight: 800,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <svg
        aria-hidden
        viewBox={`0 0 ${PIN_VIEWBOX} ${PIN_VIEWBOX}`}
        style={{ width: u(placeStyle.icon), height: u(placeStyle.icon), flexShrink: 0 }}
      >
        <path d={PIN_PATH} fill={pair.text} fillRule="evenodd" />
      </svg>
      {overlay.text}
    </span>
  );
}

/**
 * A mention sticker as the app's MentionOverlay draws it: "@username" in a pill of its bubble color. Plain text
 * here, never a link: the shared page doesn't send visitors to profiles (0172).
 */
function MentionArt({ overlay }: { overlay: Mention }) {
  const pair = bubbleColors[overlay.color];
  const refWidth = mentionReferenceWidth(overlay.username);
  const u = (points: number) => `${((points * overlay.scale) / refWidth) * 100}cqw`;
  return (
    <span
      data-mention-overlay={overlay.id}
      style={{
        ...place(overlay),
        aspectRatio: `${refWidth} / ${placeStyle.referenceHeight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${u(placeStyle.paddingX)}`,
        boxSizing: 'border-box',
        borderRadius: 9999,
        background: pair.fill,
        color: pair.text,
        fontSize: u(placeStyle.fontSize),
        fontWeight: 800,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {mentionText(overlay.username)}
    </span>
  );
}

function OverlayView({ overlay, assetBase }: { overlay: Overlay; assetBase: string }) {
  if (overlay.type === 'sticker') {
    // Sticker art is public catalog data, served without a token (D-25).
    return <img src={`${assetBase}/${overlay.asset}`} alt={overlay.label} style={place(overlay)} />;
  }
  if (overlay.type === 'text') return <TextArt overlay={overlay} />;
  if (overlay.type === 'place') return <PlaceArt overlay={overlay} />;
  if (overlay.type === 'mention') return <MentionArt overlay={overlay} />;
  const style = bubbleColors[overlay.color];
  const cloud = isCloud(overlay);
  return (
    <span
      style={{
        ...place(overlay),
        ...(cloud
          ? {
              // The cloud fills a box shaped as in the app, with the text centred in it.
              aspectRatio: `${bubble.referenceWidth} / ${cloudHeight(overlay)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              isolation: 'isolate',
            }
          : null),
        background: cloud ? 'transparent' : style.fill,
        color: style.text,
        borderRadius: cq(24),
        padding: `${cq(10)} ${cq(14)}`,
        fontSize: cq(18),
        fontWeight: 700,
        textAlign: 'center',
        boxSizing: 'border-box',
        overflowWrap: 'anywhere',
      }}
    >
      {cloud ? <CloudArt overlay={overlay} fill={style.fill} /> : null}
      {overlay.text}
      <BubbleTailArt overlay={overlay} fill={style.fill} />
    </span>
  );
}

export function MomentPhoto({
  moment,
  authorName,
  assetBase,
  rounded = radius.thumb,
}: {
  moment: PublicMoment;
  authorName: string;
  assetBase: string;
  rounded?: number;
}) {
  const edits = parseEdits(moment.edits);
  const src = moment.thumb ?? moment.full;
  const overlays = edits.overlays.map((o) => <OverlayView key={o.id} overlay={o} assetBase={assetBase} />);
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '3 / 4',
        borderRadius: rounded,
        overflow: 'hidden',
        background: colors.photoPlaceholder,
        containerType: 'inline-size',
      }}
    >
      {src ? (
        <LoadedPhoto
          src={src}
          alt={t('jar.photo', { name: authorName, slot: moment.slot })}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            filter: edits.filter === 'original' ? undefined : `url(#filter-${edits.filter})`,
          }}
        >
          {overlays}
        </LoadedPhoto>
      ) : (
        overlays
      )}
    </div>
  );
}
