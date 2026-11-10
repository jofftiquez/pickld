import '../global.css';
import '@/i18n';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';

import { SplashOverlay } from '@/components/SplashOverlay';
import { startAuth } from '@/lib/authBootstrap';
import { createQueryClient, persistOptions } from '@/lib/queryClient';
import { getSupabase } from '@/lib/supabase';
import { fontFiles } from '@/theme/fonts';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts(fontFiles);
  const [splashVisible, setSplashVisible] = useState(true);
  const hideSplash = useCallback(() => setSplashVisible(false), []);
  const [queryClient] = useState(createQueryClient);

  useEffect(() => startAuth(getSupabase), []);

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
