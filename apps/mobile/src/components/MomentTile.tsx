import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { hitSlopFor } from '@/lib/hitSlop';
import { VISIBILITY_KEY, type Visibility } from '@/lib/visibility';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space, type Slot } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';
import { Icon } from './Icon';
import { PhotoTile } from './PhotoTile';
import { VisibilityBadge } from './VisibilityBadge';

export type MomentTileState = 'filled' | 'empty' | 'now' | 'waiting' | 'uploading' | 'failed' | 'checking' | 'removed';

export const momentTileStates: readonly MomentTileState[] = [
  'filled',
  'empty',
  'now',
  'waiting',
  'uploading',
  'failed',
  'checking',
  'removed',
];

export type MomentTileProps = {
  slot: Slot;
  state: MomentTileState;
  /** Photo (remote or queued local file) for every state except `empty` and `now`. */
  uri?: string | null;
  /** The photo drawn with its edits, used instead of `uri`'s plain image except while it is blurred. */
  photoView?: ReactNode;
  /** Capture time, already formatted for the user's locale (e.g. "7:30 AM"). */
  time?: string;
  /** Who can see the moment (D-48): drawn as a badge and spoken in the label. Null or left out: no badge. */
  visibility?: Visibility | null;
  /** Backfilled moment (server sets `is_backfilled`); shows the "Added later" badge. */
  addedLater?: boolean;
  /** Upload progress 0–1 for the `uploading` state; leave it out when unknown to show an indeterminate spinner. */
  progress?: number;
  onPress?: () => void;
  /** What a tap does, when the label doesn't say it (e.g. "Opens moment options"). Already translated. */
  accessibilityHint?: string;
  /** Shown as a Retry button in the `failed` state. */
  onRetry?: () => void;
  testID?: string;
};

const RING_RADIUS = 15;
const RING_VIEWBOX = 36;
const RING_STROKE = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function percentOf(progress: number | undefined): number {
  return Math.round(Math.min(1, Math.max(0, progress ?? 0)) * 100);
}

/** One slot on the Today grid: a photo with its upload state, an empty slot, or the current "Now" slot. */
export function MomentTile({
  slot,
  state,
  uri = null,
  photoView,
  time,
  visibility = null,
  addedLater = false,
  progress,
  onPress,
  accessibilityHint,
  onRetry,
  testID,
}: MomentTileProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const tag = t(`slots.${slot}`);
  const percent = percentOf(progress);
  const indeterminate = progress === undefined;
  const hasPhoto = state !== 'empty' && state !== 'now';
  // Checking and removed photos are unchecked or refused content: always blurred (rule 4).
  const blurred = state === 'checking' || state === 'removed';

  // "#slot, time, state": every state is spoken, never conveyed by color alone.
  const flags = hasPhoto
    ? [
        visibility ? t(`tile.a11y.visibility.${VISIBILITY_KEY[visibility]}`) : null,
        addedLater ? t('tile.a11y.addedLater') : null,
      ].filter((f): f is string => f !== null)
    : [];
  const stateWords: Record<MomentTileState, string[]> = {
    filled: flags.length > 0 ? flags : [t('tile.a11y.added')],
    empty: [t('tile.a11y.empty')],
    now: [t('tile.a11y.now')],
    waiting: [t('tile.a11y.waiting'), ...flags],
    uploading: [
      indeterminate ? t('tile.a11y.uploadingIndeterminate') : t('tile.a11y.uploading', { percent }),
      ...flags,
    ],
    failed: [t('tile.a11y.failed'), ...flags],
    checking: [t('tile.a11y.checking'), ...flags],
    removed: [t('moment.tile.a11yRemoved'), ...flags],
  };
  const accessibilityLabel = [tag, time, ...stateWords[state]].filter(Boolean).join(', ');

  const canRetry = state === 'failed' && onRetry !== undefined;
  const retryAction = { name: 'retry', label: t('tile.retry') };
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'retry') onRetry?.();
    if (e.nativeEvent.actionName === 'activate') onPress?.();
  };

  return (
    <Pressable
      testID={testID}
      accessible
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      accessibilityActions={canRetry ? [...(onPress ? [{ name: 'activate' }] : []), retryAction] : undefined}
      onAccessibilityAction={canRetry ? onAccessibilityAction : undefined}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.tile,
        state === 'empty' ? styles.empty : null,
        state === 'now' ? styles.now : null,
        hasPhoto ? shadow.tile : null,
        pressed && onPress ? { opacity: PRESSED_OPACITY } : null,
      ]}
    >
      {state === 'empty' || state === 'now' ? (
        <>
          <View style={styles.topRow}>
            <View style={[styles.iconWell, state === 'now' ? styles.iconWellNow : null]}>
              <Icon name={slot} color="ink" size={22} strokeWidth={state === 'now' ? 1.8 : 1.7} />
            </View>
            {state === 'now' ? (
              <View style={styles.nowChip}>
                <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('caption'), { color: colors.ink }]}>
                  {t('tile.now')}
                </Text>
              </View>
            ) : (
              <View style={styles.plus} testID="tile-plus">
                <Icon name="plus" color="brandLink" size={16} strokeWidth={2.4} />
              </View>
            )}
          </View>
          <View>
            <Text
              maxFontSizeMultiplier={maxTextScale.tile}
              style={[textStyle('body', '700'), { color: state === 'now' ? colors.surface : colors.ink }]}
            >
              {tag}
            </Text>
            {state === 'now' ? (
              <Text
                maxFontSizeMultiplier={maxTextScale.tile}
                style={[textStyle('label', '500'), { color: colors.onDarkMuted }]}
              >
                {t('tile.tapToCapture')}
              </Text>
            ) : null}
          </View>
        </>
      ) : (
        <PhotoTile
          uri={uri}
          // A blurred photo stays plain: its stickers and words would show through the blur.
          photoView={blurred ? undefined : photoView}
          height={sizes.momentTile}
          label={tag}
          blurred={blurred}
          overlayColor={state === 'failed' ? 'failedOverlay' : state === 'filled' ? undefined : 'glass'}
          topLeft={time ? <Pill text={time} /> : null}
          topRight={
            visibility || addedLater ? (
              <>
                {addedLater ? <Pill text={t('tile.addedLater')} tone="badge" testID="tile-added-later" /> : null}
                {visibility ? (
                  <VisibilityBadge
                    visibility={visibility}
                    testID={visibility === 'only_me' ? 'tile-lock' : `tile-visibility-${visibility}`}
                  />
                ) : null}
              </>
            ) : null
          }
        >
          {state === 'waiting' ? (
            <>
              <Icon name="clock" color="surface" size={26} strokeWidth={2} />
              <OverlayText text={t('tile.waiting')} />
            </>
          ) : null}
          {state === 'uploading' && indeterminate ? (
            <>
              <ActivityIndicator color={colors.surface} size="large" testID="tile-spinner" />
              <OverlayText text={t('tile.uploadingIndeterminate')} />
            </>
          ) : null}
          {state === 'uploading' && !indeterminate ? (
            <>
              <ProgressRing percent={percent} />
              <OverlayText text={t('tile.uploading', { percent })} />
            </>
          ) : null}
          {state === 'failed' ? (
            <>
              <Icon name="warning" color="surface" size={24} strokeWidth={2} />
              <OverlayText text={t('tile.failed')} />
              {onRetry ? (
                <RetryButton
                  label={t('tile.retry')}
                  a11yLabel={t('tile.retryLabel', { slot: tag })}
                  onPress={onRetry}
                />
              ) : null}
            </>
          ) : null}
          {state === 'checking' ? <OverlayText text={t('tile.checking')} /> : null}
          {state === 'removed' ? (
            <>
              <Icon name="warning" color="surface" size={24} strokeWidth={2} />
              <OverlayText text={t('moment.tile.removed')} />
            </>
          ) : null}
        </PhotoTile>
      )}
    </Pressable>
  );
}

