import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { VisibilityBadge } from '@/components/VisibilityBadge';
import { parseEdits } from '@/features/edit/edits';
import { CommentsButton } from '@/features/jar/CommentsButton';
import { LikeButton } from '@/features/jar/LikeButton';
import { MomentView } from '@/features/moment/MomentView';
import { deviceLocale, formatShortDate, formatTime } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import type { FeedMoment } from './momentsModel';

export type MomentFeedCardProps = {
  moment: FeedMoment;
  /** The photo's width in points; its height is 4:3 of it. */
  photoWidth: number;
  /** The viewer, so their own Only me moments get the lock (D-53). */
  viewerId: string | null;
  onOpen: () => void;
  onToggleLike: () => void;
  onOpenComments: () => void;
  locale?: string;
};

/**
 * One moment in the Moments timeline (design: MomentsFeed): author, #slot and time, the 3:4 photo with its
 * edits, the caption, then likes and comments. The top part opens Moment detail; the like and comment
 * pills are their own buttons beside it, so screen readers reach all three.
 */
export function MomentFeedCard({
  moment,
  photoWidth,
  viewerId,
  onOpen,
  onToggleLike,
  onOpenComments,
  locale = deviceLocale(),
}: MomentFeedCardProps) {
  const { t } = useTranslation();
  const at = new Date(moment.captured_at ?? moment.added_at);
  const slot = t(`slots.${moment.slot}`);
  const when = t('moment.detail.when', {
    time: formatTime(at, moment.jar_tz, locale),
    date: formatShortDate(at, moment.jar_tz, locale),
  });
  const caption = moment.caption?.trim() ? moment.caption.trim() : null;
  // Only the owner ever gets an Only me moment here (0067); the check keeps it that way for a stale cache.
  const isPrivate = moment.visibility === 'only_me' && moment.author_id === viewerId;
  const label = [
    t('moments.cardLabel', { name: moment.author_display_name, slot, when }),
    isPrivate ? t('moments.private') : null,
    caption,
  ]
    .filter((part): part is string => part !== null)
    .join('. ');

  return (
    <View style={styles.card} testID={`moments-card-${moment.moment_id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('moments.openHint')}
        onPress={onOpen}
        style={styles.open}
        testID={`moments-open-${moment.moment_id}`}
      >
        <View style={styles.header}>
          <Avatar name={moment.author_display_name} uri={null} size="feed" decorative />
          <View style={styles.titles}>
            <Text style={[textStyle('body', '700'), { color: colors.ink }]} numberOfLines={1}>
              {moment.author_display_name}
            </Text>
            <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={2}>
              {t('moments.meta', { slot, when })}
            </Text>
          </View>
        </View>
        <View style={[styles.photo, { width: photoWidth }]}>
          <MomentView
            uri={moment.fullUrl ?? moment.thumbUrl}
            edits={parseEdits(moment.edits)}
            width={photoWidth}
            stamp={{ capturedAt: at, tz: moment.jar_tz }}
            accessible={false}
          />
          {isPrivate ? (
            <View style={styles.badge} pointerEvents="none">
              <VisibilityBadge visibility="only_me" testID="moments-private" />
            </View>
          ) : null}
        </View>
        {caption ? (
          <Text style={[textStyle('body', '600'), styles.caption]} testID="moments-caption">
            {caption}
          </Text>
        ) : null}
      </Pressable>
      <View style={styles.actions}>
        <LikeButton
          count={moment.like_count}
          liked={moment.liked}
          height={sizes.momentAction}
          onPress={onToggleLike}
          testID={`moments-like-${moment.moment_id}`}
        />
        <CommentsButton
          count={moment.comment_count}
          height={sizes.momentAction}
          onPress={onOpenComments}
          testID={`moments-comments-${moment.moment_id}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.md,
    gap: space.sm + 2,
    ...shadow.card,
  },
  open: { gap: space.sm + 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingTop: 2,
    paddingHorizontal: space.xs,
  },
  titles: { flex: 1, gap: 1 },
  photo: { borderRadius: radius.mosaicLarge, overflow: 'hidden' },
  badge: { position: 'absolute', top: space.sm, right: space.sm },
  caption: { color: colors.ink, paddingHorizontal: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
