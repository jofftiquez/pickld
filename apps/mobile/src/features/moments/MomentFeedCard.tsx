import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { VisibilityBadge } from '@/components/VisibilityBadge';
import { parseEdits } from '@/features/edit/edits';
import { CommentsButton } from '@/features/jar/CommentsButton';
import { LikeButton } from '@/features/jar/LikeButton';
import { MomentView } from '@/features/moment/MomentView';
import { FollowButton } from '@/features/profile/FollowButton';
import { deviceLocale, formatShortDate, formatTime } from '@/lib/format';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { cardPhotoUrl, type FeedMoment } from './momentsModel';

export type MomentFeedCardProps = {
  moment: FeedMoment;
  /** The photo's width in points; its height is 4:3 of it. */
  photoWidth: number;
  /** The viewer, so their own Only me moments get the lock (D-53). */
  viewerId: string | null;
  /** The author's signed avatar; initials without it. */
  avatarUrl?: string | null;
  /** Go to jar (D-94); only offered when the viewer may open the jar, and not beside Be a reader. */
  onOpenJar: () => void;
  onToggleLike: () => void;
  /** The moment's thread: the header, photo and caption open it, like the comment pill (D-94). */
  onOpenComments: () => void;
  /** Discover (D-100): a "Be a reader" button in the header, in Go to jar's place, for an author the viewer
   * doesn't read yet. */
  onRead?: () => void;
  readDisabled?: boolean;
  locale?: string;
};

/**
 * One moment in the Moments timeline (design: MomentsFeed): author, #slot and time, Go to jar, the 3:4 photo
 * with its edits, the caption, then likes and comments. The header, photo and caption open the moment's
 * thread, as the comment pill does (D-94); Go to jar opens its jar. Screen readers get the header (which
 * reads the caption too), Go to jar, and the like and comment pills.
 */
export function MomentFeedCard({
  moment,
  photoWidth,
  viewerId,
  avatarUrl = null,
  onOpenJar,
  onToggleLike,
  onOpenComments,
  onRead,
  readDisabled = false,
  locale = deviceLocale(),
}: MomentFeedCardProps) {
  const { t } = useTranslation();
  const at = new Date(moment.captured_at ?? moment.added_at);
  const slot = t(`slots.${moment.slot}`);
  const when = t('moment.detail.when', {
    time: formatTime(at, moment.jar_tz, locale),
    // No-break spaces: when the line wraps beside Be a reader, the date moves down whole.
    date: formatShortDate(at, moment.jar_tz, locale).replace(/ /g, '\u00a0'),
  });
  const caption = moment.caption?.trim() ? moment.caption.trim() : null;
  // At large text the name and the button no longer fit side by side (the name shrank to "J."): stack them.
  const large = useLargeText();
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
      <View style={large ? styles.headerStacked : styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('moments.openHint')}
          onPress={onOpenComments}
          style={[styles.author, large && styles.authorStacked]}
          testID={`moments-open-${moment.moment_id}`}
        >
          <Avatar name={moment.author_display_name} uri={avatarUrl} size="feed" decorative />
          <View style={styles.titles}>
            <Text style={[textStyle('body', '700'), { color: colors.ink }]} numberOfLines={large ? 2 : 1}>
              {moment.author_display_name}
            </Text>
            <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={large ? 3 : 2}>
              {t('moments.meta', { slot, when })}
            </Text>
          </View>
        </Pressable>
        {onRead ? (
          // Discover (D-100) lists only people the viewer doesn't read: "Be a reader" takes Go to jar's place
          // in the header (design: Explore); the photo, caption and comment pill still open the thread.
          <FollowButton
            action="read"
            name={moment.author_display_name}
            onPress={onRead}
            disabled={readDisabled}
            testID={`moments-read-${moment.moment_id}`}
          />
        ) : moment.jar_visible ? (
          // A jar the viewer can't open yet (not published, D-48) would only say "not available".
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('moments.goToJarLabel', { name: moment.author_display_name })}
            onPress={onOpenJar}
            style={({ pressed }) => [styles.goToJar, pressed ? { opacity: PRESSED_OPACITY } : null]}
            testID={`moments-jar-${moment.moment_id}`}
          >
            <Text style={[textStyle('label', '700'), { color: colors.brandLink }]}>{t('moments.goToJar')}</Text>
          </Pressable>
        ) : null}
      </View>
      {/* The header above already reads all of this to screen readers. */}
      <Pressable
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        onPress={onOpenComments}
        style={styles.open}
        testID={`moments-photo-${moment.moment_id}`}
      >
        <View style={[styles.photo, { width: photoWidth }]}>
          <MomentView
            uri={cardPhotoUrl(moment)}
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
    gap: space.sm,
    paddingTop: 2,
    paddingLeft: space.xs,
  },
  // Large text: the author row on top at full width, Be a reader or Go to jar under it.
  headerStacked: { alignItems: 'flex-start', gap: space.sm, paddingTop: 2, paddingLeft: space.xs },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  authorStacked: { flex: 0, alignSelf: 'stretch', alignItems: 'flex-start' },
  // A 44-point target (AGENTS rule 11) without growing the header around the avatar.
  goToJar: {
    minWidth: sizes.minTap,
    minHeight: sizes.minTap,
    marginVertical: -space.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xs,
  },
  titles: { flex: 1, gap: 1 },
  photo: { borderRadius: radius.mosaicLarge, overflow: 'hidden' },
  badge: { position: 'absolute', top: space.sm, right: space.sm },
  caption: { color: colors.ink, paddingHorizontal: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
