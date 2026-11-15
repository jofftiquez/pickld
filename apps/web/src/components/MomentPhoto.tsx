import type { CSSProperties } from 'react';

import { bubbleTailGeometry, bubbleTailSide, tailPathData } from '@/features/edit/bubble/bubbleLayout';
import { parseEdits, type Bubble, type Overlay } from '@/features/edit/edits';
import { textColorValues, TEXT_REF_WIDTH } from '@/features/edit/text/textOverlay';
import { bubble, bubbleColors, colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';
import type { PublicMoment } from '~/lib/publicPage';

import { LoadedPhoto } from './LoadedPhoto';

// One 3:4 moment with its edits drawn over it, as the app draws them (FR-CAP-08: edits are data, never
// burned into the photo). Overlay positions are fractions of the photo, so they scale with the tile;
// sizes measured on the 390-point reference photo use container query units.

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
  const geometry = bubbleTailGeometry(overlay.shape, tail, 0);
  const top = bubble.tailOverlap;
  return (
    <svg
      aria-hidden
      data-bubble-tail={tail}
      viewBox={`0 ${-top} ${bubble.referenceWidth} ${top + geometry.extent}`}
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

function OverlayView({ overlay, assetBase }: { overlay: Overlay; assetBase: string }) {
  if (overlay.type === 'sticker') {
    // Sticker art is public catalog data, served without a token (D-25).
    return <img src={`${assetBase}/${overlay.asset}`} alt={overlay.label} style={place(overlay)} />;
  }
  if (overlay.type === 'text') {
    return (
      <span
        style={{
          ...place(overlay),
          color: textColorValues[overlay.color],
          fontSize: cq(overlay.size),
          fontWeight: 800,
          textAlign: overlay.align,
          lineHeight: 1.25,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {overlay.text}
      </span>
    );
  }
  const style = bubbleColors[overlay.color];
  return (
    <span
      style={{
        ...place(overlay),
        background: style.fill,
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
