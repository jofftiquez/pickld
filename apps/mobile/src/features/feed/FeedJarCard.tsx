import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { FollowButton } from '@/features/profile/FollowButton';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { FeedMosaic } from './FeedMosaic';
import { ageOf, buildMosaic, type FeedJar } from './feedModel';

export type FeedJarCardProps = {
  jar: FeedJar;
  now: Date;
  /** The author's signed avatar; initials without it. */
  avatarUrl?: string | null;
  /** Opens the Jar page; without it the card isn't pressable. */
  onPress?: () => void;
  /** Discover (D-100): a "Be a reader" button at the bottom right of the card for an author the viewer doesn't
   * read yet. */
  onRead?: () => void;
  readDisabled?: boolean;
};

/** A followed author's jar in the Jars feed (design: Feed): header, photo mosaic, likes, comments and caption. */
export function FeedJarCard({ jar, now, avatarUrl = null, onPress, onRead, readDisabled = false }: FeedJarCardProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const age = ageOf(jar.feed_at, now);
  const updated = t(`feed.updated.${age.unit}`, { count: age.count });
  const label = t('feed.cardLabel', {
    name: jar.author_display_name,
    count: jar.visible_count,
    max: MAX_LAYERS,
    updated,
    likes: jar.like_count,
    comments: jar.comment_count,
  });
  const body = (
    <>
      {/* At large text the count pill goes under the name, which otherwise shrank to "Joff Ti…" / "Update…". */}
      <View style={large ? styles.headerStacked : styles.header}>
        <View style={[styles.who, large && styles.whoStacked]}>
          <Avatar name={jar.author_display_name} uri={avatarUrl} size="feed" decorative />
          <View style={styles.titles}>
            <Text style={[textStyle('body', '700'), { color: colors.ink }]} numberOfLines={large ? 2 : 1}>
              {jar.author_display_name}
            </Text>
            <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={large ? 2 : 1}>
              {updated}
            </Text>
          </View>
        </View>
        <View style={styles.pill}>
          <JarGraphic count={jar.visible_count} size={sizes.countJar} decorative />
          <Text style={[textStyle('label', '700'), { color: colors.brandText }]}>
            {t('feed.count', { count: jar.visible_count, max: MAX_LAYERS })}
          </Text>
        </View>
      </View>
      <FeedMosaic mosaic={buildMosaic(jar)} />
      <View style={styles.footer}>
        <View style={styles.stat}>
          <Icon name="heart" color="muted" size={16} />
          <Text style={[textStyle('bodySmall', '500'), { color: colors.muted }]}>{jar.like_count}</Text>
        </View>
        <View style={styles.stat}>
          <Icon name="comment" color="muted" size={16} />
          <Text style={[textStyle('bodySmall', '500'), { color: colors.muted }]}>{jar.comment_count}</Text>
        </View>
        {jar.last_caption ? (
          <Text style={[textStyle('label', '500'), styles.caption]} numberOfLines={1}>
            {t('feed.caption', { caption: jar.last_caption })}
          </Text>
        ) : null}
      </View>
    </>
  );
  const testID = `feed-card-${jar.author_username}`;
  // With a Be a reader button the card is a plain box: the pressable part and the button stay separate, so
  // screen readers reach both.
  const read = onRead !== undefined;
  const content = onPress ? (
    <Pressable
      testID={read ? `${testID}-open` : testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={read ? styles.body : styles.card}
    >
      {body}
    </Pressable>
  ) : (
    <View
      testID={read ? `${testID}-open` : testID}
      accessible
      accessibilityLabel={label}
      style={read ? styles.body : styles.card}
    >
      {body}
    </View>
  );
  if (onRead === undefined) return content;
  return (
    <View testID={testID} style={styles.card}>
      {content}
      <View style={styles.read}>
        <FollowButton
          action="read"
          name={jar.author_display_name}
          onPress={onRead}
          disabled={readDisabled}
          testID={`${testID}-read`}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingTop: 2,
    paddingHorizontal: space.xs,
  },
  headerStacked: { alignItems: 'flex-start', gap: space.sm, paddingTop: 2, paddingHorizontal: space.xs },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  whoStacked: { flex: 0, alignSelf: 'stretch', alignItems: 'flex-start' },
  titles: { flex: 1, gap: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.xs + 2,
    paddingRight: space.sm + 2,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    paddingHorizontal: space.xs,
    paddingBottom: 2,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  body: { gap: space.sm + 2 },
  // A row, so the button (which aligns itself to the start) sits at the right end.
  read: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.xs },
  caption: { flex: 1, textAlign: 'right', color: colors.muted },
});
