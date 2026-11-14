import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { fetchInvitePreview, usePendingInvite } from '@/features/invite/join';
import { useProfileStatus } from '@/features/onboarding/useProfileStatus';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { normalizeInviteToken } from '@/lib/links';
import { showToast } from '@/lib/toast';

// /i/[token] (INV-06; FR-INV-02): where a pickld.me/i/… link or QR lands. Signed out, the code is kept for
// Sign up; an account without a profile or still waiting keeps it for About you or Waiting. Someone already
// on Pickld isn't asked to use it: "You're already on Pickld", then the inviter's profile.
export default function InviteLinkRoute() {
  const router = useRouter();
  const { token: raw } = useLocalSearchParams<{ token: string }>();
  const token = normalizeInviteToken(raw ?? '');
  const auth = useAuthStore((s) => s.status);
  const profile = useProfileStatus();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || auth === 'loading') return;
    if (auth === 'signedIn' && profile.isPending) return;
    handled.current = true;
    const keepThen = (href: '/sign-up' | '/') => {
      void usePendingInvite
        .getState()
        .keep(token!)
        .finally(() => router.replace(href));
    };
    if (!token) return router.replace('/');
    track('invite_page_opened', {
      as:
        auth === 'signedOut'
          ? 'signed_out'
          : profile.data === 'active'
            ? 'member'
            : profile.data === 'waiting'
              ? 'waiting'
              : 'setting_up',
    });
    if (auth === 'signedOut') return keepThen('/sign-up');
    // No profile yet, waiting, or unknown (offline): keep it for About you or Waiting.
    if (profile.data === null || profile.data === 'waiting' || profile.data === undefined) return keepThen('/');
    if (profile.data !== 'active') return router.replace('/');
    showToast('alreadyMember');
    fetchInvitePreview(token).then(
      (p) => router.replace(p.ok && p.inviter ? `/u/${p.inviter.username}` : '/'),
      () => router.replace('/'),
    );
  }, [auth, profile.isPending, profile.data, token, router]);

  return null;
}
