import { Image } from 'expo-image';
import type { TFunction } from 'i18next';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { BaseButton } from '@/components/BaseButton';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { parseEdits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import type { JarMoment } from '@/features/jar/jarPage';
import { phoneTimeZone } from '@/features/jar/useToday';
import { deviceLocale, formatDate, formatShortDate } from '@/lib/format';
import { addDays, localDateIn } from '@/lib/jars';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, slots, space } from '@/theme/tokens';

import { FollowButton } from './FollowButton';
import { compactCount, followAction, isOwnProfile, profileMomentDays, profileMoments } from './profileModel';
import { ProfileGridTile } from './ProfileGridTile';
import type { FollowList } from './useFollowList';
import type { ProfilePage } from './useProfile';
import { photoSource } from '@/lib/image/photoCache';

export type ProfileTab = 'jars' | 'moments';

export type ProfileViewProps = {
  /** A first-time guide tip (FR-ONB-10), under the Read button. */
  guideTip?: ReactNode;
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
  /** Your own profile only: the Stickers row opening the Stickers page (D-61). */
  onOpenStickers?: () => void;
  /** Your own profile only: the Invite friends row opening the Invite page (INV-07). */
  onOpenInvite?: () => void;
  /** Codes left to give, shown on the Invite friends row. */
  invitesLeft?: number;
  /** Your own profile only: Add a moment on an empty grid opens the camera (D-87). */
  onAddMoment?: () => void;
  /** Other profile only: Read / Read back starts reading, Reading stops (FR-SOC-07). */
  onToggleReading?: () => void;
  /** Mute or unmute someone the viewer reads (0151). */
  onToggleMute?: () => void;
  muteBusy?: boolean;
  /** A follow request is in flight. */
  followBusy?: boolean;
  /** Opens Readers & authors on that list. */
  onOpenList?: (list: FollowList) => void;
  onShare: () => void;
  /** More options on someone else's profile: Report (M3-21). */
  onMore?: () => void;
  onRetry: () => void;
  locale?: string;
  /** Today in the phone's zone (YYYY-MM-DD), for the Today and Yesterday day headers; defaults to now. */
  today?: string;
};

const MAX_MOMENTS = slots.length;
const GRID_COLUMNS = 3;
const GRID_GAP = space.sm - 2;
const GRID_PADDING = space.xl;

/** A tile's auto stamps: capture time in the jar's zone (D-96). */
function stampOf(moment: Pick<JarMoment, 'captured_at' | 'added_at'>, tz: string): StampMoment {
  return { capturedAt: new Date(moment.captured_at ?? moment.added_at), tz };
}

