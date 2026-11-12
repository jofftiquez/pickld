import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton } from '@/components/BaseButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { deviceLocale } from '@/lib/format';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space } from '@/theme/tokens';

import { FollowButton } from './FollowButton';
import { compactCount, followAction, isOwnProfile, profileMoments } from './profileModel';
import { ProfileGridTile } from './ProfileGridTile';
import type { FollowList } from './useFollowList';
import type { ProfilePage } from './useProfile';

export type ProfileTab = 'jars' | 'moments';

export type ProfileViewProps = {
  /** Undefined while loading; null when the profile isn't available to this viewer. */
  data: ProfilePage | null | undefined;
  /** The request failed and nothing is cached. */
  failed?: boolean;
  insets: EdgeInsets;
  onBack: () => void;
  onOpenJar: (jarId: string) => void;
  onOpenMoment: (momentId: string, jarId: string) => void;
  /** My profile only: opens Edit profile. */
  onEditProfile?: () => void;
  /** Your own profile only: the gear opening Settings (design: Profile). */
  onSettings?: () => void;
  /** Other profile only: Read / Read back starts reading, Reading stops (FR-SOC-07). */
  onToggleReading?: () => void;
  /** A follow request is in flight. */
  followBusy?: boolean;
  /** Opens Readers & authors on that list. */
  onOpenList?: (list: FollowList) => void;
  onShare: () => void;
  /** More options on someone else's profile: Report (M3-21). */
  onMore?: () => void;
  onRetry: () => void;
  locale?: string;
};

const MAX_MOMENTS = slots.length;
const GRID_COLUMNS = 3;
const GRID_GAP = space.sm - 2;
const GRID_PADDING = space.xl;

function formatTileDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/**
 * My profile and Other profile (Profile, ProfileOther; FR-SOC-08): cover, avatar, name, @username,
 * "Reads you", bio, readers / authors / jars counts and a Jars / Moments switch over a 3-column grid.
 */
