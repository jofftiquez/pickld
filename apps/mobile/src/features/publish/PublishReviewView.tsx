import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { MAX_LAYERS } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { VisibilityBadge } from '@/components/VisibilityBadge';
import { holdsSlot, momentCount, type GridTile } from '@/features/jar/todayGrid';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { formatShortDate } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, shadow, sizes, space } from '@/theme/tokens';

import { publishNote, type Visibility } from './publishJar';
import { VisibilityOptions } from './VisibilityOptions';
import { photoSource } from '@/lib/image/photoCache';

export type PublishReviewViewProps = {
  /** The jar's local date (YYYY-MM-DD). */
  localDate: string;
  /** Today's 8 tiles, as on Today (server and queued moments). */
  tiles: readonly GridTile[];
  /** Readers count for the Readers choice; null while unknown. */
  readerCount: number | null;
  visibility: Visibility;
  onChangeVisibility: (visibility: Visibility) => void;
  /** True while the jar is still loading or the publish request runs: Publish is disabled (never sent twice). */
  busy: boolean;
  /** Why the last publish didn't go through; null hides the message. */
  error: 'refused' | 'failed' | null;
  insets: { top: number; bottom: number };
  onBack: () => void;
  onPublish: () => void;
  onNotYet: () => void;
  /** A past day's jar, from the day page (D-55): its missing slots are filled from that page, not "later today". */
  pastDay?: boolean;
};

/** A YYYY-MM-DD date as "Mon, Nov 9": read and printed in UTC so the day never shifts. */
function jarDate(localDate: string): string {
  return formatShortDate(new Date(`${localDate}T00:00:00Z`), 'UTC');
}

