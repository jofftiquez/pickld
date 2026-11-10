import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { textStyle } from '@/theme/text';
import { colors, radius, shadow, sizes, space, type } from '@/theme/tokens';

import { PRESSED_OPACITY } from './BaseButton';

export type DialogProps = {
  visible: boolean;
  /** Called on Cancel, a tap outside, or Android back. */
  onClose: () => void;
  /** Already translated, e.g. "Block Mika Reyes?". */
  title: string;
  message?: string;
  /** Shown above the title, e.g. an Avatar. */
  media?: ReactNode;
  /** The main action, usually a DangerButton or PrimaryButton. */
  children: ReactNode;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  testID?: string;
};

/**
 * Centered confirm dialog (Block). Renders in a native modal so screen readers stay inside it, and always
 * ends with a Cancel button so it can be closed without a gesture.
 */
export function Dialog({ visible, onClose, title, message, media, children, cancelLabel, testID }: DialogProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      testID={testID ? `${testID}-modal` : 'dialog-modal'}
    >
      <View style={styles.scrim}>
        {/* Tap outside to close. Cancel is the accessible way out, so this is hidden from screen readers. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID={testID ? `${testID}-scrim` : 'dialog-scrim'}
        />
        <View testID={testID} accessibilityViewIsModal style={styles.card}>
          {media}
          <Text accessibilityRole="header" style={[textStyle('sectionTitle'), styles.title]}>
            {title}
          </Text>
          {message ? <Text style={[textStyle('bodyMedium', '400'), styles.message]}>{message}</Text> : null}
          <View style={styles.actions}>{children}</View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel ?? t('common.cancel')}
            onPress={onClose}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={[styles.cancel, pressed ? { opacity: PRESSED_OPACITY } : null]}
          >
            <Text style={[textStyle('body', '700'), styles.cancelText]}>{cancelLabel ?? t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.dialog,
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    alignItems: 'center',
    gap: space.sm + 2,
    ...shadow.dialog,
  },
  title: { color: colors.ink, textAlign: 'center', marginTop: space.xs },
  message: { color: colors.inkSoft, textAlign: 'center', lineHeight: Math.round(type.bodyMedium.size * 1.5) },
  actions: { alignSelf: 'stretch', marginTop: space.sm },
  cancel: {
    alignSelf: 'stretch',
    minHeight: sizes.dialogButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.ink },
});
