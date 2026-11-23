import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
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
import { GlassSurface } from '@/components/GlassSurface';
import { Icon } from '@/components/Icon';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { parseEdits } from '@/features/edit/edits';
import { mentionAspect } from '@/features/edit/mention/mentionLayout';
import { toPixels } from '@/features/edit/overlays/transform';
import { buildJarPage, isLiked, type JarMoment, type JarPageData, type LikeTarget } from '@/features/jar/jarPage';
import { CommentsButton } from '@/features/jar/CommentsButton';
import { LikeButton } from '@/features/jar/LikeButton';
import { firstName } from '@/features/jar/shareJar';
import { onCard } from '@/features/share/shareCard';
import { deviceLocale, formatShortDate, formatTime } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space } from '@/theme/tokens';

import { describedLabel } from './momentRender';
import { captionParts, type MomentTag } from './momentTags';
import type { TogetherAction, TogetherRow } from './momentTogether';
import { MomentView } from './MomentView';

export type MomentDetailViewProps = {
  /** The moment's jar, read as the viewer (useJarPage). Undefined while loading; null when not available. */
  data: JarPageData | null | undefined;
  /** The request failed and nothing is cached. */
  failed?: boolean;
  /** The moment to open on. */
  momentId: string;
  /** The author's signed avatar; initials without it. */
  authorAvatarUrl?: string | null;
  insets: EdgeInsets;
  onClose: () => void;
  /** Opens the comments of the moment on screen: its own thread (D-51). */
  onOpenComments?: (momentId: string) => void;
  /** Likes or unlikes the moment on screen (FR-SOC-05). */
  onToggleLike?: (target: LikeTarget) => void;
  /** Opens Share for the moment on screen (only offered to its owner, for a live, non-private moment; D-83). */
  onShare: (momentId: string) => void;
  /** More options on someone else's moment: Report (M3-21). Not shown to the owner. */
  onMore?: (momentId: string) => void;
  onRetry: () => void;
  /** Tags the viewer may see, by moment id (0172): they link to profiles. */
  tags?: Record<string, MomentTag[]>;
  /** Opens a tagged person's profile. */
  onOpenProfile?: (username: string) => void;
  /** The viewer, tagged on the moment on screen, takes their tag off. */
  onRemoveTag?: (momentId: string) => void;
  removingTag?: boolean;
  /** Together rows the viewer may see, by moment id (0174): their own as the tagged person, all as author. */
  together?: Record<string, TogetherRow[]>;
  /** Asks, answers or takes a Together moment off. */
  onTogether?: (action: TogetherAction) => void;
  togetherBusy?: boolean;
  /** The last Together action failed. */
  togetherFailed?: boolean;
  locale?: string;
};

/**
 * One moment full screen (Moment detail; FR-SOC-04): the 3:4 photo with its edits under one progress bar
 * per shown moment, swiped left and right through the jar's shown moments only (the same list as the Jar page, so
 * private and unchecked moments are never reachable by others), and a sheet with the #slot, time, caption,
 * likes, comments and share.
 */
