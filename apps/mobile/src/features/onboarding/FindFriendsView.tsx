import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { FollowButton } from '@/features/profile/FollowButton';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import type { FriendMatch } from './findFriends';
import { SetupProgress } from './SetupProgress';

/** `idle`: not searched yet; `matched`: searched (the list may be empty). */
export type FindState = 'idle' | 'finding' | 'matched' | 'denied' | 'failed';

export type FindFriendsViewProps = {
  insets: EdgeInsets;
  /** "pickld.me/dale", shown and shared. */
  link: string;
  state: FindState;
  /** The invite link was just copied. */
  copied: boolean;
  matches: readonly FriendMatch[];
  onFind: () => void;
  onOpenSettings: () => void;
  onInvite: () => void;
  onRead: (match: FriendMatch) => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack?: () => void;
};

/** Find friends (FR-ONB-06): contact matches with Read, the invite link, and Skip. */
export function FindFriendsView({
  insets,
  link,
  state,
  copied,
  matches,
  onFind,
  onOpenSettings,
  onInvite,
  onRead,
  onContinue,
  onSkip,
  onBack,
}: FindFriendsViewProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.screen} testID="friends-screen">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        {onBack ? (
          <RoundIconButton icon="back" accessibilityLabel={t('setup.back')} onPress={onBack} testID="friends-back" />
        ) : (
          <View style={styles.backSpace} />
        )}
        <SetupProgress step={6} />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[textStyle('onboardTitle'), { color: colors.ink }]}>
            {t('setup.friends.title')}
          </Text>
          <Text style={[textStyle('body'), styles.body]}>{t('setup.friends.body')}</Text>
        </View>
        <Card style={styles.card} testID="friends-find-card">
          <View style={[styles.icon, { backgroundColor: colors.brandTint }]}>
            <Icon name="selfie" color="brandText" size={22} />
          </View>
          <View style={styles.text}>
            <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('setup.friends.find')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>{t('setup.friends.findBody')}</Text>
          </View>
          {state === 'denied' ? (
            <PillButton
              variant="subtle"
              label={t('setup.friends.settings')}
              onPress={onOpenSettings}
              testID="friends-settings"
            />
          ) : (
            <PillButton
              label={state === 'finding' ? t('setup.friends.finding') : t('setup.friends.findAction')}
              accessibilityLabel={t('setup.friends.findLabel')}
              onPress={onFind}
              disabled={state === 'finding'}
              testID="friends-find"
            />
          )}
        </Card>
        <Card style={styles.card} testID="friends-invite-card">
          <View style={[styles.icon, { backgroundColor: colors.tileIconWell }]}>
            <Icon name="link" color="ink" size={22} />
          </View>
          <View style={styles.text}>
            <Text style={[textStyle('cardTitle'), { color: colors.ink }]}>{t('setup.friends.invite')}</Text>
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]} testID="friends-link">
              {link}
            </Text>
            {copied ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[textStyle('bodySmall', '600'), { color: colors.brandLink }]}
                testID="friends-copied"
              >
                {t('setup.friends.copied')}
              </Text>
            ) : null}
          </View>
          <PillButton
            variant="subtle"
            label={t('setup.friends.copy')}
            accessibilityLabel={t('setup.friends.copyLabel', { link })}
            onPress={onInvite}
            testID="friends-invite"
          />
        </Card>
        {state === 'denied' || state === 'failed' ? (
          <Text accessibilityRole="alert" style={[textStyle('bodySmall', '600'), { color: colors.danger }]}>
            {t(state === 'denied' ? 'setup.friends.denied' : 'setup.friends.failed')}
          </Text>
        ) : null}
        {state === 'matched' ? (
          matches.length === 0 ? (
            <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]} testID="friends-none">
              {t('setup.friends.none')}
            </Text>
          ) : (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>
                {t('setup.friends.already')}
              </Text>
              <Card testID="friends-matches">
                {matches.map((m, i) => (
                  <Fragment key={m.id}>
                    {i > 0 ? <View style={styles.divider} /> : null}
                    <View style={styles.row} testID={`friends-match-${m.username}`}>
                      <Avatar name={m.displayName} uri={m.avatarUrl} size="notify" decorative />
                      <View style={styles.text}>
                        <Text style={[textStyle('body', '600'), { color: colors.ink }]}>{m.displayName}</Text>
                        <Text style={[textStyle('bodySmall'), { color: colors.inkSoft }]}>
                          {t('setup.friends.inContacts')}
                        </Text>
                      </View>
                      <FollowButton
                        action={m.reading ? 'reading' : 'read'}
                        name={m.displayName}
                        onPress={() => onRead(m)}
                        testID={`friends-read-${m.username}`}
                      />
                    </View>
                  </Fragment>
                ))}
              </Card>
            </View>
          )
        ) : null}
        <View style={styles.spacer} />
        <PrimaryButton label={t('setup.friends.continue')} onPress={onContinue} testID="friends-continue" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('setup.friends.skip')}
          onPress={onSkip}
          hitSlop={hitSlopFor(undefined, 24)}
          style={styles.skip}
          testID="friends-skip"
        >
          <Text style={[textStyle('bodyMedium', '700'), { color: colors.muted }]}>{t('setup.friends.skip')}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  section: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: space.sm },
  spacer: { flex: 1, minHeight: space.md },
  skip: { alignItems: 'center', paddingVertical: space.xs },
});
