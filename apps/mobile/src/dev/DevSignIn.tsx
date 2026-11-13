// Dev-only sign-in for Simulator captures and Maestro flows. It verifies the 6-digit code from a local
// Mailpit sign-in email (D-60), so no password exists anywhere (FR-ACC-01). scripts/dev-sign-in.sh requests
// the email and prints the pickld://dev/sign-in?email=…&code=… link.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { codeSchema, emailSchema } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { textStyle } from '@/theme/text';
import { colors, space } from '@/theme/tokens';

const paramsSchema = z.object({ email: emailSchema, code: codeSchema });

export function DevSignIn() {
  const parsed = paramsSchema.safeParse(useLocalSearchParams());
  const email = parsed.success ? parsed.data.email : null;
  const code = parsed.success ? parsed.data.code : null;
  const [state, setState] = useState<'working' | 'done' | string>('working');

  useEffect(() => {
    if (!email || !code) return;
    getSupabase()
      .auth.verifyOtp({ email, token: code, type: 'email' })
      .then(({ error }) => setState(error ? error.message : 'done'));
  }, [email, code]);

  if (state === 'done') return <Redirect href="/" />;
  const message =
    !email || !code ? 'email and a 6-digit code are required' : state === 'working' ? 'Signing in…' : state;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: colors.background }}>
      <Text testID="dev-sign-in-status" style={[textStyle('body'), { color: colors.ink }]}>
        {message}
      </Text>
    </View>
  );
}
