import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/GlassSurface';
import { RoundIconButton } from '@/components/RoundIconButton';
import { VISIBILITY_ICON, VisibilityBadge } from '@/components/VisibilityBadge';
import { deviceLocale, formatShortDate, formatTime } from '@/lib/format';
import { useLargeText } from '@/lib/useLargeText';
import { VISIBILITY_KEY } from '@/lib/visibility';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import type { OptionError } from './momentActions';
import { canShare, previewActions, resolveIndex, type PreviewItem } from './momentPreview';
import { MomentView } from './MomentView';
import { PreviewActionButton } from './PreviewActionButton';

export type MomentPreviewViewProps = {
  /** Today's moments to swipe through (buildPreviewItems); undefined while Today is loading. */
  items: readonly PreviewItem[] | undefined;
  /** The tile that opened the preview. */
  startSlot: Slot;
  /** The jar's IANA zone, for the time. */
  tz: string;
  insets: EdgeInsets;
  onClose: () => void;
  onEdit: (item: PreviewItem) => void;
  onShare: (item: PreviewItem) => void;
  onVisibility: (item: PreviewItem) => void;
  onMore: (item: PreviewItem) => void;
  /** Delete on a photo still on the phone; the caller asks for confirmation. */
  onDelete: (item: PreviewItem) => void;
  /** An action is running: the bar is disabled. */
  busy?: boolean;
  /** Why the last action failed, shown above the bar. */
  error?: OptionError | null;
  locale?: string;
};

/**
 * Moment preview (QA item 3, D-54; FR-JAR-02; design: MomentPreview): the owner's own moment from Today, full
 * screen, with the 3:4 photo and its edits, the #slot, time, visibility, caption, likes and comments, swiped
 * left and right through today's moments in slot order. The bar has Edit, Share, Visibility and More for a
 * live moment; a photo still on the phone has only Edit and Delete, and none while it uploads.
 */
