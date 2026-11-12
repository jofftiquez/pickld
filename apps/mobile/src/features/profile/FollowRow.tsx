import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PRESSED_OPACITY } from '@/components/BaseButton';
import { useLargeText } from '@/lib/useLargeText';
import { textStyle } from '@/theme/text';
import { colors, sizes, space } from '@/theme/tokens';

import { FollowButton } from './FollowButton';
import { followAction } from './profileModel';
import type { FollowListRow } from './useFollowList';

export type FollowRowProps = {
  row: FollowListRow;
  /** The row is the viewer: no follow button. */
  isViewer: boolean;
  divider: boolean;
  onOpen: () => void;
  onToggleReading: () => void;
  /** The owner's Readers list only: long press (or the screen reader action) asks to remove this reader. */
  onRemove?: () => void;
  disabled?: boolean;
};

/** One person in Readers & authors (Readers): avatar, name, @username and their Read / Read back / Reading button. */
export function FollowRow({ row, isViewer, divider, onOpen, onToggleReading, onRemove, disabled }: FollowRowProps) {
  const { t } = useTranslation();
  const large = useLargeText();
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[styles.row, large && styles.rowWrap, divider ? styles.divider : null]}
      testID={`follow-row-${row.username}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('readers.row', { name: row.display_name, username: row.username })}
        accessibilityHint={t('readers.openHint')}
        accessibilityActions={onRemove ? [{ name: 'remove', label: t('readers.remove') }] : undefined}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'remove') onRemove?.();
        }}
        onPress={onOpen}
        onLongPress={onRemove}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.person, large && styles.personLarge, pressed ? { opacity: PRESSED_OPACITY } : null]}
        testID={`follow-row-${row.username}-open`}
      >
        <Avatar name={row.display_name} size="header" decorative />
        <View style={styles.names}>
          <Text style={[textStyle('body', '600'), { color: colors.ink }]} numberOfLines={1}>
            {row.display_name}
          </Text>
          <Text style={[textStyle('label', '500'), { color: colors.muted }]} numberOfLines={1}>
            {t('profile.username', { username: row.username })}
          </Text>
        </View>
      </Pressable>
      {isViewer ? null : (
        <FollowButton
          action={followAction({ reading: row.is_following, readsYou: row.follows_viewer })}
          name={row.display_name}
          onPress={onToggleReading}
          disabled={disabled}
          testID={`follow-row-${row.username}-button`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  // Large text: the Read button wraps below, so the name isn't cut to one letter (D-37).
  rowWrap: { flexWrap: 'wrap', rowGap: space.sm },
  personLarge: { flexBasis: '100%' },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: sizes.minTap },
  names: { flex: 1, gap: 1 },
});
