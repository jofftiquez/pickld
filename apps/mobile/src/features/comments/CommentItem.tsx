import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ageOf } from '@/features/feed/feedModel';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import type { ThreadComment } from './commentsModel';

export type CommentItemProps = {
  comment: ThreadComment;
  isReply?: boolean;
  now: Date;
  /** Shown when the comment can take replies. */
  onReply?: () => void;
  /** Shown to the comment's author and the jar owner. */
  onDelete?: () => void;
  /** Someone else's comment: opens Report. */
  onReport?: () => void;
};

/** Text actions (Reply, Delete, Report) are 12 pt labels 4 pt above and below (Comments); hitSlop brings them to 44. */
const ACTION_HEIGHT = 24;

/** One comment or reply in the thread (Comments): avatar, name and age, text, Reply, Delete and Report. */
export function CommentItem({ comment, isReply = false, now, onReply, onDelete, onReport }: CommentItemProps) {
  const { t } = useTranslation();
  const name = comment.author?.display_name ?? t('comments.someone');
  const age = ageOf(comment.created_at, now);
  const when = comment.pending ? t('comments.checking') : t(`comments.age.${age.unit}`, { count: age.count });
  return (
    <View style={[styles.row, isReply ? styles.reply : null]} testID={`comment-${comment.id}`}>
      <Avatar name={name} uri={null} size={isReply ? 'sm' : 'feed'} decorative />
      <View style={styles.body}>
        <Text style={[textStyle('bodySmall', '400'), { color: colors.ink }]}>
          <Text style={textStyle('bodySmall', '700')}>{name}</Text>
          <Text style={{ color: colors.muted }}>{t('comments.meta', { when })}</Text>
        </Text>
        <Text style={[textStyle('bodyMedium', '400'), styles.text]} testID={`comment-${comment.id}-body`}>
          {comment.body}
        </Text>
        {onReply || onDelete || onReport ? (
          <View style={styles.actions}>
            {onReply ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments.replyTo', { name })}
                hitSlop={hitSlopFor(undefined, ACTION_HEIGHT)}
                onPress={onReply}
                style={styles.action}
                testID={`comment-${comment.id}-reply`}
              >
                <Text style={[textStyle('label', '700'), { color: colors.muted }]}>{t('comments.reply')}</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments.deleteLabel', { name })}
                hitSlop={hitSlopFor(undefined, ACTION_HEIGHT)}
                onPress={onDelete}
                style={styles.action}
                testID={`comment-${comment.id}-delete`}
              >
                <Text style={[textStyle('label', '700'), { color: colors.muted }]}>{t('comments.delete')}</Text>
              </Pressable>
            ) : null}
            {onReport ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments.reportLabel', { name })}
                hitSlop={hitSlopFor(undefined, ACTION_HEIGHT)}
                onPress={onReport}
                style={styles.action}
                testID={`comment-${comment.id}-report`}
              >
                <Text style={[textStyle('label', '700'), { color: colors.muted }]}>{t('comments.report')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm + 2, paddingVertical: space.sm + 2 },
  // Replies start under the parent's text: its avatar plus the gap (Comments).
  reply: { marginLeft: sizes.feedAvatar + space.sm },
  body: { flex: 1, gap: 3 },
  text: { color: colors.ink, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs },
  action: { minHeight: ACTION_HEIGHT, justifyContent: 'center' },
});
