import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { parseEdits } from '@/features/edit/edits';
import { buildJarPage, type JarMoment, type JarPageData } from '@/features/jar/jarPage';
import { firstName } from '@/features/jar/shareJar';
import { deviceLocale, formatShortDate, formatTime } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, slots, space } from '@/theme/tokens';

import { MomentView } from './MomentView';

export type MomentDetailViewProps = {
  /** The moment's jar, read as the viewer (useJarPage). Undefined while loading; null when not available. */
  data: JarPageData | null | undefined;
  /** The request failed and nothing is cached. */
  failed?: boolean;
  /** The moment to open on. */
  momentId: string;
  insets: EdgeInsets;
  onClose: () => void;
  onShare: () => void;
  onRetry: () => void;
  locale?: string;
};

/**
 * One moment full screen (Moment detail; FR-SOC-04): the 3:4 photo with its edits under eight progress
 * bars, swiped left and right through the jar's shown moments only (the same list as the Jar page, so
 * private and unchecked moments are never reachable by others), and a sheet with the #slot, time, caption,
 * likes, comments and share.
 */
export function MomentDetailView({
  data,
  failed = false,
  momentId,
  insets,
  onClose,
  onShare,
  onRetry,
  locale = deviceLocale(),
}: MomentDetailViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const moments = data ? buildJarPage(data).moments : [];
  const start = moments.findIndex((m) => m.id === momentId.toLowerCase());
  const [index, setIndex] = useState<number | null>(null);
  const current = index ?? start;
  const list = useRef<FlatList<JarMoment>>(null);

  if (!data || start === -1) {
    const loading = data === undefined && !failed;
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]} testID="moment-detail">
        <View style={[styles.topRow, { top: insets.top + space.md }]}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('moment.close')}
            onPress={onClose}
            testID="moment-close"
          />
        </View>
        {loading ? (
          <ActivityIndicator color={colors.surface} accessibilityLabel={t('moment.loading')} />
        ) : (
          <View style={styles.message}>
            <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.messageText]}>
              {failed ? t('moment.error.title') : t('moment.notFound.title')}
            </Text>
            {failed ? (
              <SecondaryButton label={t('jarPage.retry')} onPress={onRetry} testID="moment-retry" />
            ) : (
              <Text style={[textStyle('body'), styles.messageText]} testID="moment-not-available">
                {t('moment.detail.notAvailable')}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  const moment = moments[current] ?? moments[start];
  if (moment === undefined) return null;
  const photoHeight = width / photo.aspect;
  const at = new Date(moment.captured_at ?? moment.added_at);
  const slot = t(`slots.${moment.slot}`);
  const caption = moment.caption?.trim() ? moment.caption.trim() : null;

  const goTo = (next: number) => {
    if (next < 0 || next >= moments.length) return;
    setIndex(next);
    list.current?.scrollToIndex({ index: next, animated: false });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== current && next >= 0 && next < moments.length) setIndex(next);
  };
  // Screen readers can't swipe a pager: the photo is adjustable, so swipe up or down moves between moments.
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') goTo(current + 1);
    if (e.nativeEvent.actionName === 'decrement') goTo(current - 1);
  };

  return (
    <View style={styles.screen} testID="moment-detail">
      <View style={{ height: photoHeight + insets.top, paddingTop: insets.top }}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('moment.detail.photo', { slot, position: current + 1, count: moments.length })}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
        >
          <FlatList
            ref={list}
            data={moments}
            keyExtractor={(m) => m.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={start}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item }) => <Page moment={item} width={width} tz={data.jar.tz} />}
            testID="moment-pager"
          />
        </View>
        <View
          style={[styles.progress, { top: insets.top + space.md + 2 }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="moment-progress"
        >
          {Array.from({ length: slots.length }, (_, i) => (
            <View
              key={i}
              style={[styles.bar, { backgroundColor: i <= current ? colors.surface : colors.progressTrack }]}
              testID={i <= current ? 'moment-progress-done' : 'moment-progress-todo'}
            />
          ))}
        </View>
        <View
          style={[styles.topRow, { top: insets.top + sizes.momentProgress + space.xxl - 1 }]}
          pointerEvents="box-none"
        >
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('moment.close')}
            onPress={onClose}
            testID="moment-close"
          />
          <View style={styles.author} testID="moment-author">
            <Avatar name={data.author.display_name} uri={null} size="sm" decorative />
            <Text style={[textStyle('bodySmall', '700'), { color: colors.surface }]} numberOfLines={1}>
              {firstName(data.author.display_name)}
            </Text>
          </View>
          {/* TODO(M3-21, #82): More options → Report on someone else's moment; Moment options for the owner. */}
          <View style={styles.topSpacer} />
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.xxxl) }]} testID="moment-sheet">
        <View style={styles.metaRow}>
          <View style={styles.slotChip}>
            <Text style={[textStyle('bodySmall', '700'), { color: colors.brandText }]}>{slot}</Text>
          </View>
          <Text style={[textStyle('bodySmall', '400'), styles.when]} numberOfLines={1} testID="moment-when">
            {t('moment.detail.when', {
              time: formatTime(at, data.jar.tz, locale),
              date: formatShortDate(at, data.jar.tz, locale),
            })}
          </Text>
          {moment.is_backfilled ? (
            <View style={styles.addedLater} testID="moment-added-later">
              <Text style={[textStyle('caption'), { color: colors.inkSoft }]}>{t('tile.addedLater')}</Text>
            </View>
          ) : null}
          {moment.is_private ? (
            <View accessible accessibilityLabel={t('tile.a11y.private')} testID="moment-private">
              <Icon name="lock" color="muted" size={16} strokeWidth={2} />
            </View>
          ) : null}
        </View>
        {caption ? (
          <Text style={[textStyle('momentCaption'), styles.caption]} testID="moment-caption">
            {caption}
          </Text>
        ) : null}
        <Text style={[textStyle('bodySmall', '400'), { color: colors.muted }]} testID="moment-position">
          {current < moments.length - 1
            ? t('moment.detail.positionSwipe', { position: current + 1, count: moments.length })
            : t('moment.detail.position', { position: current + 1, count: moments.length })}
        </Text>
        <View style={styles.flex} />
        <View style={styles.actions}>
          {/* TODO(M3-09, #70): the like pill toggles the viewer's like. TODO(M3-11, #72): comments open Comments. */}
          <View
            accessible
            accessibilityLabel={t('jarPage.likes', { count: moment.like_count })}
            style={[styles.stat, { backgroundColor: colors.dangerTint }]}
            testID="moment-likes"
          >
            <Icon name="heart" color="likeText" size={16} strokeWidth={2.2} />
            <Text style={[textStyle('bodyMedium', '700'), { color: colors.likeText }]}>{moment.like_count}</Text>
          </View>
          <View
            accessible
            accessibilityLabel={t('jarPage.comments', { count: data.jar.comment_count })}
            style={[styles.stat, { backgroundColor: colors.subtle }]}
            testID="moment-comments"
          >
            <Icon name="comment" color="ink" size={16} strokeWidth={2} />
            <Text style={[textStyle('bodyMedium', '600'), { color: colors.ink }]}>{data.jar.comment_count}</Text>
          </View>
          <View style={styles.flex} />
          <RoundIconButton
            icon="share"
            accessibilityLabel={t('moment.detail.share')}
            accessibilityHint={t('jarPage.shareHint')}
            onPress={onShare}
            testID="moment-share"
          />
        </View>
      </View>
    </View>
  );
}

