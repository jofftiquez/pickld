import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { Dialog } from '@/components/Dialog';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { PillButton } from '@/components/PillButton';
import { PrimaryButton } from '@/components/PrimaryButton';
import { RoundIconButton } from '@/components/RoundIconButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Toggle } from '@/components/Toggle';
import type { AvatarUrls } from '@/lib/avatars';
import { deviceLocale } from '@/lib/format';
import { hitSlopFor } from '@/lib/hitSlop';
import { textStyle } from '@/theme/text';
import { colors, invite, radius, shadow, sizes, space } from '@/theme/tokens';

import { InviteCard } from './InviteCard';
import { InviteQrSheet } from './InviteQrSheet';
import { available, bySet, displayUrl, invited, inviteUrl, type InviteCode, type Invites } from './invites';

/** \"Full jar of friends\" is earned at this many friends (INV-08). */
const FULL_JAR = 8;

export type InviteTab = 'available' | 'invited';

export type InviteViewProps = {
  /** Undefined while the first load runs. */
  invites: Invites | undefined;
  /** Friends' signed avatars by profile id (useAvatarUrls). */
  avatars?: AvatarUrls;
  failed?: boolean;
  busy?: boolean;
  insets: EdgeInsets;
  initialTab?: InviteTab;
  onBack: () => void;
  onRetry: () => void;
  /** Shares a code or the link as \"Join me on Pickld…\" with its pickld.me/i/ URL. */
  onShareUrl: (url: string) => void;
  onCopyUrl: (url: string) => void;
  onLinkEnabled: (enabled: boolean) => void;
  onResetLink: () => void;
  onOpenProfile: (username: string) => void;
  onAddMoment: () => void;
  onHelp: () => void;
  locale?: string;
};

