import { Image } from 'expo-image';
import { useEffect, useState, type ComponentRef, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { PillButton } from '@/components/PillButton';
import { textStyle } from '@/theme/text';
import { colors, radius, space } from '@/theme/tokens';

import type { LibraryPhoto } from './galleryDays';

/** The preview's tallest share of the screen, leaving room for the date and Use this photo. */
const MAX_HEIGHT = 0.6;
const APPEAR_MS = 160;

export type GalleryPeekProps = {
  photo: LibraryPhoto;
  /** "Sun, Nov 8 · 9:00 PM", or "No date". */
  when: string;
  /** The photo is from the day being filled. */
  isTarget: boolean;
  /** Opened by an accessibility action, not a held finger: it stays until Close or Use this photo. */
  pinned: boolean;
  /** The held finger is over Use this photo: letting go there picks the photo. */
  overUse: boolean;
  /** Wraps Use this photo, so the grid can tell whether the finger lets go on it. */
  useRef: Ref<ComponentRef<typeof View>>;
  insets: EdgeInsets;
  reduceMotion: boolean;
  onUse: () => void;
  onClose: () => void;
};

/**
 * A held photo, large with its date (FR-CAP-02; no design, after iOS Photos' preview): let go to close it,
 * or slide onto Use this photo and let go to pick it. Bigger than the thumbnail, it may load from iCloud.
 */
export function GalleryPeek({
  photo,
  when,
  isTarget,
  pinned,
  overUse,
  useRef,
  insets,
  reduceMotion,
  onUse,
  onClose,
}: GalleryPeekProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [appear] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    if (!reduceMotion) Animated.timing(appear, { toValue: 1, duration: APPEAR_MS, useNativeDriver: true }).start();
  }, [appear, reduceMotion]);

  const aspect = photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 3 / 4;
  const maxWidth = width - space.lg * 2;
  const maxHeight = (height - insets.top - insets.bottom) * MAX_HEIGHT;
  const photoWidth = Math.min(maxWidth, maxHeight * aspect);

  return (
    <View style={StyleSheet.absoluteFill} testID="gallery-peek" accessibilityViewIsModal={pinned}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.scrim]}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no"
        disabled={!pinned}
      />
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.content,
          {
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          },
        ]}
      >
        <View
          style={[styles.photo, { width: photoWidth, height: photoWidth / aspect }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('gallery.previewPhoto', { when })}
        >
          <Image
            source={{ uri: photo.id }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={reduceMotion ? 0 : APPEAR_MS}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
            testID="gallery-peek-photo"
          />
          {state === 'loading' ? (
            <View style={styles.status} pointerEvents="none">
              <ActivityIndicator color={colors.surface} />
            </View>
          ) : null}
          {state === 'failed' ? (
            <View style={styles.status} pointerEvents="none">
              <Text style={[textStyle('bodySmall'), styles.statusText]} accessibilityRole="alert">
                {t('gallery.previewFailed')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.when}>
          <Text style={[textStyle('label'), { color: colors.surface }]} numberOfLines={2}>
            {when}
          </Text>
          {isTarget ? (
            <View style={styles.tag}>
              <Text style={[textStyle('caption'), { color: colors.surface }]} numberOfLines={1}>
                {t('gallery.filling')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actions} pointerEvents="box-none">
          {pinned ? (
            <PillButton
              variant="onDark"
              label={t('gallery.close')}
              accessibilityHint={t('gallery.previewCloseHint')}
              onPress={onClose}
              testID="gallery-peek-close"
            />
          ) : null}
          <View ref={useRef} collapsable={false} style={overUse ? styles.useOver : null}>
            <PillButton
              label={t('gallery.usePhoto')}
              accessibilityHint={t('gallery.photoHint')}
              onPress={onUse}
              testID="gallery-peek-use"
            />
          </View>
        </View>
        {pinned ? null : (
          <Text style={[textStyle('caption'), { color: colors.onDarkMuted }]} numberOfLines={2}>
            {t('gallery.previewHint')}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.peekScrim },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.lg },
  photo: { borderRadius: radius.peek, overflow: 'hidden', backgroundColor: colors.editorPhoto },
  status: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    backgroundColor: colors.badge,
  },
  statusText: { color: colors.surface, textAlign: 'center' },
  when: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // brandText, not brand: white words on the brand green miss AA (rule 12 keeps that for primary buttons).
  tag: { backgroundColor: colors.brandText, borderRadius: radius.pill, paddingHorizontal: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  useOver: { transform: [{ scale: 1.08 }] },
});
