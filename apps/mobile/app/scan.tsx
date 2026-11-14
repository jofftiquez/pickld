import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MockCameraPreview } from '@/features/capture/MockCameraPreview';
import { useCameraAccess } from '@/features/capture/useCameraAccess';
import { usePendingInvite } from '@/features/invite/join';
import { ScanPreview } from '@/features/invite/ScanPreview';
import { ScanView } from '@/features/invite/ScanView';
import { track } from '@/lib/analytics';
import { captureError } from '@/lib/monitoring';
import { inviteTokenFromUrl } from '@/lib/links';

// How long "That's not a Pickld invite" stays after the last such code left the frame.
const NOT_INVITE_MS = 2500;

// /scan (INV-06; FR-INV-02; design: ScanQR): from Sign up and Waiting. Camera access is asked for here, the
// first time it opens. A pickld.me invite link is kept and the screen closes; the screen behind uses it.
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const access = useCameraAccess();
  const keep = usePendingInvite((s) => s.keep);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [notInvite, setNotInvite] = useState(false);
  const done = useRef(false);
  const hideError = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state !== 'background'));
    return () => {
      sub.remove();
      if (hideError.current) clearTimeout(hideError.current);
    };
  }, []);

  useEffect(() => {
    if (access === 'denied') track('invite_scan', { outcome: 'denied' });
  }, [access]);

  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), [router]);

  const onCode = useCallback(
    (value: string) => {
      if (done.current) return;
      const token = inviteTokenFromUrl(value);
      if (!token) {
        // Counted once per time the message shows, not for every frame the code stays in view.
        if (hideError.current) clearTimeout(hideError.current);
        else track('invite_scan', { outcome: 'not_invite' });
        setNotInvite(true);
        hideError.current = setTimeout(() => {
          hideError.current = null;
          setNotInvite(false);
        }, NOT_INVITE_MS);
        return;
      }
      done.current = true;
      track('invite_scan', { outcome: 'invite' });
      void keep(token).finally(leave);
    },
    [keep, leave],
  );

  return (
    <ScanView
      insets={insets}
      access={access === 'denied' ? 'denied' : 'live'}
      preview={
        access === 'mock' ? (
          <MockCameraPreview facing="back" />
        ) : access === 'granted' ? (
          <ScanPreview isActive={focused && foreground} torch={torch} onTorchSupport={setHasTorch} onCode={onCode} />
        ) : null
      }
      notInvite={notInvite}
      torch={torch}
      hasTorch={hasTorch}
      onClose={leave}
      onTorch={() => setTorch((on) => !on)}
      onTypeInstead={leave}
      onOpenSettings={() => Linking.openSettings().catch((error: unknown) => captureError(error, { area: 'invite' }))}
    />
  );
}
