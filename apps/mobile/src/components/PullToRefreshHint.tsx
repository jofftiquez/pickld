import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

import { Icon } from './Icon';

/** "Pull down to refresh", muted, under an empty list that refreshes when pulled (D-87). */
export function PullToRefreshHint({ testID }: { testID?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.hint} testID={testID}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="chevronDown" color="muted" size={14} strokeWidth={2.2} />
      </View>
      <Text style={[textStyle('label', '500'), styles.text]}>{t('emptyState.pullToRefresh')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, marginTop: space.md },
  text: { color: colors.muted, textAlign: 'center', flexShrink: 1 },
});
