import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space, type Slot } from '@/theme/tokens';

import { SlotChoice } from './SlotChoice';

export type SharedPhotoState = 'loading' | 'failed' | 'future' | 'full' | 'choose';

export type SharedPhotoViewProps = {
  insets: EdgeInsets;
  state: SharedPhotoState;
  /** The photo once it is out of the App Group. */
  photoUri: string | null;
  /** "For today's jar" or "For Sat, Nov 7 · added later", already translated; null until the day is known. */
  dayLabel: string | null;
  /** Slots that day already holds. */
  taken: ReadonlySet<Slot>;
  busy: boolean;
  onChoose: (slot: Slot) => void;
  onClose: () => void;
};

const messages = {
  failed: ['sharedPhoto.failedTitle', 'sharedPhoto.failedBody'],
  future: ['sharedPhoto.futureTitle', 'sharedPhoto.futureBody'],
  full: ['sharedPhoto.fullTitle', 'sharedPhoto.fullBody'],
} as const;

/**
 * Add to Pickld (FR-CAP-02): a photo shared from Photos, the day it goes to and its 8 slots. Filled slots
 * are dimmed; choosing a free one goes on to Crop or the editor. A photo that can't be added says why.
 * Scrolls when large text makes it taller than the screen.
 */
export function SharedPhotoView({
  insets,
  state,
  photoUri,
  dayLabel,
  taken,
  busy,
  onChoose,
  onClose,
}: SharedPhotoViewProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const message = state === 'failed' || state === 'future' || state === 'full' ? messages[state] : null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl },
      ]}
      bounces={false}
      testID="shared-photo"
    >
      <View style={styles.header}>
        <RoundIconButton
          icon="close"
          variant="glass"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          testID="shared-photo-close"
        />
        <View style={styles.titles}>
          <Text
            accessibilityRole="header"
            style={[textStyle('sectionTitle'), styles.center, { color: colors.surface }]}
          >
            {t('sharedPhoto.title')}
          </Text>
          {dayLabel ? (
            <Text style={[textStyle('caption', '600'), styles.center, styles.muted]} testID="shared-photo-day">
              {dayLabel}
            </Text>
          ) : null}
        </View>
        {/* Balances the close button so the title stays centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.photoWell, { height: window.height * 0.42 }]}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            contentFit="contain"
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t('sharedPhoto.photo')}
            accessible
          />
        ) : state === 'loading' ? (
          <ActivityIndicator color={colors.surface} />
        ) : null}
      </View>

      {message ? (
        <View style={styles.message} testID={`shared-photo-${state}`}>
          <Text accessibilityRole="header" style={[textStyle('body', '700'), styles.center, { color: colors.surface }]}>
            {t(message[0])}
          </Text>
          <Text style={[textStyle('bodyMedium'), styles.center, styles.muted]}>{t(message[1])}</Text>
        </View>
      ) : state === 'choose' ? (
        <View style={styles.choose}>
          <Text style={[textStyle('caption', '700'), styles.muted]}>{t('sharedPhoto.choose')}</Text>
          <View style={styles.grid}>
            {slots.map((slot) => (
              <SlotChoice
                key={slot}
                slot={slot}
                taken={taken.has(slot)}
                disabled={busy}
                onPress={() => onChoose(slot)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  content: { flexGrow: 1, gap: space.lg, paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titles: { flex: 1, gap: space.xs },
  headerSpacer: { width: sizes.roundButton },
  center: { textAlign: 'center' },
  muted: { color: colors.onDarkMuted },
  photoWell: {
    borderRadius: radius.tile,
    overflow: 'hidden',
    backgroundColor: colors.cameraPanel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  choose: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