function Pill({ text, tone = 'glass', testID }: { text: string; tone?: 'glass' | 'badge'; testID?: string }) {
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: colors[tone] }]}>
      <Text
        maxFontSizeMultiplier={maxTextScale.tile}
        style={[textStyle('caption'), { color: colors.surface }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

function OverlayText({ text }: { text: string }) {
  return (
    <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('label', '700'), styles.overlayText]}>
      {text}
    </Text>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const c = RING_VIEWBOX / 2;
  return (
    <Svg
      width={sizes.uploadRing}
      height={sizes.uploadRing}
      viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
      accessible={false}
      testID="tile-progress-ring"
    >
      <Circle cx={c} cy={c} r={RING_RADIUS} fill="none" stroke={colors.ringTrack} strokeWidth={RING_STROKE} />
      <Circle
        testID="tile-progress-arc"
        cx={c}
        cy={c}
        r={RING_RADIUS}
        fill="none"
        stroke={colors.surface}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - percent / 100)}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}

function RetryButton({ label, a11yLabel, onPress }: { label: string; a11yLabel: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(undefined, sizes.retryPill)}
      testID="tile-retry"
      style={[styles.retry, pressed ? { opacity: PRESSED_OPACITY } : null]}
    >
      <Text maxFontSizeMultiplier={maxTextScale.tile} style={[textStyle('label', '800'), { color: colors.likeText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: sizes.momentTile,
    borderRadius: radius.tile,
  },
  empty: {
    padding: space.md,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: sizes.tileBorder,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
  },
  now: {
    padding: space.md,
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    ...shadow.nowGlow,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  iconWell: {
    width: sizes.tileIconWell,
    height: sizes.tileIconWell,
    borderRadius: radius.thumbLg,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellNow: { backgroundColor: colors.brand },
  plus: {
    width: sizes.tilePlus,
    height: sizes.tilePlus,
    borderRadius: radius.pill,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowChip: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm,
  },
  pill: {
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm,
    flexShrink: 1,
  },
  overlayText: { color: colors.surface, textAlign: 'center' },
  retry: {
    minHeight: sizes.retryPill,
    minWidth: sizes.minTap,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
