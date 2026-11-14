import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { JarGraphic } from '@/components/JarGraphic';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, lidColors, radius, shadow, sizes, space } from '@/theme/tokens';

import { SetupProgress } from './SetupProgress';

export type LidName = keyof typeof lidColors;
const LIDS = Object.keys(lidColors) as LidName[];
/** 20% of the lid colour for the circle behind the jar. */
const HALO_ALPHA = '33';

export type JarLidViewProps = {
  insets: EdgeInsets;
  lid: LidName;
  busy: boolean;
  failed: boolean;
  onPick: (lid: LidName) => void;
  onContinue: () => void;
  onBack?: () => void;
};

/** Pick your jar (FR-ONB-04): six lid colours, Pickle by default, shown on a jar. */
export function JarLidView({ insets, lid, busy, failed, onPick, onContinue, onBack }: JarLidViewProps) {
  const { t } = useTranslation();
  const color = lidColors[lid];
  return (
    <View style={styles.screen} testID="jar-lid-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        {onBack ? (
          <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="jar-lid-back" />
        ) : (
          <View style={styles.backSpace} />
        )}
        <SetupProgress step={4} />
        <View style={styles.heading}>
          <Text
            maxFontSizeMultiplier={maxTextScale.title}
            accessibilityRole="header"
            style={[textStyle('onboardTitle'), { color: colors.ink }]}
          >
            {t('setup.lid.title')}
          </Text>
          <Text style={[textStyle('body'), styles.body]}>{t('setup.lid.body')}</Text>
        </View>
        <View style={styles.stage}>
          <View style={[styles.halo, { backgroundColor: `${color}${HALO_ALPHA}` }]} />
          <JarGraphic count={3} size={sizes.lidJarLarge} lidColor={color} decorative />
          <View style={styles.bubble} accessibilityLiveRegion="polite">
            <Text style={[textStyle('label', '700'), { color: colors.ink }]} testID="jar-lid-picked">
              {t('setup.lid.picked', { name: t(`setup.lid.names.${lid}`) })}
            </Text>
          </View>
        </View>
        <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel={t('setup.lid.title')}>
          {LIDS.map((name) => {
            const selected = name === lid;
            return (
              <Pressable
                key={name}
                accessibilityRole="radio"
                accessibilityLabel={t(`setup.lid.names.${name}`)}
                accessibilityState={{ selected, checked: selected }}
                onPress={() => onPick(name)}
                hitSlop={hitSlopFor(sizes.lidSwatch, sizes.lidSwatch)}
                style={styles.swatchItem}
                testID={`jar-lid-${name}`}
              >
                <View style={[styles.ring, selected ? styles.ringOn : null]}>
                  <View style={[styles.swatch, { backgroundColor: lidColors[name] }]} />
                </View>
                {/* Six names share one row under 44-point swatches: past 1.3× they ran together and pushed the
                    last lids off screen, so they stop there like tile labels (D-37). */}
                <Text
                  style={[textStyle('label', selected ? '700' : '500'), { color: colors.ink }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={maxTextScale.tile}
                >
                  {t(`setup.lid.names.${name}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[textStyle('bodySmall'), styles.hint]}>{t('setup.lid.hint')}</Text>
        {failed ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), { color: colors.danger }]}>
            {t('setup.lid.failed')}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton
          label={busy ? t('setup.lid.saving') : t('setup.lid.continue')}
          onPress={onContinue}
          disabled={busy}
          testID="jar-lid-continue"
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg },
  backSpace: { height: sizes.roundButton },
  heading: { gap: space.xs },
  body: { color: colors.inkSoft, lineHeight: 23 },
  stage: { height: sizes.lidStage + space.xl, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: sizes.lidStage * 0.95,
    height: sizes.lidStage,
    borderRadius: radius.pill,
  },
  bubble: {
    position: 'absolute',
    top: space.md,
    right: space.xxl,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchItem: { alignItems: 'center', gap: space.xs },
  ring: { padding: 3, borderRadius: radius.tile, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: colors.ink },
  swatch: { width: sizes.lidSwatch, height: sizes.lidSwatch, borderRadius: radius.introTile },
  hint: { color: colors.muted, textAlign: 'center' },
  spacer: { flex: 1, minHeight: space.lg },
});
