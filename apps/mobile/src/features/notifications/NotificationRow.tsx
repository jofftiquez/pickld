import { Image } from 'expo-image';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { formatWeekday } from '@/lib/format';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space } from '@/theme/tokens';

import { FollowButton } from '../profile/FollowButton';
import type { NotificationEntry } from './notificationsModel';

export type NotificationRowProps = {
  entry: NotificationEntry;
  /** Short age, already formatted ("12m", "Sun"). */
  age: string;
  avatarUrl: string | null;
  thumbUrl: string | null;
  /** New reader or friend joined, and the viewer doesn't read them yet: Read back / Read. */
  follow: 'read' | 'readBack' | null;
  divider: boolean;
  onOpen: (() => void) | null;
  onFollow: () => void;
  locale: string;
};

type SentenceKey =
  | 'notifications.newReader'
  | 'notifications.friendJoined'
  | 'notifications.like'
  | 'notifications.likeTwo'
  | 'notifications.comment'
  | 'notifications.commentPlain'
  | 'notifications.reply'
  | 'notifications.replyPlain'
  | 'notifications.fullJar'
  | 'notifications.fullJarPlain'
  | 'notifications.removed'
  | 'notifications.appealDecided';

/** The sentence for an entry, with <bold> parts, as a translation key and its values. */
function sentence(
  entry: NotificationEntry,
  t: (k: string, o?: Record<string, unknown>) => string,
  locale: string,
): { key: SentenceKey; values: Record<string, string | number> } {
  const name = entry.actors[0]?.display_name ?? t('notifications.someone');
  const weekday = entry.jarDate ? formatWeekday(entry.jarDate, locale) : null;
  switch (entry.type) {
    case 'new_reader':
      return { key: 'notifications.newReader', values: { name } };
    case 'friend_joined':
      return { key: 'notifications.friendJoined', values: { name } };
    case 'like': {
      const what = entry.momentId
        ? t('notifications.yourMoment')
        : weekday
          ? t('notifications.yourJar', { weekday })
          : t('notifications.yourJarPlain');
      const others = entry.ids.length - 1;
      if (others === 1 && entry.actors[1]) {
        return { key: 'notifications.likeTwo', values: { name, other: entry.actors[1].display_name, what } };
      }
      return { key: 'notifications.like', values: { name, what, count: others } };
    }
    case 'comment':
    case 'reply': {
      const comment = entry.type === 'comment';
      if (entry.commentBody) {
        return {
          key: comment ? 'notifications.comment' : 'notifications.reply',
          values: { name, body: entry.commentBody },
        };
      }
      return { key: comment ? 'notifications.commentPlain' : 'notifications.replyPlain', values: { name } };
    }
    case 'full_jar':
      return weekday
        ? { key: 'notifications.fullJar', values: { weekday, count: slots.length, max: slots.length } }
        : { key: 'notifications.fullJarPlain', values: { count: slots.length, max: slots.length } };
    case 'removed':
      return { key: 'notifications.removed', values: {} };
    case 'appeal_decided':
      return { key: 'notifications.appealDecided', values: {} };
  }
}

/** One Notifications row (Notifications): avatar or icon, the sentence and its age, then a thumbnail or a
 * Read / Read back button. The whole row opens the related screen. */
export function NotificationRow({
  entry,
  age,
  avatarUrl,
  thumbUrl,
  follow,
  divider,
  onOpen,
  onFollow,
  locale,
}: NotificationRowProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const large = useLargeText();
  const { key, values } = sentence(entry, t as unknown as (k: string, o?: Record<string, unknown>) => string, locale);
  // Plain text for screen readers: the same sentence without the <bold> tags.
  const spoken = t(key, values).replace(/<\/?bold>/g, '');
  const actor = entry.actors[0];
  const icon =
    entry.type === 'full_jar' ? 'jars' : entry.type === 'removed' || entry.type === 'appeal_decided' ? 'warning' : null;

  return (
    <View
      style={[styles.row, large && styles.rowWrap, divider ? styles.divider : null]}
      testID={`notification-${entry.type}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.unread ? `${t('notifications.unread')}, ` : ''}${spoken}, ${age}`}
        accessibilityHint={onOpen ? t('notifications.openHint') : undefined}
        disabled={onOpen === null}
        onPress={onOpen ?? undefined}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.main, large && styles.mainLarge, pressed ? { opacity: PRESSED_OPACITY } : null]}
        testID={`notification-${entry.key}`}
      >
        {icon ? (
          <View style={styles.iconWell}>
            <Icon name={icon} color="brandText" size={20} />
          </View>
        ) : (
          <Avatar name={actor?.display_name ?? ''} uri={avatarUrl} size="notify" decorative />
        )}
        <View style={styles.text}>
          <Text style={[textStyle('bodyMedium'), styles.sentence]}>
            <Trans
              t={t}
              i18nKey={key}
              values={values}
              components={{ bold: <Text style={textStyle('bodyMedium', '700')} /> }}
            />
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{age}</Text>
        </View>
        {follow === null && thumbUrl !== null ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} contentFit="cover" accessible={false} />
        ) : null}
      </Pressable>
      {follow !== null && actor ? (
        <FollowButton action={follow} name={actor.display_name} onPress={onFollow} testID="notification-follow" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 3 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  // Large text: Read back or the photo wraps below, so the sentence keeps the row's width.
  rowWrap: { flexWrap: 'wrap', rowGap: space.sm },
  mainLarge: { flexBasis: '100%' },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sizes.minTap },
  text: { flex: 1, gap: 2 },
  sentence: { color: colors.ink, lineHeight: 19 },
  iconWell: {
    width: sizes.notifyAvatar,
    height: sizes.notifyAvatar,
    borderRadius: radius.notifyIcon,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: sizes.notifyAvatar,
    height: sizes.notifyThumbHeight,
    borderRadius: radius.thumb,
    backgroundColor: colors.photoPlaceholder,
  },
});
