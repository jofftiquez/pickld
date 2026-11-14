import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { hitSlopFor } from '@/lib/hitSlop';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, invite, radius, space } from '@/theme/tokens';

import type { InviteCode, InviteState } from './invites';

const MASK = '••••••';

export type InviteCardProps = {
  code: InviteCode;
  /** Locked and paused cards are grey, with no buttons. */
  state: InviteState;
  /** The one code shown; the others stay hidden. */
  revealed: boolean;
  onToggleReveal: () => void;
  onShowQr: () => void;
  onShare: () => void;
  /** Invited cards with a friend still visible open their profile. */
  onOpenProfile: (username: string) => void;
  /** The friend's signed avatar, when they have one. */
  avatarUrl?: string | null;
  locale: string;
};

/** One invite code as a collectible card in its moment's color (design: Invite, InviteInvited, InviteLocked). */
export function InviteCard({
  code,
  state,
  revealed,
  onToggleReveal,
  onShowQr,
  onShare,
  onOpenProfile,
  avatarUrl = null,
  locale,
}: InviteCardProps) {
  const { t } = useTranslation();
  const tag = t(`slots.${code.slot}`);
  const grey = !code.used && state !== 'open';
  const card = [styles.card, grey ? styles.grey : [styles.color, { backgroundColor: invite.slotColors[code.slot] }]];
  const ink = grey ? colors.muted : colors.surface;
  const top = (
    <>
      <Text
        style={[styles.watermark, { color: grey ? invite.watermarkOnGrey : invite.watermarkOnColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
        allowFontScaling={false}
      >
        #
      </Text>
      <Text
        style={[textStyle('label', '800'), { color: ink }]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxTextScale.control}
      >
        {tag}
      </Text>
    </>
  );

  if (code.used) {
    const friend = code.invitee?.profile ?? null;
    const joined = code.invitee
      ? t('invite.joinedOn', {
          date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
            new Date(code.invitee.joinedAt),
          ),
        })
      : t('invite.joined');
    const body = (
      <View style={styles.friend}>
        {friend ? (
          <View style={styles.avatarRing}>
            <Avatar name={friend.displayName} uri={avatarUrl} size="sm" decorative />
          </View>
        ) : null}
        <View style={styles.friendNames}>
          {friend ? (
            <Text style={[textStyle('bodyMedium', '700'), { color: colors.surface }]} numberOfLines={1}>
              {friend.displayName}
            </Text>
          ) : null}
          <Text style={[textStyle(friend ? 'caption' : 'bodyMedium', friend ? '600' : '700'), styles.onColor]}>
            {friend ? joined : t('invite.joined')}
          </Text>
        </View>
      </View>
    );
    if (!friend) {
      return (
        <View
          style={card}
          accessible
          accessibilityLabel={t('invite.cardUsedHidden', { tag })}
          testID={`invite-card-${code.code}`}
        >
          {top}
          {body}
        </View>
      );
    }
    return (
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t('invite.cardUsed', { tag, name: friend.displayName, joined })}
        onPress={() => onOpenProfile(friend.username)}
        style={card}
        testID={`invite-card-${code.code}`}
      >
        {top}
        {body}
      </Pressable>
    );
  }

  if (grey) {
    const label = state === 'paused' ? t('invite.paused') : t('invite.locked');
    return (
      <View
        style={card}
        accessible
        accessibilityLabel={t(state === 'paused' ? 'invite.cardPaused' : 'invite.cardLocked', { tag })}
        testID={`invite-card-${code.code}`}
      >
        {top}
        <Text style={[styles.code, { color: ink }]} allowFontScaling={false}>
          {MASK}
        </Text>
        <View style={styles.status}>
          <Icon name="lock" size={14} strokeWidth={2.2} color="muted" />
          <Text style={[textStyle('label', '700'), { color: ink }]}>{label}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={card}
      accessibilityRole="none"
      accessibilityLabel={t(revealed ? 'invite.cardShown' : 'invite.cardHidden', { tag, code: code.code })}
      testID={`invite-card-${code.code}`}
    >
      {top}
      <Text
        style={[styles.code, { color: colors.surface }]}
        allowFontScaling={false}
        accessibilityLabel={revealed ? code.code.split('').join(' ') : t('invite.codeHidden')}
        testID={`invite-code-${code.code}`}
      >
        {revealed ? code.code : MASK}
      </Text>
      <View style={styles.buttons}>
        <CardButton
          icon={revealed ? 'eyeOff' : 'eye'}
          label={t(revealed ? 'invite.hideCode' : 'invite.showCode', { tag })}
          onPress={onToggleReveal}
          testID={`invite-eye-${code.code}`}
        />
        <CardButton
          icon="qr"
          label={t('invite.showQr', { tag })}
          onPress={onShowQr}
          testID={`invite-qr-${code.code}`}
        />
        <CardButton
          icon="share"
          label={t('invite.shareCode', { tag })}
          onPress={onShare}
          testID={`invite-share-${code.code}`}
        />
      </View>
    </View>
  );
}

function CardButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlopFor(invite.button, invite.button)}
      style={[styles.button, pressed ? { opacity: PRESSED_OPACITY } : null]}
      testID={testID}
    >
      <Icon name={icon} size={18} strokeWidth={2.2} color="surface" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: invite.cardHeight,
    borderRadius: invite.cardRadius,
    padding: space.md,
    justifyContent: 'space-between',
    gap: space.xs,
    overflow: 'hidden',
  },
  color: invite.cardShadow,
  grey: { backgroundColor: invite.greyCard },
  watermark: {
    position: 'absolute',
    right: -6,
    top: -30,
    fontSize: invite.watermark,
    lineHeight: invite.watermark,
    fontFamily: textStyle('label', '800').fontFamily,
  },
  code: {
    ...textStyle('body', '800'),
    fontSize: invite.codeSize,
    lineHeight: invite.codeSize + 6,
    letterSpacing: invite.codeSpacing,
  },
  buttons: { flexDirection: 'row', gap: space.xs + 2 },
  button: {
    width: invite.button,
    height: invite.button,
    borderRadius: radius.pill,
    backgroundColor: invite.buttonFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avatarRing: { borderRadius: radius.pill, borderWidth: 2, borderColor: invite.avatarRing },
  friendNames: { flex: 1, minWidth: 0 },
  onColor: { color: colors.surface, opacity: 0.9 },
});