export function MomentPreviewView({
  items,
  startSlot,
  tz,
  insets,
  onClose,
  onEdit,
  onShare,
  onVisibility,
  onMore,
  onDelete,
  busy = false,
  error = null,
  locale = deviceLocale(),
}: MomentPreviewViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const large = useLargeText();
  // The moment on screen, by key, so a refresh (a move, a delete, an upload) keeps it or its neighbour.
  const [shown, setShown] = useState<{ key: string; slot: Slot }>({ key: '', slot: startSlot });
  const list = useRef<FlatList<PreviewItem>>(null);
  const index = items ? resolveIndex(items, shown.key, shown.slot) : -1;
  const count = items?.length ?? 0;

  const item = index >= 0 ? items?.[index] : undefined;

  // Remember the moment that is actually on screen, so a move follows it to its new slot. Adjusted during
  // render (not in an effect); it settles at once, as the remembered key then finds the same item.
  if (item !== undefined && (shown.key !== item.key || shown.slot !== item.slot)) {
    setShown({ key: item.key, slot: item.slot });
  }
  // Keep the pager on the shown moment when the list changes under it.
  useEffect(() => {
    if (index >= 0 && count > 0) list.current?.scrollToIndex({ index, animated: false });
  }, [index, count]);

  if (!items || item === undefined) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]} testID="moment-preview">
        <View style={[styles.topRow, { top: insets.top + space.md }]}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('moment.close')}
            onPress={onClose}
            testID="preview-close"
          />
        </View>
        {items ? (
          <Text style={[textStyle('body'), styles.message]} testID="preview-not-available">
            {t('preview.notAvailable')}
          </Text>
        ) : (
          <ActivityIndicator color={colors.surface} accessibilityLabel={t('moment.loading')} />
        )}
      </View>
    );
  }

  const goTo = (next: number) => {
    const target = items[next];
    if (target) setShown({ key: target.key, slot: target.slot });
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) goTo(next);
  };
  // Screen readers can't swipe a pager: the photo is adjustable, so swipe up or down moves between moments.
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') goTo(index + 1);
    if (e.nativeEvent.actionName === 'decrement') goTo(index - 1);
  };

  const slot = t(`slots.${item.slot}`);
  const at = item.time === null ? null : new Date(item.time);
  const visibilityLabel = t(`visibility.${VISIBILITY_KEY[item.visibility]}`);
  const actions = previewActions(item);
  const shareable = canShare(item);
  const note = item.kind === 'queued' ? (item.uploading ? t('preview.uploading') : t('preview.queued')) : null;

  return (
    <View style={styles.screen} testID="moment-preview">
      <View style={{ height: width / photo.aspect }}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('moment.detail.photo', { slot, position: index + 1, count })}
          accessibilityHint={count > 1 ? t('preview.pagerHint') : undefined}
          accessibilityValue={{ min: 1, max: count, now: index + 1 }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
          testID="preview-photo"
        >
          <FlatList
            ref={list}
            data={items}
            keyExtractor={(m) => m.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            onMomentumScrollEnd={onScrollEnd}
            renderItem={({ item: page }) => (
              <View style={{ width }} testID={`preview-page-${page.slot}`}>
                <MomentView uri={page.uri} edits={page.edits} width={width} stamp={page.stamp} accessible={false} />
              </View>
            )}
            testID="preview-pager"
          />
        </View>
        <View style={[styles.topRow, { top: insets.top + space.md }]} pointerEvents="box-none">
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('moment.close')}
            onPress={onClose}
            testID="preview-close"
          />
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.xl) }]} testID="preview-sheet">
        {/* At 200% text the details scroll; the action bar stays put (D-37). */}
        <ScrollView style={styles.flex} contentContainerStyle={styles.details}>
          <View style={styles.metaRow}>
            <View style={styles.slotChip}>
              <Text style={[textStyle('bodySmall', '700'), { color: colors.brandText }]}>{slot}</Text>
            </View>
            {at ? (
              <Text style={[textStyle('bodySmall', '400'), styles.muted]} testID="preview-when">
                {t('moment.detail.when', { time: formatTime(at, tz, locale), date: formatShortDate(at, tz, locale) })}
              </Text>
            ) : null}
            {item.addedLater ? (
              <View style={styles.addedLater} testID="preview-added-later">
                <Text style={[textStyle('caption'), { color: colors.inkSoft }]}>{t('tile.addedLater')}</Text>
              </View>
            ) : null}
          </View>
          <View
            style={styles.visibilityRow}
            accessible
            accessibilityLabel={t('preview.visibilityValue', { value: visibilityLabel })}
            testID="preview-visibility"
          >
            <VisibilityBadge visibility={item.visibility} tone="badge" testID={`preview-badge-${item.visibility}`} />
            <Text style={[textStyle('bodySmall', '600'), styles.muted]}>{visibilityLabel}</Text>
          </View>
          {item.caption ? (
            <Text style={[textStyle('momentCaption'), styles.caption]} testID="preview-caption">
              {item.caption}
            </Text>
          ) : null}
          {item.likeCount !== null && item.commentCount !== null ? (
            <Text style={[textStyle('bodySmall', '600'), styles.ink]} testID="preview-counts">
              {t('preview.likes', { count: item.likeCount })} · {t('preview.comments', { count: item.commentCount })}
            </Text>
          ) : null}
          {note ? (
            <Text style={[textStyle('bodySmall', '400'), styles.muted]} testID="preview-note">
              {note}
            </Text>
          ) : null}
          <Text style={[textStyle('bodySmall', '400'), styles.muted]} testID="preview-position">
            {index < count - 1
              ? t('moment.detail.positionSwipe', { position: index + 1, count })
              : t('moment.detail.position', { position: index + 1, count })}
          </Text>
        </ScrollView>
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[textStyle('bodySmall'), styles.error]}
            testID="preview-error"
          >
            {t(`momentOptions.error.${error}`)}
          </Text>
        ) : null}
        {actions.length > 0 ? (
          // Liquid Glass on iOS 26 (D-57); below that, or with Reduce Transparency on, the bar stays plain on the sheet.
          <GlassSurface
            tone="light"
            radius={radius.card}
            tint={colors.tabBarGlass}
            fallback="none"
            style={[styles.actions, large ? styles.actionsWide : null]}
            testID="preview-actions"
          >
            {actions.map((action) => {
              switch (action) {
                case 'edit':
                  return (
                    <PreviewActionButton
                      key={action}
                      icon="edit"
                      label={t('preview.edit')}
                      accessibilityHint={t('preview.editHint')}
                      onPress={() => onEdit(item)}
                      disabled={busy}
                      wide={large}
                      testID="preview-edit"
                    />
                  );
                case 'share':
                  return (
                    <PreviewActionButton
                      key={action}
                      icon="share"
                      label={t('preview.share')}
                      accessibilityHint={shareable ? t('preview.shareHint') : t('preview.shareOnlyMe')}
                      onPress={() => onShare(item)}
                      // Only me can't leave its owner (rule 9, D-48): shown, but off.
                      disabled={busy || !shareable}
                      wide={large}
                      testID="preview-share"
                    />
                  );
                case 'visibility':
                  return (
                    <PreviewActionButton
                      key={action}
                      icon={VISIBILITY_ICON[item.visibility]}
                      label={t('preview.visibility')}
                      accessibilityHint={t('preview.visibilityHint')}
                      onPress={() => onVisibility(item)}
                      disabled={busy}
                      wide={large}
                      testID="preview-visibility-action"
                    />
                  );
                case 'more':
                  return (
                    <PreviewActionButton
                      key={action}
                      icon="more"
                      label={t('preview.more')}
                      accessibilityHint={t('preview.moreHint')}
                      onPress={() => onMore(item)}
                      disabled={busy}
                      wide={large}
                      testID="preview-more"
                    />
                  );
                case 'delete':
                  return (
                    <PreviewActionButton
                      key={action}
                      icon="trash"
                      tone="danger"
                      label={t('preview.delete')}
                      accessibilityHint={t('preview.deleteHint')}
                      onPress={() => onDelete(item)}
                      disabled={busy}
                      wide={large}
                      testID="preview-delete"
                    />
                  );
              }
            })}
          </GlassSurface>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.editor },
  centered: { alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.surface, textAlign: 'center', paddingHorizontal: space.xxl },
  flex: { flex: 1 },
  topRow: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheet: {
    flex: 1,
    marginTop: -sizes.momentSheetOverlap,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.noteSheet,
    borderTopRightRadius: radius.noteSheet,
    paddingTop: space.xl,
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  details: { gap: space.sm + 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  slotChip: {
    borderRadius: radius.pill,
    paddingVertical: space.xs + 1,
    paddingHorizontal: space.md,
    backgroundColor: colors.brandTint,
  },
  addedLater: {
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm,
    backgroundColor: colors.subtle,
  },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  muted: { color: colors.muted, flexShrink: 1 },
  ink: { color: colors.ink },
  caption: { color: colors.ink },
  error: { color: colors.danger },
  actions: { flexDirection: 'row', gap: space.sm },
  actionsWide: { flexWrap: 'wrap', rowGap: space.sm },
});
