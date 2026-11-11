import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { JarGraphic, MAX_LAYERS } from '@/components/JarGraphic';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { FeedMosaic } from './FeedMosaic';
import { ageOf, buildMosaic, type FeedJar } from './feedModel';

export type FeedJarCardProps = {
  jar: FeedJar;
  now: Date;
  /** Opens the Jar page; without it the card isn't pressable. */
  onPress?: () => void;
};

/** A followed author's jar in the Jars feed (design: Feed): header, photo mosaic, likes, comments and caption. */
export function FeedJarCard({ jar, now, onPress }: FeedJarCardProps) {
  const { t } = useTranslation();
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
      <View style={styles.header}>
        <Avatar name={jar.author_display_name} uri={null} size="feed" decorative />
        <View style={styles.titles}>
          <Text style={[textStyle('body', '700'), { color: colors.ink }]} numberOfLines={1}>
            {jar.author_display_name}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
            {updated}
          </Text>
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
  return onPress ? (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.card}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} accessible accessibilityLabel={label} style={styles.card}>
      {body}
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
  caption: { flex: 1, textAlign: 'right', color: colors.muted },
});
