import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BottomSheet } from '@/components/BottomSheet';
import { Card } from '@/components/Card';
import { DangerButton } from '@/components/DangerButton';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import { ListRow } from '@/components/ListRow';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SelectField } from '@/components/SelectField';
import { Toggle } from '@/components/Toggle';
import { timeOptions } from '@/features/onboarding/dayPresets';
import type { Visibility } from '@/features/publish/publishJar';
import { VisibilityOptions } from '@/features/publish/VisibilityOptions';
import type { ReminderSetting } from '@/features/reminders/reminderPlan';
import { parseLocalTime } from '@/features/reminders/reminderPlan';
import { formatTime } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import type { DaySlot } from '@/lib/jars';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';
import { useLargeText } from '@/lib/useLargeText';

import type { NotificationPrefs, PrefKey, SettingsAccount } from './useSettings';
import { PUSH_TYPES } from './useSettings';

export type SettingsViewProps = {
  insets: EdgeInsets;
  account: SettingsAccount | undefined;
  email: string | null;
  reminders: ReminderSetting[] | undefined;
  prefs: NotificationPrefs | undefined;
  blockedCount: number | undefined;
  version: string;
  failed: boolean;
  saveFailed: boolean;
  onBack: () => void;
  onRetry: () => void;
  onEditProfile: () => void;
  onReminder: (slot: DaySlot, change: { minutes?: number; enabled?: boolean }) => void;
  onPref: (key: PrefKey, value: boolean) => void;
  onVisibility: (visibility: Visibility) => void;
  onBlocked: () => void;
  onHelp: () => void;
  onLegal: () => void;
  onSignOut: () => void;
  onDelete: () => void;
};

/** A wall-clock time in the phone's locale, e.g. "7:30 PM". */
const clock = (minutes: number) => formatTime(new Date(Date.UTC(2000, 0, 1, 0, minutes)), 'UTC');

