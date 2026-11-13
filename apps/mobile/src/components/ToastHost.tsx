import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { useToastStore } from '@/lib/toast';
import { space } from '@/theme/tokens';

import { Toast } from './Toast';

/**
 * Shows the latest `showToast` (D-63), under the status bar. Mounted once in the root layout. On iOS the
 * toast sits in a full-window overlay, added only while it shows, so it stays above screens presented as
 * modals (the editor, Pack preview); touches and VoiceOver outside the pill reach the screen below.
 */
export function ToastHost() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const id = current?.id;
  const onHidden = useCallback(() => {
    if (id !== undefined) hide(id);
  }, [hide, id]);

  if (!current) return null;
  return (
    <Overlay key={current.id}>
      <GestureHandlerRootView
        style={[styles.strip, { top: insets.top + space.sm }]}
        pointerEvents="box-none"
        testID="toast-host"
      >
        <Toast message={t(`toast.${current.key}`, current.params ?? {})} onHidden={onHidden} />
      </GestureHandlerRootView>
    </Overlay>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'ios') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    );
  }
  return <FullWindowOverlay unstable_accessibilityContainerViewIsModal={false}>{children}</FullWindowOverlay>;
}

const styles = StyleSheet.create({
  strip: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
});
