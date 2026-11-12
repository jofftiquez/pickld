import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { DISABLED_OPACITY } from '@/components/BaseButton';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { CommentItem } from './CommentItem';
import { COMMENT_MAX, COUNTER_FROM, sendable, type ThreadComment, type ThreadEntry } from './commentsModel';

export type CommentsViewProps = {
  /** "Dale’s Sunday"; null while the jar loads. */
  jarTitle: string | null;
  /** The jar's visible comment count, for the header. */
  count: number | null;
  /** Undefined while loading. */
  thread: ThreadEntry[] | undefined;
  /** Loading failed and nothing is cached. */
  failed: boolean;
  /** The jar isn't available to this viewer. */
  unavailable: boolean;
  /** The viewer's name, for the avatar beside the input. */
  myName: string | null;
  now: Date;
  insets: EdgeInsets;
  isSending: boolean;
  sendFailed: boolean;
  onBack: () => void;
  onRetry: () => void;
  /** Resolves true once saved; the input is cleared then. */
  onSend: (body: string, parentId: string | null) => Promise<boolean>;
  onDelete: (commentId: string) => void;
  /** Reports someone else's comment (M3-21). */
  onReport?: (comment: ThreadComment) => void;
};

/** The thread for one jar (Comments; FR-SOC-06): comments with one level of replies and the input bar. */
export function CommentsView({
  jarTitle,
  count,
  thread,
  failed,
  unavailable,
  myName,
  now,
  insets,
  isSending,
  sendFailed,
  onBack,
  onRetry,
  onSend,
  onDelete,
  onReport,
}: CommentsViewProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [deleting, setDeleting] = useState<ThreadComment | null>(null);
  const body = sendable(draft);
  const left = COMMENT_MAX - draft.length;

  const send = async () => {
    if (body === null || isSending) return;
    if (await onSend(body, replyTo?.id ?? null)) {
      setDraft('');
      setReplyTo(null);
    }
  };
  const item = (c: ThreadComment, isReply: boolean) => (
    <CommentItem
      key={c.id}
      comment={c}
      isReply={isReply}
      now={now}
      onReply={c.canReply ? () => setReplyTo(c) : undefined}
      onDelete={c.canDelete ? () => setDeleting(c) : undefined}
      onReport={c.canReport && onReport && !c.pending ? () => onReport(c) : undefined}
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="comments"
    >
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('comments.back')} onPress={onBack} testID="comments-back" />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[textStyle('cropTitle'), { color: colors.ink }]}>
            {t('comments.title')}
          </Text>
          {jarTitle !== null ? (
            <Text
              style={[textStyle('label', '500'), { color: colors.muted }]}
              numberOfLines={1}
              testID="comments-subtitle"
            >
              {t('comments.subtitle', { title: jarTitle, count: count ?? 0 })}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {unavailable ? (
        <View style={styles.message}>
          <Text style={[textStyle('body'), styles.center, { color: colors.muted }]} testID="comments-unavailable">
            {t('jarPage.unavailableTitle')}
          </Text>
        </View>
      ) : failed ? (
        <View style={styles.message}>
          <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('comments.failed')}</Text>
          <SecondaryButton label={t('jarPage.retry')} onPress={onRetry} testID="comments-retry" />
        </View>
      ) : thread === undefined ? (
        <View style={styles.message}>
          <ActivityIndicator color={colors.muted} accessibilityLabel={t('comments.loading')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {thread.length === 0 ? (
            <Text style={[textStyle('body'), styles.center, styles.empty]} testID="comments-empty">
              {t('comments.empty')}
            </Text>
          ) : (
            <View style={styles.card} testID="comments-card">
              {thread.map((c) => [item(c, false), ...c.replies.map((r) => item(r, true))])}
            </View>
          )}
        </ScrollView>
      )}

      {!unavailable ? (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          {replyTo ? (
            <View style={styles.replying} testID="comments-replying">
              <Text style={[textStyle('label', '500'), styles.replyingText]} numberOfLines={1}>
                {t('comments.replying', { name: replyTo.author?.display_name ?? t('comments.someone') })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('comments.cancelReply')}
                hitSlop={hitSlopFor(sizes.lockBadge, sizes.lockBadge)}
                onPress={() => setReplyTo(null)}
                testID="comments-cancel-reply"
              >
                <Icon name="close" color="muted" size={16} strokeWidth={2} />
              </Pressable>
            </View>
          ) : null}
          {sendFailed ? (
            <Text style={[textStyle('label', '500'), { color: colors.danger }]} testID="comments-send-failed">
              {t('comments.sendFailed')}
            </Text>
          ) : null}
          <View style={styles.inputRow}>
            <Avatar name={myName ?? ''} uri={null} size="feed" decorative />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={replyTo ? t('comments.replyPlaceholder') : t('comments.placeholder')}
              placeholderTextColor={colors.muted}
              accessibilityLabel={replyTo ? t('comments.replyPlaceholder') : t('comments.placeholder')}
              maxLength={COMMENT_MAX}
              multiline
              style={[textStyle('bodyMedium', '400'), styles.input]}
              testID="comments-input"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('comments.send')}
              accessibilityState={{ disabled: body === null || isSending }}
              disabled={body === null || isSending}
              onPress={() => void send()}
              style={[styles.send, body === null || isSending ? styles.sendDisabled : null]}
              testID="comments-send"
            >
              {isSending ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Icon name="send" color="surface" size={18} strokeWidth={2} />
              )}
            </Pressable>
          </View>
          {left <= COUNTER_FROM ? (
            <Text style={[textStyle('caption', '500'), styles.counter]} testID="comments-counter">
              {t('comments.left', { count: left })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Dialog
        visible={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('comments.deleteTitle')}
        message={t('comments.deleteBody')}
        testID="comments-delete-dialog"
      >
        <DangerButton
          label={t('comments.delete')}
          onPress={() => {
            if (deleting) onDelete(deleting.id);
            setDeleting(null);
          }}
          testID="comments-delete-confirm"
        />
      </Dialog>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.xxl,
    paddingBottom: space.md,
    paddingHorizontal: space.lg,
  },
  titles: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: sizes.roundButton },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xxl },
  center: { textAlign: 'center' },
  list: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  empty: { color: colors.muted, marginTop: space.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: space.xs,
    paddingHorizontal: space.md + 2,
    ...shadow.card,
  },
  inputBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: space.sm + 2,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  replying: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  replyingText: { flex: 1, color: colors.muted },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm + 2 },
  input: {
    flex: 1,
    minHeight: sizes.minTap,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.background,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    color: colors.ink,
  },
  send: {
    width: sizes.roundButton,
    height: sizes.roundButton,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: DISABLED_OPACITY },
  counter: { alignSelf: 'flex-end', color: colors.muted },
});