/** Settings (FR-SET-01, FR-NOT-04; design: Settings). My stickers is hidden until stickers are sold (D-6). */
export function SettingsView(props: SettingsViewProps) {
  const { t } = useTranslation();
  const { insets, account, reminders, prefs } = props;
  const large = useLargeText();
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const loading = account === undefined || reminders === undefined || prefs === undefined;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="settings-screen">
      <View style={styles.header}>
        <RoundIconButton
          icon="back"
          accessibilityLabel={t('settings.back')}
          onPress={props.onBack}
          testID="settings-back"
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('settings.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading ? (
        <View style={styles.message}>
          {props.failed ? (
            <>
              <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('settings.failed')}</Text>
              <SecondaryButton label={t('settings.retry')} onPress={props.onRetry} testID="settings-retry" />
            </>
          ) : (
            <ActivityIndicator color={colors.muted} testID="settings-loading" />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
          <Card style={styles.accountCard} testID="settings-account">
            <Avatar name={account.displayName} uri={account.avatar} size="md" decorative />
            <View style={styles.accountText}>
              <Text style={[textStyle('cardTitle', '800'), { color: colors.ink }]} numberOfLines={1}>
                {account.displayName}
              </Text>
              <Text style={[textStyle('bodySmall'), { color: colors.muted }]} numberOfLines={1}>
                {props.email
                  ? t('settings.account', { username: account.username, email: props.email })
                  : t('settings.accountNoEmail', { username: account.username })}
              </Text>
            </View>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('settings.edit')}
              accessibilityHint={t('settings.editHint')}
              onPress={props.onEditProfile}
              hitSlop={hitSlopFor(undefined, 20)}
              testID="settings-edit"
            >
              <Text style={[textStyle('bodyMedium', '700'), styles.link]}>{t('settings.edit')}</Text>
            </Pressable>
          </Card>

          {props.saveFailed ? (
            <Text
              accessibilityRole="alert"
              style={[textStyle('bodySmall', '600'), styles.error]}
              testID="settings-save-failed"
            >
              {t('settings.saveFailed')}
            </Text>
          ) : null}

          <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
            {t('settings.reminders')}
          </Text>
          <Card style={styles.listCard}>
            {reminders.map((r, i) => {
              const slot = t(`settings.slot.${r.slot}`);
              return (
                <View
                  key={r.slot}
                  style={[styles.reminderRow, large && styles.rowWrap, i < reminders.length - 1 && styles.divider]}
                  testID={`settings-reminder-${r.slot}`}
                >
                  <View style={styles.iconWell}>
                    <Icon name={r.slot} size={20} strokeWidth={1.8} />
                  </View>
                  <Text style={[textStyle('body', '600'), styles.rowLabel, large && styles.rowLabelLarge]}>{slot}</Text>
                  <SelectField
                    variant="chip"
                    label={t('settings.reminderTime', { slot })}
                    placeholder={clock(r.minutes)}
                    options={timeOptions(r.slot).map((m) => ({ value: m, label: clock(m) }))}
                    value={r.minutes}
                    onChange={(minutes) => props.onReminder(r.slot, { minutes })}
                    testID={`settings-reminder-${r.slot}-time`}
                  />
                  <Toggle
                    value={r.enabled}
                    onValueChange={(enabled) => props.onReminder(r.slot, { enabled })}
                    accessibilityLabel={t('settings.reminderToggle', { slot })}
                    testID={`settings-reminder-${r.slot}-toggle`}
                  />
                </View>
              );
            })}
          </Card>

          <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
            {t('settings.notifications')}
          </Text>
          <Card style={styles.listCard}>
            {PUSH_TYPES.map((key) => (
              <View key={key} style={[styles.switchRow, styles.divider]}>
                <Text style={[textStyle('body', '600'), styles.rowLabel]}>{t(`settings.push.${key}`)}</Text>
                <Toggle
                  value={prefs[key]}
                  onValueChange={(v) => props.onPref(key, v)}
                  accessibilityLabel={t(`settings.push.${key}`)}
                  testID={`settings-push-${key}`}
                />
              </View>
            ))}
            <View style={styles.switchRow}>
              <View style={styles.rowLabel}>
                <Text style={[textStyle('body', '600'), { color: colors.ink }]}>{t('settings.quietHours')}</Text>
                <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>
                  {t('settings.quietHoursBody', {
                    start: clock(parseLocalTime(prefs.quiet_start) ?? 22 * 60),
                    end: clock(parseLocalTime(prefs.quiet_end) ?? 7 * 60),
                  })}
                </Text>
              </View>
              <Toggle
                value={prefs.quiet_hours}
                onValueChange={(v) => props.onPref('quiet_hours', v)}
                accessibilityLabel={t('settings.quietHours')}
                testID="settings-quiet-hours"
              />
            </View>
          </Card>

          <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
            {t('settings.privacy')}
          </Text>
          <Card style={styles.listCard}>
            <ListRow
              label={t('settings.defaultVisibility')}
              value={t(`settings.visibility.${account.defaultVisibility}`)}
              accessibilityHint={t('settings.defaultVisibilityHint')}
              onPress={() => setVisibilityOpen(true)}
              testID="settings-visibility"
            />
            <ListRow
              label={t('settings.blocked')}
              value={props.blockedCount ? String(props.blockedCount) : undefined}
              onPress={props.onBlocked}
              divider={false}
              testID="settings-blocked"
            />
          </Card>

          <Text accessibilityRole="header" style={[textStyle('bodySmall', '700'), styles.section]}>
            {t('settings.accountSection')}
          </Text>
          <Card style={styles.listCard}>
            <ListRow label={t('settings.help')} onPress={props.onHelp} testID="settings-help" />
            <ListRow label={t('settings.legal')} onPress={props.onLegal} testID="settings-legal" />
            <ListRow
              label={t('settings.signOut')}
              tone="danger"
              onPress={() => setConfirmSignOut(true)}
              testID="settings-sign-out"
            />
            <ListRow
              label={t('settings.delete')}
              tone="danger"
              onPress={props.onDelete}
              divider={false}
              testID="settings-delete"
            />
          </Card>
          <Text style={[textStyle('bodySmall'), styles.version]}>
            {t('settings.version', { version: props.version })}
          </Text>
        </ScrollView>
      )}

      {account ? (
        <BottomSheet
          visible={visibilityOpen}
          onClose={() => setVisibilityOpen(false)}
          accessibilityLabel={t('settings.visibilityTitle')}
          testID="settings-visibility-sheet"
        >
          <Text accessibilityRole="header" style={[textStyle('body', '700'), { color: colors.ink }]}>
            {t('settings.visibilityTitle')}
          </Text>
          <Text style={[textStyle('label', '500'), styles.sheetBody]}>{t('settings.visibilityBody')}</Text>
          <View accessibilityRole="radiogroup">
            <VisibilityOptions
              visibility={account.defaultVisibility}
              readerCount={null}
              onChange={(v) => {
                setVisibilityOpen(false);
                if (v !== account.defaultVisibility) props.onVisibility(v);
              }}
              testIDPrefix="settings-visibility"
            />
          </View>
        </BottomSheet>
      ) : null}

      <Dialog
        visible={confirmSignOut}
        onClose={() => setConfirmSignOut(false)}
        title={t('settings.signOutTitle')}
        message={t('settings.signOutBody')}
        cancelLabel={t('settings.cancel')}
        testID="settings-sign-out-dialog"
      >
        <DangerButton
          label={t('settings.signOutConfirm')}
          onPress={() => {
            setConfirmSignOut(false);
            props.onSignOut();
          }}
          testID="settings-sign-out-confirm"
        />
      </Dialog>
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
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.sm + 2 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountText: { flex: 1, gap: 2 },
  link: { color: colors.brandLink, textDecorationLine: 'underline' },
  section: { color: colors.muted, marginTop: space.sm, marginHorizontal: space.xs },
  listCard: { paddingVertical: 2 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  // Large text: the time and switch wrap under the slot name instead of squeezing it letter by letter.
  rowWrap: { flexWrap: 'wrap', rowGap: space.sm },
  rowLabelLarge: { flexBasis: '70%' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  iconWell: {
    width: sizes.settingsIcon,
    height: sizes.settingsIcon,
    borderRadius: radius.settingsIcon,
    backgroundColor: colors.tileIconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, color: colors.ink },
  sheetBody: { color: colors.muted, marginTop: 2, marginBottom: space.xs },
  error: { color: colors.danger, marginHorizontal: space.xs },
  message: { marginTop: space.xxl, gap: space.md, paddingHorizontal: space.xl, alignItems: 'center' },
  center: { textAlign: 'center' },
  version: { color: colors.muted, textAlign: 'center', marginTop: space.sm },
});
