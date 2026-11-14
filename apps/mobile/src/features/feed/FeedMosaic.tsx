import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { MomentThumb } from '@/features/moment/MomentThumb';
import { momentRender } from '@/features/moment/momentRenders';
import { textStyle } from '@/theme/text';
import { colors, radius, sizes } from '@/theme/tokens';

import { mosaicRows, type Mosaic, type MosaicPhoto } from './feedModel';

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

/** A feed card's photos (design: Feed), with their edits (D-96): the large one spans two rows next to the
 * small ones (mosaicRows), with "+n" last when there are more. */
export function FeedMosaic({ mosaic }: { mosaic: Mosaic }) {
  const { t } = useTranslation();
  if (mosaic.large === null) return null;
  const rows = mosaicRows(mosaic);
  const solo = rows.length === 0;
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
          {rows.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {row.map((cell) =>
                cell.kind === 'photo' ? (
                  <Photo key={cell.photo.momentId} photo={cell.photo} />
                ) : (
                  <View key="more" style={[styles.cell, styles.more]} testID="feed-mosaic-more">
                    <Text style={[textStyle('bodySmall', '700'), { color: colors.surface }]}>
                      {t('feed.more', { count: mosaic.more })}
                    </Text>
                  </View>
                ),
              )}
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
});
