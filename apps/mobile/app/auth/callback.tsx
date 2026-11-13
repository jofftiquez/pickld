import { AuthCallbackScreen } from '@/features/onboarding/AuthCallbackScreen';

// pickld://auth/callback?code=… from Apple or Google. Email sign-in uses a code instead (D-60); an older link
// email that hasn't expired still lands here.
export default function AuthCallbackRoute() {
  return <AuthCallbackScreen />;
}
