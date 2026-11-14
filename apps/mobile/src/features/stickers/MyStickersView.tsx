import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { Toggle } from '@/components/Toggle';
import { stickerArtFor } from '@/features/edit/stickers/stickerArt';
import { StickerImage } from '@/features/edit/stickers/StickerImage';
import { formatMonthDay } from '@/lib/format';
import { useLargeText } from '@/lib/useLargeText';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, myStickers, radius, sizes, space, stickerTool } from '@/theme/tokens';

import { movePack, type MyPack } from './myStickers';

/** What Restore purchases last did: still going, how many packs came back, or failed. */
export type RestoreState = { status: 'idle' | 'restoring' | 'failed' } | { status: 'done'; count: number };

export type MyStickersViewProps = {
  /** Undefined while loading. */
  packs: MyPack[] | undefined;
  failed?: boolean;
  saveFailed?: boolean;
  restore: RestoreState;
  insets: EdgeInsets;
  onRetry: () => void;
  /** The whole list after a move or a switch; the screen saves it. */
  onChange: (packs: MyPack[]) => void;
  onRestore: () => void;
  onShop: () => void;
};

/**
 * My stickers (MyStickers; FR-STK-08): drag a pack's grip to reorder the Stickers tool, switch one off to
 * hide it without losing it, restore purchases from another phone, or go to the shop. Screen readers move
 * packs with the Move up / Move down actions instead of dragging. The Stickers page shows it under Mine
 * (D-61) and draws the title above it.
 */
export function MyStickersView({
  packs,
  failed = false,
  saveFailed = false,
  restore,
  insets,
  onRetry,
  onChange,
  onRestore,
  onShop,
}: MyStickersViewProps) {
  const { t } = useTranslation();
  // At large text the Restore button left the title one or two letters a line: stack icon, words and button.
  const large = useLargeText();
  // The row being dragged and how far; other rows make room for it.
  const [drag, setDrag] = useState<{ index: number; dy: number } | null>(null);
  const [rowHeight, setRowHeight] = useState(0);
  const steps = (dy: number) => (rowHeight > 0 ? Math.round(dy / rowHeight) : 0);

  const restoreLine =
    restore.status === 'failed'
      ? t('myStickers.restoreFailed')
      : restore.status === 'done'
        ? restore.count > 0
          ? t('myStickers.restored', { count: restore.count })
          : t('myStickers.restoredNone')
        : null;

  return (
    <GestureHandlerRootView style={styles.screen} testID="my-stickers">
      <ScrollView
        scrollEnabled={drag === null}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <Text style={[textStyle('body', '400'), styles.intro]}>{t('myStickers.intro')}</Text>
        {packs === undefined ? (
          <View style={styles.message}>
            {failed ? (
              <>
                <Text style={[textStyle('body'), styles.center]}>{t('myStickers.failed')}</Text>
                <SecondaryButton label={t('myStickers.retry')} onPress={onRetry} testID="my-stickers-retry" />
              </>
            ) : (
              <ActivityIndicator
                color={colors.muted}
                accessibilityLabel={t('myStickers.loading')}
                testID="my-stickers-loading"
              />
            )}
          </View>
        ) : (
          <Card style={styles.listCard} testID="my-stickers-list">
            {packs.map((pack, index) => {
              let shift = 0;
              if (drag) {
                const target = Math.max(0, Math.min(packs.length - 1, drag.index + steps(drag.dy)));
                if (index === drag.index) shift = drag.dy;
                else if (drag.index < index && index <= target) shift = -rowHeight;
                else if (target <= index && index < drag.index) shift = rowHeight;
              }
              return (
                <PackRow
                  key={pack.id}
                  pack={pack}
                  index={index}
                  total={packs.length}
                  last={index === packs.length - 1}
                  shift={shift}
                  lifted={drag?.index === index}
                  onLayout={(e) => {
                    if (index === 0) setRowHeight(e.nativeEvent.layout.height);
                  }}
                  onDrag={(dy) => setDrag({ index, dy })}
                  onDrop={(dy) => {
                    setDrag(null);
                    const to = index + steps(dy);
                    if (to !== index) onChange(movePack(packs, index, to));
                  }}
                  onMove={(to) => onChange(movePack(packs, index, to))}
                  onToggle={(visible) =>
                    onChange(packs.map((p) => (p.id === pack.id ? { ...p, hidden: !visible } : p)))
                  }
                />
              );
            })}
          </Card>
        )}
        {saveFailed ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), styles.error]}>
            {t('myStickers.saveFailed')}
          </Text>
        ) : null}

        <Card style={large ? styles.restoreCardStacked : styles.restoreCard}>
          <View style={styles.restoreIcon}>
            <Icon name="download" size={20} strokeWidth={1.8} />
          </View>
          <View style={[styles.restoreText, large && styles.restoreTextStacked]}>
            <Text style={[textStyle('cardTitle', '800'), { color: colors.ink }]}>{t('myStickers.restoreTitle')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>{t('myStickers.restoreBody')}</Text>
          </View>
          <PillButton
            label={restore.status === 'restoring' ? t('myStickers.restoring') : t('myStickers.restore')}
            accessibilityLabel={t('myStickers.restoreTitle')}
            variant="subtle"
            disabled={restore.status === 'restoring'}
            onPress={onRestore}
            testID="my-stickers-restore"
          />
        </Card>
        {restoreLine ? (
          <Text
            accessibilityRole="alert"
            style={[
              textStyle('bodySmall', '600'),
              styles.center,
              { color: restore.status === 'failed' ? colors.danger : colors.muted },
            ]}
            testID="my-stickers-restore-result"
          >
            {restoreLine}
          </Text>
        ) : null}

        <SecondaryButton
          variant="outline"
          label={t('myStickers.more')}
          icon="plus"
          onPress={onShop}
          testID="my-stickers-shop"
        />
      </ScrollView>
    </GestureHandlerRootView>
  );
}

