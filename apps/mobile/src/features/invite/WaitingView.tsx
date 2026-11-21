import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { JarGraphic } from '@/components/JarGraphic';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { CodeField } from '@/features/onboarding/CodeField';
import { CODE_LENGTH } from '@/lib/auth';
import { formatMonthDay } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, join, radius, sizes, space } from '@/theme/tokens';

export type WaitingError = 'notACode' | 'unavailable' | 'limited' | 'offline';

export type WaitingViewProps = {
  insets: EdgeInsets;
  /** People ahead in line; 0 when next, null while unknown (loading or offline). */
  ahead: number | null;
  /** When early access ends, for the footnote; null leaves the date out. */
  endsAt: Date | null;
  code: string;
  onChangeCode: (code: string) => void;
  error: WaitingError | null;
  /** True while a code is being used. */
  busy: boolean;
  onPaste: () => void;
  onScan: () => void;
  onGetIn: () => void;
  onSettings: () => void;
};

/**
 * Waiting (INV-06; FR-INV-01; design: Waiting): signed up during the invite period without a code. A friend's
 * code lets you in now; everyone still waiting gets in when early access ends. Settings stays reachable, so
 * a waiting account can still export or delete its data.
 */
export function WaitingView({
  insets,
  ahead,
  endsAt,
  code,
  onChangeCode,
  error,
  busy,
  onPaste,
  onScan,
  onGetIn,
  onSettings,
}: WaitingViewProps) {
  const { t, i18n } = useTranslation();
  const top = insets.top + space.lg;
  return (
    <View style={styles.root} testID="waiting">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: top + sizes.roundButton, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.art}>
          <JarGraphic count={join.waitingLayers} size={join.waitingJar} decorative />
        </View>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.centered, styles.title]}>
          {t('join.waitingTitle')}
        </Text>
        <Text style={[textStyle('body'), styles.centered, styles.body]}>{t('join.waitingBody')}</Text>
        {ahead !== null ? (
          <View style={styles.pill} testID="waiting-position">
            <Text style={[textStyle('bodySmall', '800'), styles.pillText]}>
              {ahead === 0
                ? t('join.next')
                : t('join.ahead', { count: ahead, formatted: ahead.toLocaleString(i18n.language) })}
            </Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <CodeField
            kind="invite"
            value={code}
            onChangeText={(value) => {
              onChangeCode(value);
              // The whole code is in: close the keyboard, which covers Get in on most phones.
              if (value.length === CODE_LENGTH) Keyboard.dismiss();
            }}
            label={t('join.codeLabel')}
            invalid={error === 'unavailable'}
            editable={!busy}
            testID="waiting-code"
          />
        </View>
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[textStyle('bodySmall'), styles.centered, styles.error]}
          >
            {t(`join.${error}`)}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <PillButton
            variant="subtle"
            icon="paste"
            label={t('join.paste')}
            accessibilityLabel={t('join.pasteA11y')}
            onPress={onPaste}
            disabled={busy}
            testID="waiting-paste"
          />
          <PillButton
            variant="subtle"
            icon="scan"
            label={t('join.scan')}
            accessibilityLabel={t('join.scanA11y')}
            onPress={onScan}
            disabled={busy}
            testID="waiting-scan"
          />
        </View>
        <View style={styles.spacer} />
        <PrimaryButton
          label={t('join.getIn')}
          onPress={onGetIn}
          disabled={busy || code.length !== CODE_LENGTH}
          testID="waiting-get-in"
        />
        <Text style={[textStyle('caption'), styles.centered, styles.footnote]}>
          {endsAt ? t('join.waitingFootnoteDate', { date: formatMonthDay(endsAt) }) : t('join.waitingFootnote')}
        </Text>
      </ScrollView>
      <View style={[styles.settings, { top }]}>
        <RoundIconButton
          icon="settings"
          accessibilityLabel={t('join.settings')}
          onPress={onSettings}
          testID="waiting-settings"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: space.xxl, gap: space.md },
  art: {
    width: join.waitingArt,
    height: join.waitingArt,
    borderRadius: join.waitingArt / 2,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  centered: { textAlign: 'center' },
  title: { color: colors.ink },
  body: { color: colors.inkSoft },
  pill: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  pillText: { color: colors.brandLink },
  field: { alignSelf: 'stretch', marginTop: space.md },
  error: { color: colors.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  spacer: { flex: 1, minHeight: space.xxl },
  footnote: { color: colors.muted },
  settings: { position: 'absolute', right: space.xxl },
});