/** Publish review (design: Publish; FR-PUB-01, FR-PUB-03): the 8 slots, who can see the jar, the note. */
export function PublishReviewView({
  localDate,
  tiles,
  readerCount,
  visibility,
  onChangeVisibility,
  busy,
  error,
  insets,
  onBack,
  onPublish,
  onNotYet,
  pastDay = false,
}: PublishReviewViewProps) {
  const { t } = useTranslation();
  const { privateCount, missingCount } = publishNote(tiles);
  const note = [
    privateCount > 0 ? t('publish.notePrivate', { count: privateCount }) : null,
    missingCount > 0 ? t(pastDay ? 'publish.noteMissingPast' : 'publish.noteMissing', { count: missingCount }) : null,
  ]
    .filter((part) => part !== null)
    .join(' ');
  const rows = [tiles.slice(0, 4), tiles.slice(4, 8)];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="publish-review">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('publish.back')} onPress={onBack} testID="publish-back" />
        <View accessible style={styles.headerText}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="header"
            style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
          >
            {t('publish.title')}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]} testID="publish-subtitle">
            {t('publish.subtitle', {
              date: jarDate(localDate),
              moments: t('jar.moments', { count: momentCount(tiles), total: MAX_LAYERS }),
            })}
          </Text>
        </View>
        <View style={styles.headerSide} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, space.xxl) }]}
        testID="publish-scroll"
      >
        <View style={styles.card} accessibilityLabel={t('publish.slots')} testID="publish-slots">
          {rows.map((row, i) => (
            <View key={i} style={styles.slotRow}>
              {row.map((tile) => (
                <ReviewSlot key={tile.slot} tile={tile} />
              ))}
            </View>
          ))}
        </View>

        <View style={[styles.card, styles.choices]} accessibilityRole="radiogroup">
          <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.choicesTitle]}>
            {t('publish.visibilityTitle')}
          </Text>
          <VisibilityOptions
            visibility={visibility}
            readerCount={readerCount}
            onChange={onChangeVisibility}
            testIDPrefix="publish-visibility"
          />
        </View>

        {note ? (
          <View style={styles.note} testID="publish-note">
            <Icon name="lock" color="inkSoft" size={16} strokeWidth={2} />
            <Text style={[textStyle('bodySmall'), styles.noteText]}>{note}</Text>
          </View>
        ) : null}

        <View style={styles.spacer} />
        {error ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), styles.error]} testID="publish-error">
            {t(`publish.error.${error}`)}
          </Text>
        ) : null}
        <PrimaryButton
          label={t('publish.publish')}
          accessibilityHint={t('publish.publishHint')}
          onPress={onPublish}
          disabled={busy}
          testID="publish-submit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('publish.notYet')}
          accessibilityHint={t('publish.notYetHint')}
          onPress={onNotYet}
          hitSlop={hitSlopFor(undefined, sizes.minTap / 2)}
          style={styles.notYet}
          testID="publish-not-yet"
        >
          <Text style={[textStyle('bodyMedium', '700'), styles.notYetText]}>{t('publish.notYet')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const SLOT_LABEL = {
  readers: 'publish.slotReaders',
  everyone: 'publish.slotEveryone',
  only_me: 'publish.slotPrivate',
} as const;

/**
 * One of the 8 slots: the photo with its visibility badge (D-48: people, globe or lock) or a dashed
 * outline, and its tag below. Publishing doesn't change any moment's visibility (D-50).
 */
function ReviewSlot({ tile }: { tile: GridTile }) {
  const { t } = useTranslation();
  const tag = t(`slots.${tile.slot}`);
  const held = holdsSlot(tile);
  const label = !held
    ? t('publish.slotEmpty', { slot: tag })
    : tile.visibility
      ? t(SLOT_LABEL[tile.visibility], { slot: tag })
      : tag;
  return (
    <View accessible accessibilityLabel={label} style={styles.slot} testID={`publish-slot-${tile.slot}`}>
      {held ? (
        <View style={styles.photo}>
          {tile.uri !== null && hasVisibleEdits(tile.edits) ? (
            <MomentCover uri={tile.uri} edits={tile.edits} stamp={tile.stamp} accessible={false} />
          ) : tile.uri ? (
            <Image
              source={photoSource(tile.uri)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
            />
          ) : null}
          {tile.visibility ? (
            <View style={styles.badge}>
              <VisibilityBadge
                visibility={tile.visibility}
                tone="badge"
                iconSize={12}
                testID={
                  tile.visibility === 'only_me'
                    ? `publish-slot-${tile.slot}-lock`
                    : `publish-slot-${tile.slot}-${tile.visibility}`
                }
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.photo, styles.empty]} testID={`publish-slot-${tile.slot}-empty`} />
      )}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[textStyle('caption', '600'), styles.tag, { color: held ? colors.muted : colors.slotLabelEmpty }]}
      >
        {tag}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks to fit one line at large text instead of pushing the header's buttons off screen (D-37).
  headerTitle: { flexShrink: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  headerText: { flex: 1, alignItems: 'center' },
  headerSide: { width: sizes.minTap },
  content: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: space.md + 2, ...shadow.card },
  slotRow: { flexDirection: 'row', gap: sizes.reviewSlotGap },
  slot: { flex: 1, marginBottom: space.xs },
  photo: {
    aspectRatio: photo.aspect,
    borderRadius: radius.reviewSlot,
    overflow: 'hidden',
    backgroundColor: colors.photoPlaceholder,
  },
  empty: {
    backgroundColor: 'transparent',
    borderWidth: sizes.tileBorder,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
  },
  badge: { position: 'absolute', top: space.xs + 1, right: space.xs + 1 },
  tag: { marginTop: 3, textAlign: 'center' },
  choices: { paddingHorizontal: space.lg, paddingBottom: space.xs },
  choicesTitle: { color: colors.ink, marginBottom: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, paddingHorizontal: space.xs },
  noteText: { flex: 1, color: colors.inkSoft },
  spacer: { flex: 1 },
  error: { color: colors.danger, textAlign: 'center' },
  notYet: { alignSelf: 'center', paddingVertical: space.sm },
  notYetText: { color: colors.brandLink, textDecorationLine: 'underline' },
});
