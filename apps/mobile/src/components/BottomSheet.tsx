import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hitSlopFor } from '@/lib/hitSlop';
import { colors, motion, radius, sizes, space } from '@/theme/tokens';

export type BottomSheetProps = {
  visible: boolean;
  /** Called after the user dismisses the sheet (drag down, backdrop, Close, Android back). Set `visible` false here. */
  onClose: () => void;
  /** Called once the sheet's native modal is fully gone, however it closed: the moment another modal (e.g.
   * a confirm dialog) can open. iOS can't present one while this one is still dismissing. */
  onClosed?: () => void;
  /** What the sheet is, read when it opens (e.g. "Moment options"). Already translated. */
  accessibilityLabel: string;
  children: ReactNode;
  testID?: string;
  /** Long content (a SelectField's list) scrolls inside the sheet, which stops at `sizes.sheetMaxHeight`. */
  scrollable?: boolean;
};

/**
 * Bottom sheet sized to its content (MomentOptions, Report). It renders in a native modal so VoiceOver
 * and TalkBack stay inside it, and its grab handle is the accessible Close button.
 */
export function BottomSheet({
  visible,
  onClose,
  onClosed,
  accessibilityLabel,
  children,
  testID,
  scrollable = false,
}: BottomSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const sheet = useRef<GorhomBottomSheet>(null);
  // Stay mounted after `visible` turns false until the close animation ends.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const visibleRef = useRef(visible);
  // Declared before the close effect so a parent-driven close sees `false` and skips onClose.
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible && mounted) sheet.current?.close();
  }, [visible, mounted]);
  // A container label isn't read on its own, so say what opened.
  useEffect(() => {
    if (mounted) AccessibilityInfo.announceForAccessibility(accessibilityLabel);
  }, [mounted, accessibilityLabel]);

  // Reduce Motion: a short timing slide instead of the default spring.
  const shortTiming = useBottomSheetTimingConfigs({ duration: motion.fast, reduceMotion: ReduceMotion.Never });

  const requestClose = useCallback(() => sheet.current?.close(), []);
  const handleClosed = useCallback(() => {
    setMounted(false);
    if (visibleRef.current) onClose();
    // iOS reports the modal gone through onDismiss below; Android has no such callback and needs no wait.
    if (Platform.OS !== 'ios') onClosed?.();
  }, [onClose, onClosed]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={1}
        pressBehavior="close"
        style={[props.style, styles.backdrop]}
        // The handle is the Close button; a second unlabeled target only adds noise.
        accessible={false}
      />
    ),
    [],
  );

  const renderHandle = useCallback(
    () => (
      <View style={styles.handleArea}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={requestClose}
          hitSlop={hitSlopFor(sizes.handleWidth, sizes.handleHeight)}
          testID={testID ? `${testID}-close` : 'bottom-sheet-close'}
          style={styles.handle}
        />
      </View>
    ),
    [requestClose, t, testID],
  );

  return (
    <Modal
      visible={mounted}
      onDismiss={onClosed}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <GorhomBottomSheet
          ref={sheet}
          index={0}
          enablePanDownToClose
          maxDynamicContentSize={scrollable ? sizes.sheetMaxHeight : undefined}
          onClose={handleClosed}
          animationConfigs={reduceMotion ? shortTiming : undefined}
          backdropComponent={renderBackdrop}
          handleComponent={renderHandle}
          backgroundStyle={styles.background}
          // gorhom groups the whole sheet into one "adjustable" element by default; keep rows reachable.
          accessible={false}
        >
          {/* gorhom only hands a swipe to a scrollable of its own, so long lists use its ScrollView. */}
          {scrollable ? (
            <BottomSheetScrollView
              testID={testID}
              accessibilityLabel={accessibilityLabel}
              accessibilityViewIsModal
              contentContainerStyle={[styles.content, { paddingBottom: space.xxxl + insets.bottom }]}
            >
              {children}
            </BottomSheetScrollView>
          ) : (
            <BottomSheetView
              testID={testID}
              accessibilityLabel={accessibilityLabel}
              accessibilityViewIsModal
              style={[styles.content, { paddingBottom: space.xxxl + insets.bottom }]}
            >
              {children}
            </BottomSheetView>
          )}
        </GorhomBottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: colors.scrim },
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  handleArea: { alignItems: 'center', paddingTop: space.md, paddingBottom: space.md },
  handle: {
    width: sizes.handleWidth,
    height: sizes.handleHeight,
    borderRadius: sizes.handleHeight,
    backgroundColor: colors.handle,
  },
  content: { paddingHorizontal: space.xl },
});
