import { AuthCallbackScreen } from '@/features/onboarding/AuthCallbackScreen';

// pickld://auth/callback?code=… from the email link, Apple or Google.
export default function AuthCallbackRoute() {
  return <AuthCallbackScreen />;
}
