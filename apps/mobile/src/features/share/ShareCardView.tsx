import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { Toggle } from '@/components/Toggle';
import { parseEdits } from '@/features/edit/edits';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space } from '@/theme/tokens';

import type { CardRef } from './shareActions';
import type { ShareCard } from './shareCard';

// The wordmark pre-coloured brand green (see PromiseView).
const logo = require('../../../assets/brand/wordmark.png');
const LOGO_ASPECT = 1200 / 496;
const CARD_HEIGHT = (sizes.shareCardWidth * 16) / 9;
const GAP = 4;
const TILE_WIDTH = (sizes.shareCardWidth - 2 * space.md - 3 * GAP) / 4;

export type ShareAction = 'save' | 'copy' | 'message' | 'more';
const ACTIONS: { key: ShareAction; icon: IconName; label: 'save' | 'copy' | 'message' | 'more' }[] = [
  { key: 'save', icon: 'download', label: 'save' },
  { key: 'copy', icon: 'link', label: 'copy' },
  { key: 'message', icon: 'comment', label: 'message' },
  { key: 'more', icon: 'more', label: 'more' },
];

export type ShareCardViewProps = {
  insets: EdgeInsets;
  /** The card view, rendered to the image (collapsable off so Skia can snapshot it). */
  cardRef: CardRef;
  card: ShareCard;
  title: string;
  /** "Nov 8, 2026" */
  date: string;
  authorName: string;
  tz: string;
  includeCaption: boolean;
  /** Short feedback after an action ("Link copied"), or an error. */
  notice: { text: string; error: boolean } | null;
  busy: boolean;
  onToggleCaption: (value: boolean) => void;
  onAction: (action: ShareAction) => void;
  onShareTo: () => void;
  onBack: () => void;
};

/** Share jar (FR-SOC-10; design: ShareCard): the 9:16 card, Include captions, and the share actions. */
export function ShareCardView({
  insets,
  cardRef,
  card,
  title,
  date,
  authorName,
  tz,
  includeCaption,
  notice,
  busy,
  onToggleCaption,
  onAction,
  onShareTo,
  onBack,
}: ShareCardViewProps) {
  const { t } = useTranslation();
  const count = card.moments.length;
  return (
    <View style={styles.screen} testID="share-screen">
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <RoundIconButton
          icon="back"
          variant="glass"
          accessibilityLabel={t('share.back')}
          onPress={onBack}
          testID="share-back"
        />
        <Text accessibilityRole="header" style={[textStyle('cardTitle'), styles.headerTitle]}>
          {t('share.title')}
        </Text>
        <View style={styles.headerSpace} />
      </View>
      <View style={styles.stage}>
        <View
          ref={cardRef}
          collapsable={false}
          style={styles.card}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('share.card', { title, date, count, max: slots.length })}
          testID="share-card"
        >
          <View style={styles.author}>
            <Avatar name={authorName} size="sm" decorative />
            <View style={styles.authorText}>
              <Text style={[textStyle('bodyMedium', '700'), { color: colors.ink }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[textStyle('caption'), { color: colors.inkSoft }]}>
                {t('share.subtitle', { date, count, max: slots.length })}
              </Text>
            </View>
          </View>
          <View style={styles.grid}>
            {card.moments.map((m) => {
              const edits = parseEdits(m.edits);
              return (
                <View key={m.id} style={styles.tile} testID={`share-card-${m.slot}`}>
                  {m.thumbUrl !== null && hasVisibleEdits(edits) ? (
                    <MomentCover
                      uri={m.thumbUrl}
                      edits={edits}
                      stamp={{ capturedAt: new Date(m.captured_at ?? m.added_at), tz }}
                      accessible={false}
                    />
                  ) : m.thumbUrl !== null ? (
                    <Image source={{ uri: m.thumbUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : null}
                </View>
              );
            })}
          </View>
          {card.caption ? (
            <Text style={[textStyle('caption'), { color: colors.inkSoft }]} numberOfLines={3} testID="share-caption">
              {t('share.caption', { caption: card.caption })}
            </Text>
          ) : null}
          <View style={styles.spacer} />
          <View style={styles.footer}>
            <Image source={logo} style={styles.logo} contentFit="contain" accessible={false} />
            <Text style={[textStyle('caption', '600'), { color: colors.inkSoft }]}>{card.link}</Text>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + space.lg }]}
      >
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('share.includeCaptions')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>{t('share.includeCaptionsBody')}</Text>
          </View>
          <Toggle
            value={includeCaption}
            onValueChange={onToggleCaption}
            accessibilityLabel={t('share.includeCaptions')}
            testID="share-captions"
          />
        </View>
        <View style={styles.actions}>
          {ACTIONS.map(({ key, icon, label }) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={t(`share.${label}`)}
              onPress={() => onAction(key)}
              disabled={busy}
              hitSlop={hitSlopFor(sizes.shareAction, sizes.shareAction)}
              style={styles.action}
              testID={`share-${key}`}
            >
              <View style={styles.actionWell}>
                <Icon name={icon} color="ink" size={22} />
              </View>
              <Text style={[textStyle('bodySmall', '500'), { color: colors.ink }]}>{t(`share.${label}`)}</Text>
            </Pressable>
          ))}
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            textStyle('bodySmall', '600'),
            styles.notice,
            { color: notice?.error ? colors.danger : colors.brandLink },
          ]}
          testID="share-notice"
        >
          {notice?.text ?? ' '}
        </Text>
        <PrimaryButton icon="share" label={t('share.shareTo')} onPress={onShareTo} disabled={busy} testID="share-to" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.camera },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xxl, paddingBottom: space.md },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.surface },
  headerSpace: { width: sizes.roundButton },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space.md },
  card: {
    width: sizes.shareCardWidth,
    height: CARD_HEIGHT,
    borderRadius: radius.shareCard,
    backgroundColor: colors.background,
    padding: space.md,
    gap: space.md,
    overflow: 'hidden',
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  authorText: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    width: TILE_WIDTH,
    height: (TILE_WIDTH * 4) / 3,
    borderRadius: radius.shareTile,
    overflow: 'hidden',
    backgroundColor: colors.tileIconWell,
  },
  spacer: { flex: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: sizes.shareLogo, height: sizes.shareLogo / LOGO_ASPECT },
  sheet: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.noteSheet,
    borderTopRightRadius: radius.noteSheet,
  },
  sheetContent: { padding: space.xxl, gap: space.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: { alignItems: 'center', gap: space.sm },
  actionWell: {
    width: sizes.shareAction,
    height: sizes.shareAction,
    borderRadius: radius.shareAction,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { textAlign: 'center' },
});
