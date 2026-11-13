import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PRESSED_OPACITY } from '@/components/BaseButton';
import { Icon } from '@/components/Icon';
import { PhotoTile } from '@/components/PhotoTile';
import { parseEdits } from '@/features/edit/edits';
import type { StampMoment } from '@/features/edit/stickers/stamps';
import { MomentCover } from '@/features/moment/MomentCover';
import { hasVisibleEdits } from '@/features/moment/momentRender';
import { maxTextScale, textStyle } from '@/theme/text';
import { colors, radius, sizes, space } from '@/theme/tokens';

import type { JarMoment } from './jarPage';

export type JarTileProps = {
  moment: JarMoment;
  width: number;
  stamp: StampMoment;
  /** Opens Moment detail; without it the tile is an image. */
  onPress?: () => void;
};

/** One moment in the Jar page grid (Story): photo with its edits, #slot, "Added later" badge, and a lock for the owner. */
export function JarTile({ moment, width, stamp, onPress }: JarTileProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const edits = parseEdits(moment.edits);
  const slot = t(`slots.${moment.slot}`);
  const onlyMe = moment.visibility === 'only_me';
  const labelKey = onlyMe
    ? moment.is_backfilled
      ? 'jarPage.tilePrivateAddedLater'
      : 'jarPage.tilePrivate'
    : moment.is_backfilled
      ? 'jarPage.tileAddedLater'
      : 'jarPage.tile';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={t(labelKey, { slot })}
      accessibilityHint={onPress ? t('jarPage.openMomentHint') : undefined}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ width }, pressed && onPress ? { opacity: PRESSED_OPACITY } : null]}
      testID={`jar-tile-${moment.slot}`}
    >
      <PhotoTile
        uri={moment.thumbUrl}
        photoView={
          moment.thumbUrl !== null && hasVisibleEdits(edits) ? (
            <MomentCover uri={moment.thumbUrl} edits={edits} stamp={stamp} accessible={false} />
          ) : undefined
        }
        height={sizes.jarTile}
        radius={radius.jarTile}
        fadeHeight={sizes.jarTileFade}
        label={slot}
        labelVariant="caption"
        topRight={
          moment.is_backfilled || onlyMe ? (
            <>
              {moment.is_backfilled ? (
                <View style={styles.badge} testID={`jar-tile-${moment.slot}-added-later`}>
                  <Text
                    maxFontSizeMultiplier={maxTextScale.tile}
                    style={[textStyle('caption'), { color: colors.surface }]}
                    numberOfLines={1}
                  >
                    {t('tile.addedLater')}
                  </Text>
                </View>
              ) : null}
              {onlyMe ? (
                <View style={styles.lock} testID={`jar-tile-${moment.slot}-lock`}>
                  <Icon name="lock" color="surface" size={12} strokeWidth={2} />
                </View>
              ) : null}
            </>
          ) : null
        }
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY - 1,
    paddingHorizontal: space.xs + 2,
    backgroundColor: colors.badge,
    flexShrink: 1,
  },
  lock: {
    width: sizes.lockBadge,
    height: sizes.lockBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
