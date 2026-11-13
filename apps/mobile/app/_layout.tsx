import '../global.css';
import '@/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';

import { SplashOverlay } from '@/components/SplashOverlay';
import { ToastHost } from '@/components/ToastHost';
import { startAuth } from '@/lib/authBootstrap';
import { useAuthStore } from '@/lib/authStore';
import { createQueryClient, persistOptions } from '@/lib/queryClient';
import { deviceNetwork } from '@/lib/network';
import { startUploadRunner } from '@/lib/queue/runner';
import { getSupabase } from '@/lib/supabase';
import { startTelemetry } from '@/lib/telemetry';
import { useReduceMotion } from '@/lib/useReduceMotion';
import { fontFiles } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();
// The dev warning toast only says "Open debugger to view warnings" and covers the bottom of the screen
// (and every screenshot). Warnings still print in Metro and the debugger; crash screens still show.
LogBox.ignoreAllLogs();
// Reminders and pushes that arrive while Pickld is open still show as a banner, quietly (FR-NOT-01).
Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export default function RootLayout() {
  const [loaded] = useFonts(fontFiles);
  const [splashVisible, setSplashVisible] = useState(true);
  const hideSplash = useCallback(() => setSplashVisible(false), []);
  const [queryClient] = useState(createQueryClient);
  const reduceMotion = useReduceMotion();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');

  useEffect(() => startTelemetry(), []);
  useEffect(() => startAuth(getSupabase), []);
  useEffect(() => startUploadRunner(getSupabase, { network: deviceNetwork }), []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Signed-out screens. Signing in drops them from the history, so a back swipe can't return to them. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="intro/[step]" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="check-email" />
        </Stack.Protected>
        {/* The camera covers the tabs; Reduce Motion swaps the slide for no animation (rule 11). */}
        <Stack.Screen
          name="camera"
          options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="crop"
          options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'fade' }}
        />
        <Stack.Screen
          name="edit/[momentId]"
          options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'fade' }}
        />
        <Stack.Screen name="moment/[id]" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="jar/[id]" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="u/[username]/index" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="u/[username]/readers" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="settings/profile" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="settings/blocked" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="comments/[jarId]" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="notifications" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        <Stack.Screen name="my-days" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        {/* Over the editor (a full-screen modal), so these present as modals too. */}
        <Stack.Screen
          name="stickers/shop"
          options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="stickers/pack/[slug]"
          options={{ presentation: 'fullScreenModal', animation: reduceMotion ? 'none' : 'slide_from_bottom' }}
        />
        <Stack.Screen name="publish" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        {/* Celebrations fade in; Reduce Motion keeps the fade and drops the confetti (NFR-A11Y-02). */}
        <Stack.Screen name="full-jar" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="sticker-unlocked" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      <ToastHost />
      {splashVisible ? <SplashOverlay ready onHidden={hideSplash} /> : null}
    </PersistQueryClientProvider>
  );
}
