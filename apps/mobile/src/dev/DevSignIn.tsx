// Dev-only sign-in for Simulator captures until the real sign-in screens land (M3). It verifies a
// one-time email link's token hash from local Mailpit, so no password exists anywhere (FR-ACC-01).
// scripts/dev-sign-in.sh requests the email and prints the pickld://dev/sign-in?token=… link.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { getSupabase } from '@/lib/supabase';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

export function DevSignIn() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<'working' | 'done' | string>('working');
  const missing = !token;

  useEffect(() => {
    if (!token) return;
    getSupabase()
      .auth.verifyOtp({ token_hash: token, type: 'magiclink' })
      .then(({ error }) => setState(error ? error.message : 'done'));
  }, [token]);

  if (state === 'done') return <Redirect href="/" />;
  const message = missing ? 'token is required' : state === 'working' ? 'Signing in…' : state;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colors.background }}>
      <Text testID="dev-sign-in-status" style={[textStyle('body'), { color: colors.ink }]}>
        {message}
      </Text>
    </View>
  );
}