function Page({ moment, width, tz }: { moment: JarMoment; width: number; tz: string }) {
  return (
    <View style={{ width }} testID={`moment-page-${moment.slot}`}>
      <MomentView
        uri={moment.fullUrl ?? moment.thumbUrl}
        edits={parseEdits(moment.edits)}
        width={width}
        stamp={{ capturedAt: new Date(moment.captured_at ?? moment.added_at), tz }}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.editor },
  centered: { alignItems: 'center', justifyContent: 'center' },
  message: { gap: space.md, paddingHorizontal: space.xxl, alignItems: 'center' },
  messageText: { textAlign: 'center', color: colors.surface },
  flex: { flex: 1 },
  progress: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    gap: space.xs,
  },
  bar: { flex: 1, height: sizes.momentProgress, borderRadius: radius.fillBar },
  topRow: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topSpacer: { width: sizes.roundButton },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    flexShrink: 1,
  },
  sheet: {
    flex: 1,
    marginTop: -sizes.momentSheetOverlap,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.noteSheet,
    borderTopRightRadius: radius.noteSheet,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    gap: space.sm + 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  slotChip: {
    borderRadius: radius.pill,
    paddingVertical: space.xs + 1,
    paddingHorizontal: space.md,
    backgroundColor: colors.brandTint,
  },
  when: { color: colors.muted, flexShrink: 1 },
  addedLater: {
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm,
    backgroundColor: colors.subtle,
  },
  caption: { color: colors.ink, lineHeight: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    height: sizes.momentAction,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
  },
});
