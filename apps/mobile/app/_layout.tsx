import '../global.css';
import '@/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { LogBox } from 'react-native';

import { SplashOverlay } from '@/components/SplashOverlay';
import { startAuth } from '@/lib/authBootstrap';
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

export default function RootLayout() {
  const [loaded] = useFonts(fontFiles);
  const [splashVisible, setSplashVisible] = useState(true);
  const hideSplash = useCallback(() => setSplashVisible(false), []);
  const [queryClient] = useState(createQueryClient);
  const reduceMotion = useReduceMotion();

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
        <Stack.Screen name="publish" options={{ animation: reduceMotion ? 'none' : 'default' }} />
        {/* Celebrations fade in; Reduce Motion keeps the fade and drops the confetti (NFR-A11Y-02). */}
        <Stack.Screen name="full-jar" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="sticker-unlocked" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      {splashVisible ? <SplashOverlay ready onHidden={hideSplash} /> : null}
    </PersistQueryClientProvider>
  );
}