function PackRow({
  pack,
  index,
  total,
  last,
  shift,
  lifted,
  onLayout,
  onDrag,
  onDrop,
  onMove,
  onToggle,
}: {
  pack: MyPack;
  index: number;
  total: number;
  last: boolean;
  shift: number;
  lifted: boolean;
  onLayout: (e: LayoutChangeEvent) => void;
  onDrag: (dy: number) => void;
  onDrop: (dy: number) => void;
  onMove: (to: number) => void;
  onToggle: (visible: boolean) => void;
}) {
  const { t } = useTranslation();
  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    testID: `my-stickers-grip-${pack.slug}`,
    onUpdate: (e) => onDrag(e.translationY),
    onDeactivate: (e) => onDrop(e.translationY),
  });
  const detail =
    pack.kind === 'earned'
      ? t('myStickers.earned', { used: pack.usableCount, count: pack.stickerCount })
      : pack.kind === 'bought' && pack.boughtAt
        ? t('myStickers.bought', { date: formatMonthDay(new Date(pack.boughtAt)), count: pack.stickerCount })
        : t('myStickers.free', { count: pack.stickerCount });
  const art = pack.sample ? stickerArtFor(pack.sample.asset) : undefined;
  // The sample keeps its shape and fits inside the tile, like the design's small stickers.
  const ratio = art ? art.width / art.height : 1;
  const w = Math.min(myStickers.tileSampleHeight * ratio, myStickers.tile * myStickers.tileSampleMaxWidth);
  const h = w / ratio;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.row,
        !last && styles.divider,
        shift !== 0 && { transform: [{ translateY: shift }] },
        lifted && styles.lifted,
      ]}
      accessible
      accessibilityLabel={t('myStickers.rowLabel', { name: pack.name, detail, position: index + 1, total })}
      accessibilityActions={[
        ...(index > 0 ? [{ name: 'moveUp', label: t('myStickers.moveUp') }] : []),
        ...(index < total - 1 ? [{ name: 'moveDown', label: t('myStickers.moveDown') }] : []),
        { name: 'activate', label: pack.hidden ? t('myStickers.show') : t('myStickers.hide') },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'moveUp') onMove(index - 1);
        else if (e.nativeEvent.actionName === 'moveDown') onMove(index + 1);
        else if (e.nativeEvent.actionName === 'activate') onToggle(pack.hidden);
      }}
      testID={`my-stickers-row-${pack.slug}`}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.grip} hitSlop={space.sm}>
          <Icon name="grip" size={20} strokeWidth={2} color="chevron" />
        </View>
      </GestureDetector>
      <View style={[styles.tile, { backgroundColor: stickerTool.packTint[pack.slug] ?? stickerTool.packTintDefault }]}>
        {pack.sample ? (
          <View style={styles.tileSample}>
            <StickerImage asset={pack.sample.asset} width={w} height={h} />
          </View>
        ) : null}
      </View>
      <View style={styles.rowText}>
        {/* Beside the grip, the pack tile and the switch the name became "Ever…" at accessibility sizes: it
            stops at 2× and shrinks to fit, like segmented labels (D-110). */}
        <Text
          style={[textStyle('cardTitle', '800'), { color: colors.ink }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={maxTextScale.control}
        >
          {pack.name}
        </Text>
        {/* Stops at 2× too, so the name never ends up smaller than the line under it. */}
        <Text style={[textStyle('bodySmall'), { color: colors.muted }]} maxFontSizeMultiplier={maxTextScale.control}>
          {detail}
        </Text>
      </View>
      <Toggle
        value={!pack.hidden}
        onValueChange={onToggle}
        accessibilityLabel={t('myStickers.toggle', { name: pack.name })}
        testID={`my-stickers-toggle-${pack.slug}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, gap: space.md },
  intro: { color: colors.muted },
  listCard: { paddingVertical: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    backgroundColor: colors.surface,
  },
  lifted: { zIndex: 1, opacity: 0.94 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  grip: { width: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  tile: {
    width: myStickers.tile,
    height: myStickers.tile,
    borderRadius: myStickers.tileRadius,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSample: { transform: [{ rotate: '-4deg' }] },
  rowText: { flex: 1, gap: 2 },
  restoreCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  restoreIcon: {
    width: sizes.permissionIcon,
    height: sizes.permissionIcon,
    borderRadius: radius.permissionIcon,
    backgroundColor: colors.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreText: { flex: 1, gap: 2 },
  restoreCardStacked: { alignItems: 'flex-start', gap: space.sm },
  restoreTextStacked: { flex: 0, alignSelf: 'stretch' },
  message: { gap: space.md, paddingVertical: space.xxl, alignItems: 'center' },
  center: { textAlign: 'center', color: colors.muted },
  error: { color: colors.danger, textAlign: 'center' },
});
