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
  /** The jar's cover (D-56): a small "Cover" badge (D-98). */
  isCover?: boolean;
  /** Opens the moment (Moment detail, or the owner's preview); without it the tile is an image. */
  onPress?: () => void;
  accessibilityHint?: string;
};

/**
 * One moment in the Jar page's 2 by 4 grid (Story, D-97): the whole 3:4 photo with its edits, #slot,
 * "Cover" and "Added later" badges, and a lock for the owner.
 */
export function JarTile({ moment, width, stamp, isCover = false, onPress, accessibilityHint }: JarTileProps) {
  const { t } = useTranslation();
  const [pressed, setPressed] = useState(false);
  const edits = parseEdits(moment.edits);
  const slot = t(`slots.${moment.slot}`);
  const onlyMe = moment.visibility === 'only_me';
  // "#slot, cover, private, added later": every badge is spoken.
  const label = [
    slot,
    isCover ? t('tile.a11y.cover') : null,
    onlyMe ? t('tile.a11y.private') : null,
    moment.is_backfilled ? t('tile.a11y.addedLater') : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      accessibilityHint={onPress ? (accessibilityHint ?? t('jarPage.openMomentHint')) : undefined}
      disabled={!onPress}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[{ width }, pressed && onPress ? { opacity: PRESSED_OPACITY } : null]}
      testID={`jar-tile-${moment.slot}`}
    >
      {/* No fixed height: the tile is 3:4, so the photo is never cropped (D-89, D-97). */}
      <PhotoTile
        uri={moment.thumbUrl}
        photoView={
          moment.thumbUrl !== null && hasVisibleEdits(edits) ? (
            <MomentCover
              uri={moment.thumbUrl}
              edits={edits}
              stamp={stamp}
              accessible={false}
              testID={`jar-tile-${moment.slot}-moment`}
            />
          ) : undefined
        }
        radius={radius.tile}
        label={slot}
        topLeft={
          isCover ? (
            <View style={[styles.badge, styles.cover]} testID={`jar-tile-${moment.slot}-cover`}>
              <Text
                maxFontSizeMultiplier={maxTextScale.tile}
                style={[textStyle('caption'), { color: colors.surface }]}
                numberOfLines={1}
              >
                {t('tile.cover')}
              </Text>
            </View>
          ) : null
        }
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
  cover: { backgroundColor: colors.glass },
  lock: {
    width: sizes.lockBadge,
    height: sizes.lockBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
