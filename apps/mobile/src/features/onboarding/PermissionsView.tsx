import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import { PERMISSIONS, type PermissionKind, type PermissionState } from './permissions';
import { SetupProgress } from './SetupProgress';

const ICON = { camera: 'capture', photos: 'photo', notifications: 'bell' } as const;

export type PermissionsViewProps = {
  insets: EdgeInsets;
  /** null while the current state is being read. */
  states: Record<PermissionKind, PermissionState | null>;
  /** The enabled reminder times, already formatted ("8:30 AM"), earliest first. */
  times: readonly string[];
  onAllow: (kind: PermissionKind) => void;
  onContinue: () => void;
  onLater: () => void;
  onBack?: () => void;
};

/** Permissions (FR-ONB-05): one reason card each for Camera, Photos and Notifications. */
export function PermissionsView({ insets, states, times, onAllow, onContinue, onLater, onBack }: PermissionsViewProps) {
  const { t } = useTranslation();
  const timeList =
    times.length > 1 ? `${times.slice(0, -1).join(', ')} ${t('setup.permissions.and')} ${times.at(-1)}` : times[0];
  const reason: Record<PermissionKind, string> = {
    camera: t('setup.permissions.cameraBody'),
    photos: t('setup.permissions.photosBody'),
    notifications: timeList
      ? t('setup.permissions.notificationsBody', { times: timeList })
      : t('setup.permissions.notificationsBodyNoTimes'),
  };
  return (
    <View style={styles.screen} testID="permissions-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {onBack ? (
          <RoundIconButton
            icon="back"
            accessibilityLabel={t('setup.back')}
            onPress={onBack}
            testID="permissions-back"
          />
        ) : (
          <View style={styles.backSpace} />
        )}
        <SetupProgress step={5} />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[textStyle('onboardTitle'), { color: colors.ink }]}>
            {t('setup.permissions.title')}
          </Text>
          <Text style={[textStyle('body'), styles.body]}>{t('setup.permissions.body')}</Text>
        </View>
        {PERMISSIONS.map((kind) => {
          const name = t(`setup.permissions.${kind}`);
          const state = states[kind];
          return (
            <Card key={kind} style={styles.card} testID={`permission-${kind}`}>
              <View style={styles.icon}>
                <Icon name={ICON[kind]} color="brandText" size={22} />
              </View>
              <View style={styles.text}>
                <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{name}</Text>
                <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>{reason[kind]}</Text>
              </View>
              {state === 'granted' ? (
                <View
                  style={styles.allowed}
                  accessible
                  accessibilityLabel={t('setup.permissions.allowedLabel', { name })}
                  testID={`permission-${kind}-allowed`}
                >
                  <Icon name="check" color="brandLink" size={18} />
                  <Text style={[textStyle('bodyMedium', '700'), { color: colors.brandLink }]}>
                    {t('setup.permissions.allowed')}
                  </Text>
                </View>
              ) : state === null ? null : (
                <PillButton
                  label={state === 'ask' ? t('setup.permissions.allow') : t('setup.permissions.settings')}
                  accessibilityLabel={
                    state === 'ask'
                      ? t('setup.permissions.allowLabel', { name })
                      : t('setup.permissions.settingsLabel', { name })
                  }
                  variant={state === 'ask' ? 'primary' : 'subtle'}
                  onPress={() => onAllow(kind)}
                  testID={`permission-${kind}-allow`}
                />
              )}
            </Card>
          );
        })}
        <View style={styles.spacer} />
        <PrimaryButton label={t('setup.permissions.continue')} onPress={onContinue} testID="permissions-continue" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('setup.permissions.later')}
          onPress={onLater}
          hitSlop={hitSlopFor(undefined, 24)}
          style={styles.later}
          testID="permissions-later"
        >
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('setup.permissions.later')}</Text>
        </Pressable>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: {
    width: sizes.permissionIcon,
    height: sizes.permissionIcon,
    borderRadius: radius.permissionIcon,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  allowed: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  spacer: { flex: 1, minHeight: space.md },
  later: { alignItems: 'center', paddingVertical: space.xs },
});
