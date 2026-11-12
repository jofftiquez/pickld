import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton, PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { JarGraphic } from '@/components/JarGraphic';
import { RoundIconButton } from '@/components/RoundIconButton';
import { TextField } from '@/components/TextField';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, lidColors, radius, sizes, space } from '@/theme/tokens';

import { BIO_MAX, formProblems, type EditForm, type SaveError, type UsernameStatus } from './editProfileModel';

export type EditProfileViewProps = {
  form: EditForm;
  onChange: (patch: Partial<EditForm>) => void;
  usernameStatus: UsernameStatus;
  /** Shown photos: the new local file once picked, else the current signed URL. */
  avatarUri: string | null;
  coverUri: string | null;
  uploading: { avatar: boolean; cover: boolean };
  canSave: boolean;
  saving: boolean;
  saveError: SaveError | 'upload' | null;
  insets: EdgeInsets;
  onCancel: () => void;
  onSave: () => void;
  onChangeAvatar: () => void;
  onChangeCover: () => void;
};

const STATUS_TONE: Record<UsernameStatus, keyof typeof colors> = {
  unchanged: 'muted',
  checking: 'muted',
  available: 'brandText',
  taken: 'danger',
  reserved: 'danger',
  invalid: 'danger',
};

/**
 * Edit profile (EditProfile; FR-SOC-11, FR-ACC-03, FR-ONB-04): Cancel and Save, the cover with Change
 * cover, the avatar with a camera badge, Name, Username with live availability, Bio with a counter, and
 * the jar lid colours next to a jar wearing the chosen lid.
 */
