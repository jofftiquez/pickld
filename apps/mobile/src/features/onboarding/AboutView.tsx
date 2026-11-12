import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SelectField, type SelectOption } from '@/components/SelectField';
import { TextField } from '@/components/TextField';
import type { UsernameStatus } from '@/features/profile/editProfileModel';
import { deviceLocale } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { daysInMonth, yearOptions, type AboutForm, type Birthday, type YMD } from './aboutModel';
import { SetupProgress } from './SetupProgress';

export type AboutError = 'taken' | 'reserved' | 'birthday' | 'failed' | 'upload';

export type AboutViewProps = {
  insets: EdgeInsets;
  form: AboutForm;
  today: YMD;
  avatarUri: string | null;
  usernameStatus: UsernameStatus;
  canContinue: boolean;
  busy: boolean;
  error: AboutError | null;
  onChange: (patch: Partial<AboutForm>) => void;
  onPickPhoto: () => void;
  onContinue: () => void;
  onBack: () => void;
};

const monthNames = (locale: string) =>
  Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))),
  );

/** About you (FR-ACC-03): photo, name, username with live availability, birthday (FR-ACC-04). */
export function AboutView({
  insets,
  form,
  today,
  avatarUri,
  usernameStatus,
  canContinue,
  busy,
  error,
  onChange,
  onPickPhoto,
  onContinue,
  onBack,
}: AboutViewProps) {
  const { t } = useTranslation();
  const b = form.birthday;
  const setBirthday = (patch: Partial<Birthday>) => {
    const next = { ...b, ...patch };
    // A day that no longer exists in the picked month (31 Apr) is cleared rather than silently moved.
    if (next.day !== null && next.day > daysInMonth(next.year, next.month)) next.day = null;
    onChange({ birthday: next });
  };
  const months: SelectOption<number>[] = monthNames(deviceLocale()).map((label, i) => ({ value: i + 1, label }));
  const days: SelectOption<number>[] = Array.from({ length: daysInMonth(b.year, b.month) }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  }));
  const years: SelectOption<number>[] = yearOptions(today).map((y) => ({ value: y, label: String(y) }));
  const username = form.username.trim();
  const status =
    usernameStatus === 'available'
      ? t('setup.about.available')
      : usernameStatus === 'checking' || username === ''
        ? null
        : t(`editProfile.username.${usernameStatus === 'unchanged' ? 'invalid' : usernameStatus}`, { username });

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="about-screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="about-back" />
        <SetupProgress step={1} />
        <Text accessibilityRole="header" style={[textStyle('onboardTitle'), { color: colors.ink }]}>
          {t('setup.about.title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('setup.about.photoA11y')}
          onPress={onPickPhoto}
          hitSlop={hitSlopFor(undefined, sizes.avatarLg)}
          style={styles.photoRow}
          testID="about-photo"
        >
          <View>
            <Avatar name={form.displayName || form.username || '?'} uri={avatarUri} size="lg" decorative />
            <View style={styles.badge}>
              <Icon name="capture" color="surface" size={14} strokeWidth={2.2} />
            </View>
          </View>
          <Text style={[textStyle('body', '700'), { color: colors.brandText }]}>
            {avatarUri ? t('setup.about.changePhoto') : t('setup.about.addPhoto')}
          </Text>
        </Pressable>
        <TextField
          label={t('setup.about.name')}
          value={form.displayName}
          onChangeText={(displayName) => onChange({ displayName })}
          autoComplete="name"
          testID="about-name"
        />
        <View style={styles.usernameField}>
          <TextField
            label={t('setup.about.username')}
            value={form.username}
            onChangeText={(u) => onChange({ username: u })}
            autoCapitalize="none"
            autoComplete="username-new"
            testID="about-username"
          />
          {status ? (
            <View style={styles.status} accessibilityLiveRegion="polite" testID={`about-username-${usernameStatus}`}>
              {usernameStatus === 'available' ? (
                <Icon name="check" color="brandText" size={16} strokeWidth={2.4} />
              ) : null}
              <Text
                style={[
                  textStyle('label', '700'),
                  { color: usernameStatus === 'available' ? colors.brandText : colors.danger },
                ]}
              >
                {status}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.birthday} accessibilityRole="none">
          <Text style={[textStyle('label'), { color: colors.muted }]}>{t('setup.about.birthday')}</Text>
          <View style={styles.birthdayRow}>
            <SelectField
              label={t('setup.about.month')}
              placeholder={t('setup.about.monthPlaceholder')}
              options={months}
              value={b.month}
              onChange={(month) => setBirthday({ month })}
              testID="about-month"
            />
            <SelectField
              label={t('setup.about.day')}
              placeholder={t('setup.about.dayPlaceholder')}
              options={days}
              value={b.day}
              onChange={(day) => setBirthday({ day })}
              testID="about-day"
            />
            <SelectField
              label={t('setup.about.year')}
              placeholder={t('setup.about.yearPlaceholder')}
              options={years}
              value={b.year}
              onChange={(year) => setBirthday({ year })}
              testID="about-year"
            />
          </View>
          <Text style={[textStyle('label'), { color: colors.muted }]}>{t('setup.about.birthdayHint')}</Text>
        </View>
        {error ? (
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[textStyle('bodySmall', '600'), { color: colors.danger }]}
            testID="about-error"
          >
            {t(`setup.about.errors.${error}`)}
          </Text>
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton
          label={busy ? t('setup.about.saving') : t('setup.about.continue')}
          onPress={onContinue}
          disabled={!canContinue || busy}
          testID="about-continue"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: space.xxl, gap: space.lg },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, alignSelf: 'flex-start' },
  badge: {
    position: 'absolute',
    right: -space.xs,
    bottom: -space.xs,
    width: sizes.avatarEditBadge,
    height: sizes.avatarEditBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameField: { gap: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  birthday: { gap: space.sm },
  birthdayRow: { flexDirection: 'row', gap: space.md },
  spacer: { flex: 1, minHeight: space.lg },
});
