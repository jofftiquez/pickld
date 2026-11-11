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
import { startUploadRunner } from '@/lib/queue/runner';
import { getSupabase } from '@/lib/supabase';
import { startTelemetry } from '@/lib/telemetry';
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

  useEffect(() => startTelemetry(), []);
  useEffect(() => startAuth(getSupabase), []);
  useEffect(() => startUploadRunner(getSupabase), []);

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <Stack screenOptions={{ headerShown: false }} />
      {splashVisible ? <SplashOverlay ready onHidden={hideSplash} /> : null}
    </PersistQueryClientProvider>
  );
}