export function EditProfileView({
  form,
  onChange,
  usernameStatus,
  avatarUri,
  coverUri,
  uploading,
  canSave,
  saving,
  saveError,
  insets,
  onCancel,
  onSave,
  onChangeAvatar,
  onChangeCover,
}: EditProfileViewProps) {
  const { t } = useTranslation();
  const [avatarPressed, setAvatarPressed] = useState(false);
  const nameProblem = formProblems(form, 'unchanged').find((p) => p === 'nameEmpty' || p === 'nameTooLong');
  const statusText =
    usernameStatus === 'unchanged'
      ? null
      : t(`editProfile.username.${usernameStatus}`, { username: form.username.trim() });

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="edit-profile"
    >
      <View style={styles.header}>
        <RoundIconButton
          icon="close"
          accessibilityLabel={t('editProfile.cancel')}
          onPress={onCancel}
          testID="edit-profile-cancel"
        />
        <Text accessibilityRole="header" style={[textStyle('cropTitle'), { color: colors.ink }]}>
          {t('editProfile.title')}
        </Text>
        <BaseButton
          label={saving ? t('editProfile.saving') : t('editProfile.save')}
          onPress={onSave}
          disabled={!canSave || saving}
          testID="edit-profile-save"
          tone={{
            background: 'brand',
            text: 'surface',
            height: sizes.profileButton,
            textVariant: 'bodyMedium',
            textWeight: '800',
            paddingHorizontal: space.lg,
            stretch: false,
          }}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cover} testID="edit-profile-cover">
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          ) : null}
          <View style={styles.changeCoverWrap}>
            <BaseButton
              label={t('editProfile.changeCover')}
              icon="gallery"
              onPress={onChangeCover}
              disabled={uploading.cover}
              testID="edit-profile-change-cover"
              tone={{
                background: 'scrim',
                text: 'surface',
                height: sizes.changeCover,
                textVariant: 'label',
                textWeight: '700',
                paddingHorizontal: space.md,
                stretch: false,
                icon: { size: 14, strokeWidth: 2 },
              }}
            />
          </View>
          {uploading.cover ? <ActivityIndicator color={colors.surface} style={styles.coverSpinner} /> : null}
        </View>
        <View style={styles.avatarRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('editProfile.changeAvatar')}
            accessibilityState={{ disabled: uploading.avatar, busy: uploading.avatar }}
            disabled={uploading.avatar}
            onPress={onChangeAvatar}
            onPressIn={() => setAvatarPressed(true)}
            onPressOut={() => setAvatarPressed(false)}
            style={avatarPressed ? { opacity: PRESSED_OPACITY } : null}
            testID="edit-profile-change-avatar"
          >
            <Avatar name={form.displayName || form.username} uri={avatarUri} size="edit" ring decorative />
            <View style={styles.avatarBadge}>
              {uploading.avatar ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <Icon name="capture" color="surface" size={14} strokeWidth={2.2} />
              )}
            </View>
          </Pressable>
        </View>
        <View style={styles.fields}>
          <View style={styles.usernameField}>
            <TextField
              label={t('editProfile.name')}
              value={form.displayName}
              onChangeText={(displayName) => onChange({ displayName })}
              autoComplete="name"
              testID="edit-profile-name"
            />
            {nameProblem ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[textStyle('label', '600'), { color: colors.danger }]}
                testID="edit-profile-name-problem"
              >
                {t(`editProfile.${nameProblem}`)}
              </Text>
            ) : null}
          </View>
          <View style={styles.usernameField}>
            <TextField
              label={t('editProfile.usernameLabel')}
              value={form.username}
              onChangeText={(username) => onChange({ username })}
              autoCapitalize="none"
              autoComplete="username"
              testID="edit-profile-username"
            />
            {statusText ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[textStyle('label', '600'), { color: colors[STATUS_TONE[usernameStatus]] }]}
                testID={`edit-profile-username-${usernameStatus}`}
              >
                {statusText}
              </Text>
            ) : null}
          </View>
          <TextField
            label={t('editProfile.bio')}
            value={form.bio}
            onChangeText={(bio) => onChange({ bio })}
            maxLength={BIO_MAX}
            multiline
            testID="edit-profile-bio"
          />
          <View style={styles.lidSection}>
            <Text style={[textStyle('label'), { color: colors.muted }]}>{t('editProfile.lid')}</Text>
            <View style={styles.lidRow} accessibilityRole="radiogroup" accessibilityLabel={t('editProfile.lid')}>
              <JarGraphic count={3} size={sizes.lidJar} lidColor={form.lidColor} decorative />
              {(Object.entries(lidColors) as [keyof typeof lidColors, string][]).map(([name, color]) => {
                const selected = form.lidColor === color;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="radio"
                    accessibilityLabel={t(`editProfile.lids.${name}`)}
                    accessibilityState={{ selected, checked: selected }}
                    hitSlop={hitSlopFor(sizes.lidChoice, sizes.lidChoice)}
                    onPress={() => onChange({ lidColor: color })}
                    style={[styles.lidChoice, { backgroundColor: color }, selected ? styles.lidSelected : null]}
                    testID={`edit-profile-lid-${name}`}
                  />
                );
              })}
            </View>
          </View>
          {saveError ? (
            <Text
              accessibilityLiveRegion="assertive"
              style={[textStyle('bodySmall', '600'), { color: colors.danger }]}
              testID="edit-profile-error"
            >
              {t(`editProfile.errors.${saveError}`)}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xxl,
    paddingBottom: space.md,
  },
  cover: {
    marginHorizontal: space.xl,
    height: sizes.editCover,
    borderRadius: radius.tile,
    overflow: 'hidden',
    backgroundColor: colors.brandTint,
  },
  changeCoverWrap: { position: 'absolute', right: space.sm + 2, bottom: space.sm + 2 },
  coverSpinner: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  avatarRow: {
    marginTop: -sizes.editAvatarOverlap,
    paddingLeft: space.xxl + space.md,
    flexDirection: 'row',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: sizes.avatarEditBadge,
    height: sizes.avatarEditBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fields: { paddingHorizontal: space.xl, paddingTop: space.md + 2, gap: space.md },
  usernameField: { gap: space.xs },
  lidSection: { gap: space.sm },
  lidRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  lidChoice: { width: sizes.lidChoice, height: sizes.lidChoice, borderRadius: radius.lidChoice },
  lidSelected: { borderWidth: sizes.lidRing, borderColor: colors.ink },
});
