import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { MomentThumb } from '@/features/moment/MomentThumb';
import { momentRender } from '@/features/moment/momentRenders';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

import type { Mosaic, MosaicPhoto } from './feedModel';

function Photo({ photo, large }: { photo: MosaicPhoto; large?: boolean }) {
  const render = momentRender(photo.render);
  return (
    <View
      testID={`feed-mosaic-${large ? 'large' : 'small'}`}
      style={[styles.cell, large ? [styles.large, { borderRadius: radius.mosaicLarge }] : null]}
    >
      {/* With its stickers, text and filter when it has any (D-96). */}
      <MomentThumb
        uri={photo.url}
        edits={render?.edits}
        stamp={render?.stamp}
        recyclingKey={photo.momentId}
        transition={150}
        testID={`feed-photo-${photo.momentId}`}
      />
    </View>
  );
}

/** A feed card's photos (design: Feed), with their edits (D-96): the large one spans two rows next to a 2 × 2 grid ending in "+n". */
export function FeedMosaic({ mosaic }: { mosaic: Mosaic }) {
  const { t } = useTranslation();
  if (mosaic.large === null) return null;
  const solo = mosaic.small.length === 0 && mosaic.more === 0;
  return (
    // The card's label already says how many moments it holds; the photos are decorative.
    <View
      style={styles.mosaic}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="feed-mosaic"
    >
      <View style={solo ? styles.soloColumn : styles.largeColumn}>
        <Photo photo={mosaic.large} large />
      </View>
      {solo ? null : (
        <View style={styles.grid}>
          {[0, 2].map((first) => (
            <View key={first} style={styles.gridRow}>
              {[first, first + 1].map((i) => {
                const photo = mosaic.small[i];
                if (photo) return <Photo key={photo.momentId} photo={photo} />;
                if (i === 3 && mosaic.more > 0) {
                  return (
                    <View key="more" style={[styles.cell, styles.more]} testID="feed-mosaic-more">
                      <Text style={[textStyle('bodySmall', '700'), { color: colors.surface }]}>
                        {t('feed.more', { count: mosaic.more })}
                      </Text>
                    </View>
                  );
                }
                return <View key={`empty-${i}`} style={[styles.cell, styles.empty]} />;
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mosaic: { flexDirection: 'row', gap: sizes.mosaicGap, height: 2 * sizes.mosaicRow + sizes.mosaicGap },
  largeColumn: { flex: 2 },
  soloColumn: { flex: 1 },
  grid: { flex: 2, gap: sizes.mosaicGap },
  gridRow: { flex: 1, flexDirection: 'row', gap: sizes.mosaicGap },
  cell: { flex: 1, overflow: 'hidden', backgroundColor: colors.photoPlaceholder, borderRadius: radius.thumbLg },
  large: { flex: 1 },
  more: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  empty: { backgroundColor: 'transparent' },
});
