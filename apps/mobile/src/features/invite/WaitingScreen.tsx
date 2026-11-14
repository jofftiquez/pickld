import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { phoneTimeZone } from '@/features/jar/useToday';
import { isYoungerThan, ymd } from '@/features/onboarding/aboutModel';
import { track } from '@/lib/analytics';
import { CODE_LENGTH } from '@/lib/auth';
import { useAuthStore } from '@/lib/authStore';
import { localDateIn } from '@/lib/jars';
import { resetTo } from '@/lib/navigation';
import { getSupabase } from '@/lib/supabase';

import { announceJoined, inviteTokenFrom, redeemInvite, usePendingInvite } from './join';
import { WaitingView, type WaitingError } from './WaitingView';

/**
 * Waiting (INV-06): the code field, Paste and Scan QR, and the place in line. A code kept on the phone (a
 * link opened, a scan, a paste, or one About you couldn't use offline) is tried as soon as it's there.
 */
export function WaitingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const pending = usePendingInvite((s) => s.token);
  const [code, setCode] = useState('');
  const [pasteError, setPasteError] = useState<'notACode' | null>(null);

  const line = useQuery({
    queryKey: ['waiting', userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const [position, profile, endsAt] = await Promise.all([
        getSupabase().rpc('waiting_position'),
        getSupabase().from('profiles').select('birthday').eq('id', userId!).single(),
        getSupabase().rpc('invite_period_ends_at'),
      ]);
      if (position.error) throw position.error;
      if (profile.error) throw profile.error;
      if (endsAt.error) throw endsAt.error;
      // waiting_position(): 1 is next; null once this account isn't waiting any more.
      // invite_period_ends_at(): null when there is no end date to show.
      return {
        position: position.data as number | null,
        birthday: profile.data.birthday,
        endsAt: (endsAt.data as string | null) ?? null,
      };
    },
  });

  const letIn = useCallback(
    (reason: 'code' | 'let_in') => {
      track('waiting_admitted', { reason });
      queryClient.setQueryData(['profileStatus', userId], 'active');
      resetTo(router, '/');
    },
    [queryClient, router, userId],
  );

  // Let in some other way meanwhile (early access ended, or a moderator).
  useEffect(() => {
    if (line.data && line.data.position === null) letIn('let_in');
  }, [line.data, letIn]);

  const birthday = line.data?.birthday;
  const redeem = useMutation({
    mutationFn: redeemInvite,
    onSuccess: async (result) => {
      // Used or not, a code that got an answer is done with; offline it stays on the phone.
      await usePendingInvite.getState().clear();
      if (result.result !== 'joined' && result.result !== 'already_member') return;
      if (result.result === 'joined') {
        const today = ymd(localDateIn(new Date(), phoneTimeZone()));
        announceJoined(result.inviter, birthday ? !isYoungerThan(18, ymd(birthday), today) : false);
      }
      letIn(result.result === 'joined' ? 'code' : 'let_in');
    },
  });
  const tryCode = (token: string) => {
    setPasteError(null);
    if (!redeem.isPending) redeem.mutate(token);
  };
  const result = redeem.data?.result;
  const error: WaitingError | null =
    pasteError ?? (redeem.isError ? 'offline' : result === 'unavailable' || result === 'limited' ? result : null);

  useEffect(() => {
    void usePendingInvite.getState().load();
  }, []);
  // A kept code is tried once it's there, after the line is read so the toast knows the person's age.
  const tried = useRef<string | null>(null);
  const ready = line.isSuccess;
  const { mutate } = redeem;
  useEffect(() => {
    if (!pending) tried.current = null;
    if (!pending || !ready || tried.current === pending) return;
    tried.current = pending;
    mutate(pending);
  }, [pending, ready, mutate]);

  return (
    <WaitingView
      insets={insets}
      ahead={line.data?.position ? line.data.position - 1 : null}
      endsAt={line.data?.endsAt ? new Date(line.data.endsAt) : null}
      code={code}
      onChangeCode={(value) => {
        setCode(value);
        setPasteError(null);
        redeem.reset();
      }}
      error={error}
      busy={redeem.isPending}
      onPaste={() =>
        void Clipboard.getStringAsync().then((text) => {
          const token = inviteTokenFrom(text);
          if (!token) return setPasteError('notACode');
          if (token.length === CODE_LENGTH) setCode(token);
          tryCode(token);
        })
      }
      onScan={() => router.push('/scan')}
      onGetIn={() => tryCode(code)}
      onSettings={() => router.push('/settings')}
    />
  );
}
