import { useRef, useState } from 'react';
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
  useWindowDimensions,
  type ScrollViewInstance,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { DISABLED_OPACITY } from '@/components/BaseButton';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import type { Edits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import { MomentView } from '@/features/moment/MomentView';
import type { AvatarUrls } from '@/lib/avatars';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

import { CommentItem } from './CommentItem';
import { COMMENT_MAX, COUNTER_FROM, sendable, type ThreadComment, type ThreadEntry } from './commentsModel';

/** The moment a moment thread is about (0068; D-51), drawn whole above its comments (D-84). */
export type CommentsMoment = {
  /** The full photo (or the thumbnail if that's all that was signed); null shows the placeholder. */
  uri: string | null;
  /** Parsed with `parseEdits`, as on Moment detail. */
  edits: Edits;
  /** What its auto stamps show; null shows their art. */
  stamp: StampMoment | null;
  /** "#morning" */
  slot: string;
  /** The moment's owner. */
  authorName: string;
  /** Their signed avatar; initials without it. */
  authorAvatarUrl?: string | null;
  caption: string | null;
};

export type CommentsViewProps = {
  /** "Dale’s Sunday" (the jar thread) or "Dale’s #morning" (a moment thread); null while it loads. */
  jarTitle: string | null;
  /** The thread's visible comment count, for the header. */
  count: number | null;
  /** A moment thread's moment; absent for the jar thread. */
  moment?: CommentsMoment | null;
  /** Undefined while loading. */
  thread: ThreadEntry[] | undefined;
  /** Loading failed and nothing is cached. */
  failed: boolean;
  /** The jar isn't available to this viewer. */
  unavailable: boolean;
  /** The viewer's name, for the avatar beside the input. */
  myName: string | null;
  /** The viewer's signed avatar, beside the input. */
  myAvatarUrl?: string | null;
  /** Signed avatars of the commenters by profile id; initials for anyone missing. */
  avatars?: AvatarUrls;
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

/**
 * One thread (Comments; FR-SOC-06): a jar's own, or one moment's (D-51), which opens with the whole moment
 * at 3:4 inside the screen's side margins with rounded corners (D-95), drawn by Moment detail's `MomentView`,
 * then its author and caption, scrolling away with the comments (D-84). Comments with one level of replies and the input bar pinned above the keyboard.
 */
export function CommentsView({
  jarTitle,
  count,
  moment,
  thread,
  failed,
  unavailable,
  myName,
  myAvatarUrl = null,
  avatars = {},
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
  const { width } = useWindowDimensions();
  // Inside the side margins the text and comments use; MomentView scales the 3:4 photo to this width (D-95).
  const photoWidth = Math.max(0, width - 2 * space.xl);
  const reduceMotion = useReducedMotion();
  const list = useRef<ScrollViewInstance>(null);
  const focused = useRef(false);
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
      avatarUrl={avatars[c.user_id] ?? null}
      isReply={isReply}
      now={now}
      onReply={c.canReply ? () => setReplyTo(c) : undefined}
      onDelete={c.canDelete ? () => setDeleting(c) : undefined}
      onReport={c.canReport && onReport && !c.pending ? () => onReport(c) : undefined}
    />
  );

  const threadBody = (entries: ThreadEntry[]) =>
    entries.length === 0 ? (
      <Text style={[textStyle('body'), styles.center, styles.empty]} testID="comments-empty">
        {t('comments.empty')}
      </Text>
    ) : (
      <View style={styles.card} testID="comments-card">
        {entries.map((c) => [item(c, false), ...c.replies.map((r) => item(r, true))])}
      </View>
    );
  const keepEnd = () => {
    if (focused.current) list.current?.scrollToEnd({ animated: !reduceMotion });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="comments"
    >
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('comments.back')} onPress={onBack} testID="comments-back" />
        <View style={styles.titles}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="header"
            style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
          >
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

      {moment && !unavailable ? (
        // A moment thread: the moment is the top of the list and scrolls away with the comments. While
        // the composer is focused the list keeps its end in view, so the keyboard (which shrinks the list)
        // and a new comment never hide the newest comments under the tall header.
        <ScrollView
          ref={list}
          contentContainerStyle={styles.momentList}
          keyboardShouldPersistTaps="handled"
          onLayout={keepEnd}
          onContentSizeChange={keepEnd}
          testID="comments-list"
        >
          <View testID="comments-moment">
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={t('moment.photo', { slot: moment.slot })}
              style={styles.momentPhoto}
              testID="comments-moment-photo"
            >
              <MomentView
                uri={moment.uri}
                edits={moment.edits}
                width={photoWidth}
                stamp={moment.stamp}
                accessible={false}
                testID="comments-moment-view"
              />
            </View>
            <View style={styles.momentText}>
              <View style={styles.momentAuthor}>
                <Avatar name={moment.authorName} uri={moment.authorAvatarUrl ?? null} size="sm" decorative />
                <Text style={[textStyle('bodySmall', '700'), styles.authorName]} testID="comments-moment-author">
                  {moment.authorName}
                </Text>
                <View style={styles.slotChip}>
                  <Text style={[textStyle('bodySmall', '700'), { color: colors.brandText }]}>{moment.slot}</Text>
                </View>
              </View>
              {moment.caption ? (
                <Text style={[textStyle('momentCaption'), styles.caption]} testID="comments-moment-caption">
                  {moment.caption}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={styles.momentComments}>
            {failed ? (
              <View style={styles.inlineMessage}>
                <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('comments.failed')}</Text>
                <SecondaryButton label={t('jarPage.retry')} onPress={onRetry} testID="comments-retry" />
              </View>
            ) : thread === undefined ? (
              <View style={styles.inlineMessage}>
                <ActivityIndicator color={colors.muted} accessibilityLabel={t('comments.loading')} />
              </View>
            ) : (
              threadBody(thread)
            )}
          </View>
        </ScrollView>
      ) : unavailable ? (
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
          {threadBody(thread)}
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
            <Avatar name={myName ?? ''} uri={myAvatarUrl} size="feed" decorative />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onFocus={() => {
                focused.current = true;
                keepEnd();
              }}
              onBlur={() => {
                focused.current = false;
              }}
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
  // Shrinks to fit one line at large text instead of pushing the header's buttons off screen (D-37).
  headerTitle: { flexShrink: 1 },
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
  // A moment thread's list: the moment, its text and the comments share the side margins (D-95).
  momentList: { paddingBottom: space.lg },
  momentPhoto: { marginHorizontal: space.xl, borderRadius: radius.tile, overflow: 'hidden' },
  momentText: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md, gap: space.sm + 2 },
  momentAuthor: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  authorName: { color: colors.ink, flexShrink: 1 },
  slotChip: {
    borderRadius: radius.pill,
    paddingVertical: space.xs + 1,
    paddingHorizontal: space.md,
    backgroundColor: colors.brandTint,
  },
  caption: { color: colors.ink },
  momentComments: { paddingHorizontal: space.xl },
  inlineMessage: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
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