/** Invite friends (INV-07; FR-INV-03; design: Invite, InviteInvited, InviteLocked, InvitePaused, InviteQR). */
export function InviteView({
  invites,
  avatars = {},
  failed = false,
  busy = false,
  insets,
  initialTab = 'available',
  onBack,
  onRetry,
  onShareUrl,
  onCopyUrl,
  onLinkEnabled,
  onResetLink,
  onOpenProfile,
  onAddMoment,
  onHelp,
  locale = deviceLocale(),
}: InviteViewProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<InviteTab>(initialTab);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [qr, setQr] = useState<InviteCode | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  let body: ReactNode;
  if (invites === undefined && failed) {
    body = (
      <View style={styles.message}>
        <Text style={[textStyle('body'), styles.center, { color: colors.muted }]}>{t('invite.failed')}</Text>
        <SecondaryButton label={t('invite.retry')} onPress={onRetry} testID="invite-retry" />
      </View>
    );
  } else if (invites === undefined) {
    body = <ActivityIndicator color={colors.muted} style={styles.message} testID="invite-loading" />;
  } else {
    const open = available(invites.codes);
    const used = invited(invites.codes);
    const sets = bySet(invites.codes);
    const card = (code: InviteCode) => (
      <InviteCard
        key={code.code}
        code={code}
        state={invites.state}
        revealed={revealed === code.code}
        onToggleReveal={() => setRevealed((r) => (r === code.code ? null : code.code))}
        onShowQr={() => setQr(code)}
        onShare={() => onShareUrl(inviteUrl(code.code))}
        onOpenProfile={onOpenProfile}
        avatarUrl={code.invitee?.profile ? (avatars[code.invitee.profile.id] ?? null) : null}
        locale={locale}
      />
    );
    body = (
      <>
        {invites.state === 'locked' ? (
          <Card style={styles.notice} testID="invite-locked">
            <IconWell icon="lock" tone="brand" />
            <Text accessibilityRole="header" style={[textStyle('cardTitle'), { color: colors.ink }]}>
              {t('invite.lockedTitle')}
            </Text>
            <Text style={[textStyle('bodyMedium'), styles.soft]}>{t('invite.lockedBody')}</Text>
            <PrimaryButton label={t('invite.addMoment')} onPress={onAddMoment} testID="invite-add-moment" />
          </Card>
        ) : invites.state === 'paused' ? (
          <Card style={styles.pausedCard} testID="invite-paused">
            <IconWell icon="lock" tone="plain" />
            <View style={styles.grow}>
              <Text accessibilityRole="header" style={[textStyle('body', '700'), { color: colors.ink }]}>
                {t('invite.pausedTitle')}
              </Text>
              <Text style={[textStyle('bodySmall'), { color: colors.muted }]}>
                {t('invite.pausedBody')}{' '}
                <Text style={styles.link} accessibilityRole="link" onPress={onHelp} testID="invite-help">
                  {t('invite.help')}
                </Text>
              </Text>
            </View>
          </Card>
        ) : tab === 'available' ? (
          <Text style={[textStyle('body'), styles.intro]} testID="invite-intro">
            {t('invite.intro')}{' '}
            <Text style={textStyle('body', '800')}>
              {t('invite.left', { left: open.length, total: invites.codes.length })}
            </Text>{' '}
            {t('invite.leftAfter')}
          </Text>
        ) : (
          <Text style={[textStyle('body'), styles.intro]}>{t('invite.invitedIntro')}</Text>
        )}

        {invites.state === 'open' && invites.link && tab === 'available' ? (
          <Card style={styles.linkCard} testID="invite-link">
            <View style={styles.linkRow}>
              <IconWell icon="link" tone="brand" />
              <View style={styles.grow}>
                <Text style={[textStyle('body', '700'), { color: colors.ink }]}>{t('invite.linkTitle')}</Text>
                <Text style={[textStyle('label', '500'), { color: colors.muted }]}>
                  {t('invite.linkBody', { url: displayUrl(inviteUrl(invites.link.id)) })}
                </Text>
              </View>
              <PillButton
                variant="subtle"
                label={t('invite.copy')}
                accessibilityLabel={t('invite.copyLink')}
                onPress={() => invites.link && onCopyUrl(inviteUrl(invites.link.id))}
                disabled={!invites.link.enabled}
                testID="invite-link-copy"
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[textStyle('bodySmall', '600'), styles.grow, { color: colors.ink }]}>
                {t(invites.link.enabled ? 'invite.linkOn' : 'invite.linkOff')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('invite.resetLink')}
                accessibilityHint={t('invite.resetHint')}
                onPress={() => setConfirmReset(true)}
                disabled={busy}
                hitSlop={hitSlopFor(undefined, 32)}
                style={styles.reset}
                testID="invite-link-reset"
              >
                <Icon name="reset" size={14} strokeWidth={2.4} color="brandLink" />
                <Text style={[textStyle('bodySmall', '700'), styles.resetText]}>{t('invite.resetLink')}</Text>
              </Pressable>
              <Toggle
                value={invites.link.enabled}
                onValueChange={onLinkEnabled}
                accessibilityLabel={t('invite.linkSwitch')}
                disabled={busy}
                testID="invite-link-switch"
              />
            </View>
          </Card>
        ) : null}

        <SegmentedControl
          segments={[
            { key: 'available', label: t('invite.tabAvailable', { count: open.length }) },
            { key: 'invited', label: t('invite.tabInvited', { count: used.length }) },
          ]}
          selected={tab}
          onSelect={setTab}
          accessibilityLabel={t('invite.tabs')}
          testID="invite-tabs"
        />

        {tab === 'available' ? (
          open.length === 0 ? (
            <Text style={[textStyle('bodyMedium'), styles.empty]} testID="invite-none-left">
              {t('invite.noneLeft')}
            </Text>
          ) : (
            sets.map(({ setNo, codes }) => {
              const left = available(codes);
              if (left.length === 0) return null;
              return (
                <View key={setNo} style={styles.set} testID={`invite-set-${setNo}`}>
                  {sets.length > 1 ? (
                    <Text accessibilityRole="header" style={[textStyle('bodyMedium', '700'), styles.setTitle]}>
                      {t('invite.setTitle', { set: setNo, left: left.length, total: codes.length })}
                    </Text>
                  ) : null}
                  <Grid>{left.map(card)}</Grid>
                </View>
              );
            })
          )
        ) : (
          <>
            {used.length === 0 ? (
              <Text style={[textStyle('bodyMedium'), styles.empty]} testID="invite-none-invited">
                {t('invite.noneInvited')}
              </Text>
            ) : (
              <Grid>{used.map(card)}</Grid>
            )}
            <Card style={styles.milestone} testID="invite-milestone">
              <View style={styles.sticker} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={[textStyle('bodySmall', '800'), { color: colors.ink }]}>{t('invite.fullJarSticker')}</Text>
              </View>
              <View style={styles.grow}>
                <Text style={[textStyle('bodySmall', '700'), { color: colors.ink }]}>
                  {used.length >= FULL_JAR
                    ? t('invite.fullJarEarned')
                    : t('invite.fullJarProgress', { count: used.length, total: FULL_JAR })}
                </Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${(Math.min(used.length, FULL_JAR) / FULL_JAR) * 100}%` }]} />
                </View>
              </View>
            </Card>
            <Text style={[textStyle('label', '500'), styles.footer]}>{t('invite.neverBack')}</Text>
          </>
        )}
      </>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="invite-screen">
      <View style={styles.header}>
        <RoundIconButton icon="back" accessibilityLabel={t('invite.back')} onPress={onBack} testID="invite-back" />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityRole="header"
          style={[textStyle('cropTitle'), styles.headerTitle, { color: colors.ink }]}
        >
          {t('invite.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        {body}
      </ScrollView>
      <InviteQrSheet code={qr} onShare={(code) => onShareUrl(inviteUrl(code.code))} onClose={() => setQr(null)} />
      <Dialog
        visible={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('invite.resetTitle')}
        message={t('invite.resetBody')}
        testID="invite-reset-dialog"
      >
        <PrimaryButton
          label={t('invite.resetLink')}
          onPress={() => {
            setConfirmReset(false);
            onResetLink();
          }}
          testID="invite-reset-confirm"
        />
      </Dialog>
    </View>
  );
}

/** Cards two to a row; an odd last card keeps its half width. */
function Grid({ children }: { children: ReactNode[] }) {
  const rows: ReactNode[][] = [];
  children.forEach((child, i) => (i % 2 === 0 ? rows.push([child]) : rows[rows.length - 1]?.push(child)));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row}
          {row.length === 1 ? <View style={styles.grow} /> : null}
        </View>
      ))}
    </View>
  );
}

function IconWell({ icon, tone }: { icon: IconName; tone: 'brand' | 'plain' }) {
  return (
    <View style={[styles.well, { backgroundColor: tone === 'brand' ? colors.brandTint : colors.tileIconWell }]}>
      <Icon name={icon} size={20} strokeWidth={2} color={tone === 'brand' ? 'brandText' : 'ink'} />
    </View>
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
  // Shrinks to fit one line at large text instead of pushing the back button off screen (D-37).
  headerTitle: { flexShrink: 1 },
  headerSpacer: { width: sizes.roundButton },
  content: { paddingHorizontal: space.xl, gap: space.md },
  intro: { color: colors.inkSoft, marginHorizontal: space.xs, lineHeight: 22 },
  soft: { color: colors.inkSoft, lineHeight: 21 },
  center: { textAlign: 'center' },
  message: { marginTop: space.xxl, gap: space.md },
  grow: { flex: 1, minWidth: 0, gap: 2 },
  link: {
    color: colors.brandLink,
    fontFamily: textStyle('bodySmall', '700').fontFamily,
    textDecorationLine: 'underline',
  },
  notice: { padding: sizes.cardPadding, gap: space.sm + 2, alignItems: 'flex-start' },
  pausedCard: { padding: sizes.cardPadding, flexDirection: 'row', alignItems: 'center', gap: space.md },
  linkCard: { padding: sizes.cardPadding, gap: space.sm + 2 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: space.sm + 2,
  },
  reset: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs + 2 },
  resetText: { color: colors.brandLink, textDecorationLine: 'underline' },
  well: {
    width: invite.linkIcon,
    height: invite.linkIcon,
    borderRadius: invite.linkIconRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  set: { gap: space.sm + 2 },
  setTitle: { color: colors.muted, marginHorizontal: space.xs, marginTop: space.xs },
  grid: { gap: invite.cardGap },
  gridRow: { flexDirection: 'row', gap: invite.cardGap },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: space.lg },
  milestone: {
    padding: sizes.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
    ...shadow.card,
  },
  // The earn-only sticker's look (INV-08 stand-in art): a tilted brand pill with ink text.
  sticker: {
    backgroundColor: colors.brand,
    borderRadius: 9,
    paddingHorizontal: space.md - 1,
    paddingVertical: space.sm - 1,
    transform: [{ rotate: '-6deg' }],
  },
  track: {
    height: sizes.progressBarHeight,
    borderRadius: radius.progressBar,
    backgroundColor: colors.segmentTrack,
    overflow: 'hidden',
    marginTop: space.xs,
  },
  fill: { height: sizes.progressBarHeight, backgroundColor: colors.brand },
  footer: { color: colors.muted, marginHorizontal: space.xs, lineHeight: 18 },
});
