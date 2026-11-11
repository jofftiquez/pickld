import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { RoundIconButton } from '@/components/RoundIconButton';
import { textStyle } from '@/theme/text';
import { colors, photo, radius, sizes, space, type Slot } from '@/theme/tokens';

import { CameraSideButton } from './CameraSideButton';
import type { FlashSetting } from './CameraPreview';
import { ShutterButton } from './ShutterButton';
import { SlotSwitcher } from './SlotSwitcher';
import { SlotTag } from './SlotTag';
import { ViewfinderGrid } from './ViewfinderGrid';

export type CameraViewProps = {
  /** The live preview (vision-camera) or the dev mock; fills the 3:4 viewfinder. */
  preview: ReactNode;
  slot: Slot;
  taken: ReadonlySet<Slot>;
  /** Current time, formatted for the slot tag. */
  time: string;
  /** Fill this jar: the past day being filled, formatted for the slot tag. */
  date?: string;
  flash: FlashSetting;
  flashSupported: boolean;
  shutterDisabled: boolean;
  reduceMotion: boolean;
  insets: EdgeInsets;
  onClose: () => void;
  onToggleFlash: () => void;
  onFlip: () => void;
  onGallery: () => void;
  onShutter: () => void;
  onSelectSlot: (slot: Slot) => void;
};

// Room below the viewfinder for the moment tabs and the shutter row on short phones.
const CONTROLS_MIN_HEIGHT = 190;

/** The Camera screen layout (design: Camera): 3:4 viewfinder with grid and controls, moment tabs, shutter row. */
export function CameraView({
  preview,
  slot,
  taken,
  time,
  date,
  flash,
  flashSupported,
  shutterDisabled,
  reduceMotion,
  insets,
  onClose,
  onToggleFlash,
  onFlip,
  onGallery,
  onShutter,
  onSelectSlot,
}: CameraViewProps) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const tag = t(`slots.${slot}`);
  const available = window.height - insets.top - insets.bottom - CONTROLS_MIN_HEIGHT;
  const width = Math.min(window.width, Math.max(0, available) * photo.aspect);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="camera-screen">
      <View style={[styles.viewfinder, { width, height: width / photo.aspect }]} testID="camera-viewfinder">
        {preview}
        <ViewfinderGrid />
        <View style={styles.topRow}>
          <RoundIconButton
            icon="close"
            variant="glass"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            testID="camera-close"
          />
          <SlotTag slot={tag} time={time} date={date} />
          <RoundIconButton
            icon={flash === 'on' ? 'flash' : 'flashOff'}
            variant="glass"
            accessibilityLabel={flash === 'on' ? t('camera.flashOn') : t('camera.flashOff')}
            accessibilityHint={t('camera.flashHint')}
            onPress={onToggleFlash}
            disabled={!flashSupported}
            testID="camera-flash"
          />
        </View>
        <View style={styles.aspect} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={[textStyle('caption'), { color: colors.surface }]}>{t('camera.aspect')}</Text>
        </View>
      </View>

      <SlotSwitcher selected={slot} taken={taken} onSelect={onSelectSlot} reduceMotion={reduceMotion} />

      <View style={[styles.shutterRow, { paddingBottom: insets.bottom + space.md }]}>
        <CameraSideButton
          icon="gallery"
          shape="tile"
          accessibilityLabel={t('camera.gallery')}
          onPress={onGallery}
          testID="camera-gallery"
        />
        <ShutterButton
          accessibilityLabel={t('camera.shutter')}
          accessibilityHint={t('camera.shutterHint', { slot: tag })}
          onPress={onShutter}
          disabled={shutterDisabled}
        />
        <CameraSideButton
          icon="flip"
          shape="round"
          accessibilityLabel={t('camera.flip')}
          onPress={onFlip}
          testID="camera-flip"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.camera },
  viewfinder: {
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: colors.camera,
    borderBottomLeftRadius: radius.viewfinder,
    borderBottomRightRadius: radius.viewfinder,
  },
  topRow: {
    position: 'absolute',
    top: space.lg,
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  aspect: {
    position: 'absolute',
    bottom: space.md,
    alignSelf: 'center',
    backgroundColor: colors.badge,
    borderRadius: radius.pill,
    paddingVertical: sizes.pillPaddingY,
    paddingHorizontal: space.sm + 2,
  },
  shutterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xxxl + space.sm,
  },
});
