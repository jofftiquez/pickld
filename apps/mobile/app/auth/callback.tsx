import { AuthCallbackScreen } from '@/features/onboarding/AuthCallbackScreen';

// pickld://auth/callback?code=…: an older email sign-in link. Email sign-in uses a code now (D-60) and Apple
// signs in natively (src/lib/auth.ts).
export default function AuthCallbackRoute() {
  return <AuthCallbackScreen />;
}
