import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/components/icons';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SecondaryButton } from '@/components/SecondaryButton';
import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space } from '@/theme/tokens';

export type FeedEmptyProps = {
  onFindPeople: () => void;
  onInvite: () => void;
  /** The user's own published jars are listed below (D-53): the card leads them instead of standing alone. */
  aboveOwnJars?: boolean;
  /** Which timeline it sits in: the copy says jars or moments (the Moments tab, D-53). */
  timeline?: 'jars' | 'moments';
};

// The design fans out three placeholder photos; slot icons stand in until there is cleared artwork.
const tiles: { icon: IconName; rotate: string }[] = [
  { icon: 'whereami', rotate: '-8deg' },
  { icon: 'mebusywith', rotate: '0deg' },
  { icon: 'evening', rotate: '8deg' },
];

/**
 * Jars, empty (design: EmptyStories), shown when the user reads nobody yet (FR-SOC-02). With nothing at all
 * it stands alone; with the user's own published jars below it, it is the Find people card on top (D-53).
 * The Moments timeline uses it the same way with its own copy.
 */
export function FeedEmpty({ onFindPeople, onInvite, aboveOwnJars = false, timeline = 'jars' }: FeedEmptyProps) {
  const { t } = useTranslation();
  const copy = timeline === 'moments' ? 'moments' : 'feed';
  return (
    <Card style={styles.card} testID={aboveOwnJars ? 'feed-find-people-card' : 'feed-empty'}>
      <View style={styles.intro}>
        {aboveOwnJars ? null : (
          <View style={styles.tiles} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {tiles.map(({ icon, rotate }) => (
              <View key={icon} style={[styles.tile, { transform: [{ rotate }] }]}>
                <Icon name={icon} size={22} color="brandText" />
              </View>
            ))}
          </View>
        )}
        <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.title]}>
          {t(aboveOwnJars ? `${copy}.findPeopleTitle` : `${copy}.emptyTitle`)}
        </Text>
        <Text style={[textStyle('bodyMedium'), styles.body]}>
          {t(aboveOwnJars ? `${copy}.findPeopleBody` : `${copy}.emptyBody`)}
        </Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label={t('feed.findPeople')} onPress={onFindPeople} testID="feed-find-people" />
        <SecondaryButton
          variant="outline"
          icon="link"
          label={t('feed.inviteFriends')}
          onPress={onInvite}
          testID="feed-invite"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg + 2 },
  intro: { alignItems: 'center', gap: space.sm + 2, paddingVertical: space.md, paddingHorizontal: space.xs + 2 },
  tiles: { flexDirection: 'row', paddingLeft: space.sm + 2, marginBottom: space.xs + 2 },
  tile: {
    width: sizes.emptyTileWidth,
    height: sizes.emptyTileHeight,
    marginLeft: -(space.sm + 2),
    borderRadius: radius.emptyTile,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.tile,
  },
  title: { color: colors.ink, textAlign: 'center' },
  body: { color: colors.inkSoft, textAlign: 'center', lineHeight: 20 },
  actions: { gap: space.sm, marginTop: space.xs + 2 },
});