export function ProfileView({
  data,
  failed = false,
  insets,
  onBack,
  onOpenJar,
  onOpenMoment,
  onEditProfile,
  onSettings,
  onToggleReading,
  followBusy = false,
  onOpenList,
  onShare,
  onMore,
  onRetry,
  locale = deviceLocale(),
}: ProfileViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<ProfileTab>('jars');

  const backButton = (
    <RoundIconButton
      icon="back"
      variant={data ? 'glass' : 'light'}
      accessibilityLabel={t('profile.back')}
      onPress={onBack}
      testID="profile-back"
    />
  );

  if (!data) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]} testID="profile-screen">
        <View style={[styles.topBar, { top: insets.top + space.md }]}>{backButton}</View>
        {data === undefined && !failed ? (
          <ActivityIndicator color={colors.muted} testID="profile-loading" />
        ) : (
          <View style={styles.message}>
            <Text
              accessibilityRole="header"
              style={[textStyle('sectionTitle'), styles.centerText, { color: colors.ink }]}
            >
              {failed ? t('profile.failed') : t('profile.unavailableTitle')}
            </Text>
            {failed ? (
              <SecondaryButton label={t('profile.retry')} onPress={onRetry} testID="profile-retry" />
            ) : (
              <Text
                style={[textStyle('body'), styles.centerText, { color: colors.muted }]}
                testID="profile-unavailable"
              >
                {t('profile.unavailableBody')}
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  const { profile, relationship, jars } = data;
  const isOwner = isOwnProfile(data);
  const tileWidth = (width - 2 * GRID_PADDING - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  const counts = [
    { key: 'readers', n: profile.reader_count },
    { key: 'authors', n: profile.author_count },
    { key: 'jars', n: profile.jar_count },
  ] as const;
  const moments = tab === 'moments' ? profileMoments(jars) : [];
  const empty = tab === 'jars' ? jars.length === 0 : moments.length === 0;

  return (
    <View style={styles.screen} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.cover, { height: sizes.profileCover + insets.top }]} testID="profile-cover">
          {data.images?.cover ? (
            <Image
              source={{ uri: data.images.cover }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
              testID="profile-cover-photo"
            />
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.avatarRow}>
            <Avatar
              name={profile.display_name}
              uri={data.images?.avatar}
              size="xl"
              ring
              decorative
              testID="profile-avatar"
            />
            <View style={styles.actions}>
              {isOwner && onEditProfile ? (
                <BaseButton
                  label={t('profile.edit')}
                  onPress={onEditProfile}
                  testID="profile-edit"
                  tone={{
                    background: 'surface',
                    border: 'border',
                    text: 'ink',
                    height: sizes.profileButton,
                    textVariant: 'bodySmall',
                    textWeight: '700',
                    paddingHorizontal: space.lg,
                    stretch: false,
                  }}
                />
              ) : null}
              {!isOwner && onToggleReading ? (
                <FollowButton
                  action={followAction(relationship)}
                  name={profile.display_name}
                  onPress={onToggleReading}
                  disabled={followBusy}
                  testID="profile-follow"
                />
              ) : null}
              <RoundIconButton
                icon="share"
                accessibilityLabel={t('profile.share')}
                accessibilityHint={t('profile.shareHint')}
                onPress={onShare}
                testID="profile-share"
              />
              {!isOwner && onMore ? (
                <RoundIconButton
                  icon="more"
                  accessibilityLabel={t('report.more')}
                  onPress={onMore}
                  testID="profile-more"
                />
              ) : null}
            </View>
          </View>
          <View style={styles.names}>
            <View style={styles.nameRow}>
              <Text
                accessibilityRole="header"
                style={[textStyle('profileName'), styles.name, { color: colors.ink }]}
                testID="profile-name"
              >
                {profile.display_name}
              </Text>
              {!isOwner && relationship.readsYou ? (
                <View style={styles.readsYou} testID="profile-reads-you">
                  <Text style={[textStyle('caption'), { color: colors.brandText }]}>{t('profile.readsYou')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[textStyle('bodySmall'), { color: colors.muted }]} testID="profile-username">
              {t('profile.username', { username: profile.username })}
            </Text>
          </View>
          {profile.bio?.trim() ? (
            <Text style={[textStyle('bodyMedium'), styles.bio]} testID="profile-bio">
              {profile.bio.trim()}
            </Text>
          ) : null}
          <View style={styles.counts}>
            {counts.map(({ key, n }) => {
              const c = compactCount(n, locale);
              const value = c.thousands ? t('profile.thousands', { value: c.value }) : c.value;
              const content = (
                <>
                  <Text style={[textStyle('cardTitle', '800'), { color: colors.ink }]}>{value}</Text>
                  <Text style={[textStyle('label', '500'), { color: colors.muted }]}>{t(`profile.${key}`)}</Text>
                </>
              );
              const label = t(`profile.${key}A11y`, { count: n });
              return key !== 'jars' && onOpenList ? (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={t('profile.openListHint')}
                  onPress={() => onOpenList(key)}
                  style={styles.count}
                  testID={`profile-count-${key}`}
                >
                  {content}
                </Pressable>
              ) : (
                <View
                  key={key}
                  accessible
                  accessibilityLabel={label}
                  style={styles.count}
                  testID={`profile-count-${key}`}
                >
                  {content}
                </View>
              );
            })}
          </View>
          <SegmentedControl
            segments={[
              { key: 'jars', label: t('profile.tabJars') },
              { key: 'moments', label: t('profile.tabMoments') },
            ]}
            selected={tab}
            onSelect={setTab}
            accessibilityLabel={t('profile.sections')}
            testID="profile-tabs"
          />
          {empty ? (
            <Text style={[textStyle('body'), styles.empty]} testID="profile-empty">
              {isOwner ? t('profile.emptyMine') : t('profile.emptyOther', { name: profile.display_name })}
            </Text>
          ) : (
            <View style={styles.grid} testID={`profile-grid-${tab}`}>
              {tab === 'jars'
                ? jars.map(({ jar, count, cover }) => {
                    const date = formatTileDate(jar.local_date, locale);
                    return (
                      <ProfileGridTile
                        key={jar.id}
                        uri={cover.thumbUrl}
                        width={tileWidth}
                        title={date}
                        detail={t('profile.jarCount', { count, max: MAX_MOMENTS })}
                        accessibilityLabel={t('profile.jarTile', { date, count, max: MAX_MOMENTS })}
                        accessibilityHint={t('profile.openJarHint')}
                        onPress={() => onOpenJar(jar.id)}
                        testID={`profile-jar-${jar.local_date}`}
                      />
                    );
                  })
                : moments.map(({ jar, moment }) => {
                    const slot = t(`slots.${moment.slot}`);
                    const date = formatTileDate(jar.local_date, locale);
                    return (
                      <ProfileGridTile
                        key={moment.id}
                        uri={moment.thumbUrl}
                        width={tileWidth}
                        title={slot}
                        detail={date}
                        accessibilityLabel={t('profile.momentTile', { slot, date })}
                        accessibilityHint={t('profile.openMomentHint')}
                        onPress={() => onOpenMoment(moment.id, jar.id)}
                        testID={`profile-moment-${moment.id}`}
                      />
                    );
                  })}
            </View>
          )}
        </View>
      </ScrollView>
      <View style={[styles.topBar, { top: insets.top + space.xl }]} pointerEvents="box-none">
        {backButton}
        {isOwner && onSettings ? (
          <RoundIconButton
            icon="settings"
            variant="glass"
            accessibilityLabel={t('settings.open')}
            onPress={onSettings}
            testID="profile-settings"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  message: { gap: space.md, alignItems: 'center', paddingHorizontal: space.xxl },
  centerText: { textAlign: 'center' },
  cover: { backgroundColor: colors.brandTint },
  body: {
    marginTop: -sizes.profileAvatarOverlap,
    paddingHorizontal: GRID_PADDING,
    gap: space.sm + 2,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.xs },
  names: { gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  name: { flexShrink: 1 },
  readsYou: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    backgroundColor: colors.brandTint,
  },
  bio: { color: colors.inkSoft, lineHeight: 20 },
  counts: { flexDirection: 'row', gap: space.xl },
  count: { minHeight: sizes.minTap, justifyContent: 'center' },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: space.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
});
