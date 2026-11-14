import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InviteQrSheet } from '@/features/invite/InviteQrSheet';
import { InviteView } from '@/features/invite/InviteView';
import type { InviteCode, Invites } from '@/features/invite/invites';
import { slots } from '@/theme/tokens';

/** Set `setNo` of 8 codes; the first `used` of them were used by friends. */
function set(setNo: number, used: number): InviteCode[] {
  const friends = ['Mia Cruz', 'Ben Santos', 'Ana Reyes'];
  return slots.map((slot, i) => ({
    code: `${'K7M2QX'.slice(0, 4)}${setNo}${i}`,
    setNo,
    slot,
    used: i < used,
    invitee:
      i < used
        ? {
            joinedAt: `2026-11-1${i}T03:00:00Z`,
            // The last friend shows as hidden (blocked or left): "Joined" only.
            profile:
              i < friends.length && i < used - 1
                ? { id: `f${i}`, username: `friend${i}`, displayName: friends[i] ?? '', avatarPath: null }
                : null,
          }
        : null,
  }));
}

const link = { id: 'h3Lm9Qa2', enabled: true };
const states: Record<string, Invites> = {
  open: { state: 'open', link, codes: set(1, 2) },
  sets: { state: 'open', link, codes: [...set(1, 2), ...set(2, 0)] },
  locked: { state: 'locked', link: null, codes: set(1, 0) },
  paused: { state: 'paused', link, codes: set(1, 2) },
};

// Dev builds only (like /dev/share-matrix): the Invite page in each state from fixtures, no backend.
// pickld://dev/invite?state=open|sets|locked|paused&tab=available|invited, or ?qr=1 for one code's QR sheet.
export default function DevInviteRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state = 'open', tab, qr } = useLocalSearchParams<{ state?: string; tab?: string; qr?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const noop = () => undefined;
  if (qr) return <InviteQrSheet code={set(1, 0)[5] ?? null} onShare={noop} onClose={() => router.back()} />;
  return (
    <InviteView
      key={`${state}-${tab}`}
      invites={states[state] ?? states.open}
      initialTab={tab === 'invited' ? 'invited' : 'available'}
      insets={insets}
      onBack={() => router.back()}
      onRetry={noop}
      onShareUrl={noop}
      onCopyUrl={noop}
      onLinkEnabled={noop}
      onResetLink={noop}
      onOpenProfile={noop}
      onAddMoment={noop}
      onHelp={noop}
    />
  );
}