export function MomentDetailView({
  data,
  failed = false,
  momentId,
  authorAvatarUrl = null,
  insets,
  onClose,
  onOpenComments,
  onMore,
  onToggleLike,
  onShare,
  onRetry,
  tags = {},
  onOpenProfile,
  onRemoveTag,
  removingTag = false,
  together = {},
  onTogether,
  togetherBusy = false,
  togetherFailed = false,
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
  const momentTags = tags[moment.id] ?? [];
  const viewerTagged = momentTags.some((tag) => tag.userId === data.viewerId);
  const isAuthor = data.jar.user_id === data.viewerId;
  const togetherRows = together[moment.id] ?? [];
  const myTogether = togetherRows.find((r) => r.user_id === data.viewerId);
  const authorName = firstName(data.author.display_name);
  // As author: requests and approvals, each with the tagged person's username (the author sees every tag).
  const authorTogether = isAuthor
    ? togetherRows.flatMap((r) => {
        const tag = momentTags.find((x) => x.userId === r.user_id);
        return tag && r.status !== 'declined' ? [{ row: r, username: tag.username }] : [];
      })
    : [];

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
      {/* The photo runs full-bleed under the status bar (Moment); the bars and buttons sit below the inset. */}
      <View style={{ height: photoHeight }}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={describedLabel(
            t('moment.detail.photo', { slot, position: current + 1, count: moments.length }),
            parseEdits(moment.edits),
            t,
          )}
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
            renderItem={({ item }) => (
              <Page
                moment={item}
                width={width}
                tz={data.jar.tz}
                tags={tags[item.id] ?? []}
                onOpenProfile={onOpenProfile}
              />
            )}
            testID="moment-pager"
          />
        </View>
        {/* One bar per moment the viewer can swipe to; a single moment needs none (QA item 12). */}
        {moments.length > 1 ? (
          <View
            style={[styles.progress, { top: insets.top + space.md + 2 }]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="moment-progress"
          >
            {moments.map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.bar,
                  { backgroundColor: i <= current ? colors.surface : colors.progressTrack },
                  i === current ? styles.barCurrent : null,
                ]}
                testID={
                  i === current
                    ? 'moment-progress-current'
                    : i < current
                      ? 'moment-progress-done'
                      : 'moment-progress-todo'
                }
              />
            ))}
          </View>
        ) : null}
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
          {/* White text on glass: a stronger tint and, on Liquid Glass, a text shadow keep it readable (D-80). */}
          <GlassSurface
            tone="dark"
            radius={radius.pill}
            tint={colors.liquidDarkStrongTint}
            fallback="none"
            fallbackColor={colors.glass}
            style={styles.author}
            testID="moment-author"
          >
            {(glyph) => (
              <>
                <Avatar name={data.author.display_name} uri={authorAvatarUrl} size="sm" decorative />
                <Text style={[textStyle('bodySmall', '700'), { color: colors.surface }, glyph?.text]} numberOfLines={1}>
                  {firstName(data.author.display_name)}
                </Text>
              </>
            )}
          </GlassSurface>
          {onMore && data.jar.user_id !== data.viewerId ? (
            <RoundIconButton
              icon="more"
              variant="glass"
              accessibilityLabel={t('report.more')}
              onPress={() => onMore(moment.id)}
              testID="moment-more"
            />
          ) : (
            <View style={styles.topSpacer} />
          )}
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
          {moment.visibility === 'only_me' ? (
            <View accessible accessibilityLabel={t('tile.a11y.private')} testID="moment-private">
              <Icon name="lock" color="muted" size={16} strokeWidth={2} />
            </View>
          ) : null}
        </View>
        {caption ? (
          <Text style={[textStyle('momentCaption'), styles.caption]} testID="moment-caption">
            {captionParts(caption, momentTags).map((part, i) =>
              part.kind === 'mention' && part.tag && onOpenProfile ? (
                <Text
                  key={i}
                  style={styles.mention}
                  onPress={() => part.tag && onOpenProfile(part.tag.username)}
                  accessibilityRole="link"
                  testID={`moment-caption-mention-${part.tag.username}`}
                >
                  {part.text}
                </Text>
              ) : (
                part.text
              ),
            )}
          </Text>
        ) : null}
        {momentTags.length > 0 ? (
          <View style={styles.tagged} testID="moment-tagged">
            <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]}>{t('moment.tags.label')}</Text>
            {momentTags.map((tag) => (
              <Pressable
                key={tag.userId}
                onPress={() => onOpenProfile?.(tag.username)}
                accessibilityRole="link"
                accessibilityLabel={t('moment.tags.open', { username: tag.username })}
                hitSlop={space.sm}
                style={styles.tagChip}
                testID={`moment-tag-${tag.username}`}
              >
                <Text style={[textStyle('bodySmall', '700'), { color: colors.brandLink }]}>@{tag.username}</Text>
              </Pressable>
            ))}
            {viewerTagged && onRemoveTag ? (
              <Pressable
                onPress={() => onRemoveTag(moment.id)}
                disabled={removingTag}
                accessibilityRole="button"
                accessibilityLabel={t('moment.tags.remove')}
                accessibilityHint={t('moment.tags.removeHint')}
                hitSlop={space.sm}
                style={styles.tagChip}
                testID="moment-remove-tag"
              >
                <Text style={[textStyle('bodySmall', '700'), { color: colors.danger }]}>
                  {removingTag ? t('moment.tags.removing') : t('moment.tags.remove')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {onTogether && viewerTagged && !isAuthor && myTogether?.status !== 'declined' ? (
          <View style={styles.tagged} testID="moment-together">
            {myTogether === undefined ? (
              <Pressable
                onPress={() => onTogether({ kind: 'request', momentId: moment.id })}
                disabled={togetherBusy}
                accessibilityRole="button"
                accessibilityLabel={t('moment.together.add')}
                accessibilityHint={t('moment.together.addHint', { name: authorName })}
                hitSlop={space.sm}
                style={styles.togetherChip}
                testID="moment-together-add"
              >
                <Text style={[textStyle('bodySmall', '700'), { color: colors.brandLink }]}>
                  {t('moment.together.add')}
                </Text>
              </Pressable>
            ) : myTogether.status === 'requested' ? (
              <Pressable
                onPress={() => onTogether({ kind: 'remove', momentId: moment.id, userId: data.viewerId })}
                disabled={togetherBusy}
                accessibilityRole="button"
                accessibilityLabel={t('moment.together.asked', { name: authorName })}
                accessibilityHint={t('moment.together.askedHint', { name: authorName })}
                hitSlop={space.sm}
                style={styles.togetherChip}
                testID="moment-together-asked"
              >
                <Text style={[textStyle('bodySmall', '600'), { color: colors.muted }]}>
                  {t('moment.together.asked', { name: authorName })}
                </Text>
              </Pressable>
            ) : (
              <>
                <Text
                  style={[textStyle('bodySmall', '600'), { color: colors.brandText }]}
                  testID="moment-together-added"
                >
                  {t('moment.together.added')}
                </Text>
                <Pressable
                  onPress={() => onTogether({ kind: 'remove', momentId: moment.id, userId: data.viewerId })}
                  disabled={togetherBusy}
                  accessibilityRole="button"
                  accessibilityLabel={t('moment.together.takeOff')}
                  accessibilityHint={t('moment.together.takeOffHint', { name: authorName })}
                  hitSlop={space.sm}
                  style={styles.togetherChip}
                  testID="moment-together-take-off"
                >
                  <Text style={[textStyle('bodySmall', '700'), { color: colors.danger }]}>
                    {t('moment.together.takeOff')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
        {onTogether && authorTogether.length > 0 ? (
          <View style={styles.togetherList} testID="moment-together-author">
            {authorTogether.map(({ row, username }) => (
              <View key={row.user_id} style={styles.tagged} testID={`moment-together-${username}`}>
                <Text style={[textStyle('bodySmall', '600'), styles.togetherText]}>
                  {row.status === 'requested'
                    ? t('moment.together.requested', { username })
                    : t('moment.together.onTheirs', { username })}
                </Text>
                {row.status === 'requested' ? (
                  <>
                    <Pressable
                      onPress={() =>
                        onTogether({ kind: 'answer', momentId: moment.id, userId: row.user_id, approve: true })
                      }
                      disabled={togetherBusy}
                      accessibilityRole="button"
                      accessibilityLabel={t('moment.together.approveA11y', { username })}
                      hitSlop={space.sm}
                      style={styles.togetherChip}
                      testID={`moment-together-approve-${username}`}
                    >
                      <Text style={[textStyle('bodySmall', '700'), { color: colors.brandLink }]}>
                        {t('moment.together.approve')}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        onTogether({ kind: 'answer', momentId: moment.id, userId: row.user_id, approve: false })
                      }
                      disabled={togetherBusy}
                      accessibilityRole="button"
                      accessibilityLabel={t('moment.together.declineA11y', { username })}
                      hitSlop={space.sm}
                      style={styles.togetherChip}
                      testID={`moment-together-decline-${username}`}
                    >
                      <Text style={[textStyle('bodySmall', '700'), { color: colors.muted }]}>
                        {t('moment.together.decline')}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => onTogether({ kind: 'remove', momentId: moment.id, userId: row.user_id })}
                    disabled={togetherBusy}
                    accessibilityRole="button"
                    accessibilityLabel={t('moment.together.takeBackA11y', { username })}
                    hitSlop={space.sm}
                    style={styles.togetherChip}
                    testID={`moment-together-remove-${username}`}
                  >
                    <Text style={[textStyle('bodySmall', '700'), { color: colors.danger }]}>
                      {t('moment.together.takeBack')}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        ) : null}
        {togetherFailed ? (
          <Text style={[textStyle('bodySmall'), { color: colors.danger }]} accessibilityLiveRegion="polite">
            {t('moment.together.failed')}
          </Text>
        ) : null}
        <Text style={[textStyle('bodySmall', '400'), { color: colors.muted }]} testID="moment-position">
          {current < moments.length - 1
            ? t('moment.detail.positionSwipe', { position: current + 1, count: moments.length })
            : t('moment.detail.position', { position: current + 1, count: moments.length })}
        </Text>
        <View style={styles.flex} />
        <View style={styles.actions}>
          <LikeButton
            count={moment.like_count}
            liked={isLiked(data, { kind: 'moment', id: moment.id })}
            height={sizes.momentAction}
            onPress={() => onToggleLike?.({ kind: 'moment', id: moment.id })}
            testID="moment-likes"
          />
          <CommentsButton
            count={moment.comment_count ?? 0}
            height={sizes.momentAction}
            onPress={() => onOpenComments?.(moment.id)}
            testID="moment-comments"
          />
          <View style={styles.flex} />
          {/* Only the owner shares (D-83), and only a live moment that isn't Only me (rule 9, D-48). */}
          {data.jar.user_id === data.viewerId && onCard(moment) ? (
            <RoundIconButton
              icon="share"
              accessibilityLabel={t('moment.detail.share')}
              accessibilityHint={t('moment.detail.shareHint')}
              onPress={() => onShare(moment.id)}
              testID="moment-share"
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Page({
  moment,
  width,
  tz,
  tags,
  onOpenProfile,
}: {
  moment: JarMoment;
  width: number;
  tz: string;
  tags: readonly MomentTag[];
  onOpenProfile?: (username: string) => void;
}) {
  const edits = parseEdits(moment.edits);
  const size = { width, height: width / photo.aspect };
  // A mention sticker opens its person's profile when the viewer may see the tag; the sheet's Tagged row is the
  // same for screen readers, so these taps stay out of the accessibility tree.
  const links = onOpenProfile
    ? edits.overlays.flatMap((o) => {
        if (o.type !== 'mention') return [];
        const tag = tags.find((t) => t.userId === o.userId);
        return tag ? [{ id: o.id, username: tag.username, box: toPixels(o, size, mentionAspect(o)) }] : [];
      })
    : [];
  return (
    <View style={{ width }} testID={`moment-page-${moment.slot}`}>
      <MomentView
        uri={moment.fullUrl ?? moment.thumbUrl}
        edits={edits}
        width={width}
        stamp={{ capturedAt: new Date(moment.captured_at ?? moment.added_at), tz }}
        accessible={false}
      />
      {links.map(({ id, username, box }) => (
        <Pressable
          key={id}
          onPress={() => onOpenProfile?.(username)}
          accessible={false}
          importantForAccessibility="no"
          style={[
            styles.stickerLink,
            {
              left: box.cx - Math.max(box.width, sizes.minTap) / 2,
              top: box.cy - Math.max(box.height, sizes.minTap) / 2,
              width: Math.max(box.width, sizes.minTap),
              height: Math.max(box.height, sizes.minTap),
            },
          ]}
          testID={`moment-mention-link-${username}`}
        />
      ))}
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
    alignItems: 'center',
    gap: space.xs,
  },
  bar: { flex: 1, height: sizes.momentProgress, borderRadius: radius.fillBar },
  // The moment on screen: a thicker bar, so it stands out from the ones already seen.
  barCurrent: { height: sizes.momentProgressCurrent },
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
  mention: { color: colors.brandLink, fontWeight: '700' },
  tagged: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs },
  tagChip: { paddingVertical: space.xs },
  togetherChip: { paddingVertical: space.xs },
  togetherList: { gap: space.xs },
  togetherText: { color: colors.inkSoft, flexShrink: 1 },
  stickerLink: { position: 'absolute' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