function formatTileDate(localDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${localDate}T12:00:00Z`),
  );
}

/**
 * A day header on the Moments tab, as the in-app gallery labels its days: Today, Yesterday, "Fri, Nov 13",
 * or "Nov 13, 2023" for an earlier year. The date is the jar's own calendar date, whatever the phone zone.
 */
function dayHeaderLabel(localDate: string, today: string, locale: string, t: TFunction): string {
  if (localDate === today) return t('profile.dayToday');
  if (localDate === addDays(today, -1)) return t('profile.dayYesterday');
  const date = new Date(`${localDate}T12:00:00Z`);
  return localDate.slice(0, 4) === today.slice(0, 4)
    ? formatShortDate(date, 'UTC', locale)
    : formatDate(date, 'UTC', locale);
}

/**
 * My profile and Other profile (Profile, ProfileOther; FR-SOC-08): cover, avatar, name and @username with
 * "Reads you" beside the readers / authors / jars counts (D-142), bio, and a Jars / Moments switch over a
 * 3-column grid. The Moments tab groups its tiles under a header per day (D-146).
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
  onOpenStickers,
  onOpenInvite,
  invitesLeft,
  onAddMoment,
  onToggleReading,
  onToggleMute,
  muteBusy = false,
  followBusy = false,
  onOpenList,
  onShare,
  onMore,
  onRetry,
  locale = deviceLocale(),
  today: todayProp,
  guideTip = null,
}: ProfileViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const large = useLargeText();
  const [tab, setTab] = useState<ProfileTab>('jars');
  const [nowToday] = useState(() => localDateIn(new Date(), phoneTimeZone()));
  const today = todayProp ?? nowToday;

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
  const momentDays = profileMomentDays(moments);
  const empty = tab === 'jars' ? jars.length === 0 : moments.length === 0;

  return (
    <View style={styles.screen} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }}>
        <View style={[styles.cover, { height: sizes.profileCover + insets.top }]} testID="profile-cover">
          {data.images?.cover ? (
            <Image
              source={photoSource(data.images.cover)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible={false}
              testID="profile-cover-photo"
            />
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={[styles.avatarRow, large && styles.avatarRowLarge]}>
            <Avatar
              name={profile.display_name}
              uri={data.images?.avatar}
              size="xl"
              ring
              decorative
              testID="profile-avatar"
            />
            <View style={[styles.actions, large && styles.actionsLarge]} testID="profile-actions">
              {isOwner && onEditProfile ? (
                // BaseButton (also under FollowButton) pins itself to the top (`alignSelf: flex-start`)
                // unless it stretches; the wrapper is what the row centres, so the pill's middle sits on
                // the cover edge like the round buttons (D-79).
                <View>
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
                </View>
              ) : null}
              {!isOwner && onToggleReading ? (
                <View>
                  <FollowButton
                    action={followAction(relationship)}
                    name={profile.display_name}
                    onPress={onToggleReading}
                    disabled={followBusy}
                    testID="profile-follow"
                  />
                </View>
              ) : null}
              {!isOwner && relationship.reading && onToggleMute ? (
                <RoundIconButton
                  icon={relationship.muted ? 'eye' : 'eyeOff'}
                  accessibilityLabel={t(relationship.muted ? 'profile.unmute' : 'profile.mute', {
                    name: profile.display_name,
                  })}
                  accessibilityHint={t(relationship.muted ? 'profile.unmuteHint' : 'profile.muteHint')}
                  onPress={onToggleMute}
                  disabled={muteBusy}
                  testID="profile-mute"
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
          {guideTip ? <View style={styles.guideTip}>{guideTip}</View> : null}
          {/* The name and @handle share a row with the counts (D-142). The row wraps on the name column's
              natural width: a short name keeps the counts on its right, a long name or large text pushes
              them under it. */}
          <View style={styles.headerRow} testID="profile-header-row">
            <View style={styles.names}>
              <Text
                accessibilityRole="header"
                style={[textStyle('profileName'), { color: colors.ink }]}
                testID="profile-name"
              >
                {profile.display_name}
              </Text>
              <View style={styles.handleRow}>
                <Text style={[textStyle('bodySmall'), styles.handle]} testID="profile-username">
                  {t('profile.username', { username: profile.username })}
                </Text>
                {!isOwner && relationship.muted ? (
                  <View style={styles.muted} testID="profile-muted">
                    <Text style={[textStyle('caption'), { color: colors.muted }]}>{t('profile.muted')}</Text>
                  </View>
                ) : null}
                {!isOwner && relationship.readsYou ? (
                  <View style={styles.readsYou} testID="profile-reads-you">
                    <Text style={[textStyle('caption'), { color: colors.brandText }]}>{t('profile.readsYou')}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.counts} testID="profile-counts">
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
          </View>
          {profile.bio?.trim() ? (
            <Text style={[textStyle('bodyMedium'), styles.bio]} testID="profile-bio">
              {profile.bio.trim()}
            </Text>
          ) : null}
          {isOwner && (onOpenStickers || onOpenInvite) ? (
            <Card style={styles.rowCard}>
              {onOpenInvite ? (
                <ListRow
                  label={t('invite.rowTitle')}
                  value={invitesLeft === undefined ? undefined : t('invite.rowLeft', { count: invitesLeft })}
                  onPress={onOpenInvite}
                  divider={onOpenStickers !== undefined}
                  testID="profile-invite"
                />
              ) : null}
              {onOpenStickers ? (
                <ListRow
                  label={t('profile.stickers')}
                  accessibilityHint={t('profile.stickersHint')}
                  onPress={onOpenStickers}
                  divider={false}
                  testID="profile-stickers"
                />
              ) : null}
            </Card>
          ) : null}
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
            <EmptyState
              illustration={tab === 'jars' ? 'jar' : 'photo'}
              title={
                !isOwner
                  ? t('profile.emptyTitleOther')
                  : tab === 'jars'
                    ? t('profile.emptyJarsTitleMine')
                    : t('profile.emptyMomentsTitleMine')
              }
              body={
                isOwner
                  ? tab === 'jars'
                    ? t('profile.emptyMine')
                    : t('profile.emptyMomentsMine')
                  : tab === 'jars'
                    ? t('profile.emptyOther', { name: profile.display_name })
                    : t('profile.emptyMomentsOther', { name: profile.display_name })
              }
              action={
                isOwner && onAddMoment
                  ? {
                      label: t('profile.addMoment'),
                      accessibilityHint: t('profile.addMomentHint'),
                      onPress: onAddMoment,
                      testID: 'profile-add-moment',
                    }
                  : undefined
              }
              testID="profile-empty"
            />
          ) : tab === 'jars' ? (
            <View style={styles.grid} testID="profile-grid-jars">
              {jars.map(({ jar, count, cover }) => {
                const date = formatTileDate(jar.local_date, locale);
                return (
                  <ProfileGridTile
                    key={jar.id}
                    uri={cover.thumbUrl}
                    edits={parseEdits(cover.edits)}
                    stamp={stampOf(cover, jar.tz)}
                    width={tileWidth}
                    title={date}
                    detail={t('profile.jarCount', { count, max: MAX_MOMENTS })}
                    accessibilityLabel={t('profile.jarTile', { date, count, max: MAX_MOMENTS })}
                    accessibilityHint={t('profile.openJarHint')}
                    onPress={() => onOpenJar(jar.id)}
                    testID={`profile-jar-${jar.local_date}`}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.days} testID="profile-grid-moments">
              {momentDays.map(({ localDate, moments: dayMoments }) => (
                <View key={localDate} style={styles.day} testID={`profile-day-${localDate}`}>
                  <Text
                    style={[textStyle('bodySmall', '700'), styles.dayHeader]}
                    accessibilityRole="header"
                    testID={`profile-day-header-${localDate}`}
                  >
                    {dayHeaderLabel(localDate, today, locale, t)}
                  </Text>
                  <View style={styles.grid}>
                    {dayMoments.map(({ jar, moment }) => {
                      const slot = t(`slots.${moment.slot}`);
                      const date = formatTileDate(jar.local_date, locale);
                      return (
                        <ProfileGridTile
                          key={moment.id}
                          uri={moment.thumbUrl}
                          edits={parseEdits(moment.edits)}
                          stamp={stampOf(moment, jar.tz)}
                          width={tileWidth}
                          title={slot}
                          accessibilityLabel={t('profile.momentTile', { slot, date })}
                          accessibilityHint={t('profile.openMomentHint')}
                          onPress={() => onOpenMoment(moment.id, jar.id)}
                          testID={`profile-moment-${moment.id}`}
                        />
                      );
                    })}
                  </View>
                </View>
              ))}
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
  guideTip: { marginTop: space.sm },
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
  // The buttons straddle the cover's bottom edge at their middle (D-79): the row starts where the avatar
  // does, `profileAvatarOverlap` above that edge, and is twice that tall (the avatar's own height), so
  // centring the buttons in it puts their middle on the edge without moving the name below.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.sm,
    height: sizes.profileAvatarOverlap * 2,
  },
  // Large text: the grown Edit profile or Read pill no longer fits beside the avatar and pushed Share off the
  // right edge, so the buttons move under the avatar and wrap.
  avatarRowLarge: { flexDirection: 'column', alignItems: 'flex-start', gap: space.sm },
  actionsLarge: { height: undefined, alignSelf: 'stretch', flexWrap: 'wrap' },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: space.lg,
    rowGap: space.xs,
  },
  // Natural width first (so the row knows when to wrap), then shrinks to the line so a long name wraps.
  names: { flexGrow: 1, flexShrink: 1, gap: 2 },
  handleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: space.sm, rowGap: 2 },
  handle: { color: colors.muted, flexShrink: 1 },
  readsYou: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    backgroundColor: colors.brandTint,
  },
  muted: {
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    backgroundColor: colors.subtle,
  },
  bio: { color: colors.inkSoft, lineHeight: 20 },
  // Wraps at large text, so "Jars" moves to a second line instead of running off the right edge.
  counts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm },
  count: { minHeight: sizes.minTap, justifyContent: 'center' },
  rowCard: { paddingVertical: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  days: { gap: space.lg },
  day: { gap: space.sm },
  dayHeader: { color: colors.ink },
});
