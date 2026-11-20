import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { announceJoined, redeemInvite, usePendingInvite } from '@/features/invite/join';
import { phoneTimeZone } from '@/features/jar/useToday';
import { saveErrorOf } from '@/features/profile/editProfileModel';
import { pickProfileImage, uploadProfileImage, type PreparedImage } from '@/features/profile/uploadProfileImage';
import { useUsernameAvailability } from '@/features/profile/useUsernameAvailability';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { localDateIn } from '@/lib/jars';
import { resetTo } from '@/lib/navigation';
import { getSupabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

import {
  aboutProblems,
  completeBirthday,
  emptyAbout,
  isoDate,
  isUnder13,
  isYoungerThan,
  ymd,
  type AboutForm,
  type YMD,
} from './aboutModel';
import { AboutView, type AboutError } from './AboutView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

type ProfileStatus = Database['public']['Enums']['profile_status'];

const todayYMD = () => ymd(localDateIn(new Date(), phoneTimeZone()));

/**
 * About you (FR-ACC-03, FR-ACC-04). The photo stays on the phone until Continue. Under 13: fn:account-purge
 * deletes the account before anything is written, then Under 13. Otherwise the profile is saved first (the
 * database checks the birthday and username) and the photo uploaded after, since uploads need a profile.
 * Then an invite kept on this phone is used (INV-06): the person is let in, and reads their inviter.
 */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const [today] = useState(todayYMD);
  const [form, setForm] = useState<AboutForm>(() => emptyAbout(''));
  // The name from Sign in with Apple, which can land just after this screen opens; never over what was typed.
  const metaName = session?.user.user_metadata?.full_name;
  const [seenName, setSeenName] = useState<unknown>(undefined);
  if (metaName !== seenName) {
    setSeenName(metaName);
    if (typeof metaName === 'string' && !form.displayName) setForm({ ...form, displayName: metaName.slice(0, 40) });
  }
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  // The new profile's status once saved: waiting during early access, else active.
  const [saved, setSaved] = useState<ProfileStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AboutError | null>(null);
  const usernameStatus = useUsernameAvailability(form.username, '');
  const canContinue = saved !== null || aboutProblems(form, usernameStatus).length === 0;

  const finish = async (status: ProfileStatus, birthday: YMD) => {
    track('signup_step_completed', { step: 'about' });
    queryClient.setQueryData(['profileStatus', userId], await redeemKeptInvite(status, birthday));
    const next = nextSetupRoute('/setup/about');
    if (userId) await saveSetupStep(userId, next);
    router.replace(next ?? '/');
  };

  // A failure or an invite that can't be used never stops setup: Waiting offers the code field again.
  const redeemKeptInvite = async (status: ProfileStatus, birthday: YMD): Promise<ProfileStatus> => {
    const pending = usePendingInvite.getState();
    const token = await pending.load().catch(() => null);
    if (!token) return status;
    try {
      const result = await redeemInvite(token);
      await pending.clear();
      if (result.result !== 'joined') return status;
      announceJoined(result.inviter, !isYoungerThan(18, birthday, today));
      return 'active';
    } catch {
      // Offline: the code stays on the phone and Waiting tries it again.
      return status;
    }
  };

  const onContinue = async () => {
    const birthday = completeBirthday(form.birthday);
    if (!userId || !birthday) return;
    setBusy(true);
    setError(null);
    try {
      if (!saved && isUnder13(birthday, today)) {
        const { error: purgeError } = await getSupabase().functions.invoke('account-purge', { method: 'POST' });
        if (purgeError) throw purgeError;
        // No code is used under 13.
        await usePendingInvite
          .getState()
          .clear()
          .catch(() => undefined);
        // The account is gone. Show Under 13 first, then drop the session this phone still holds (About
        // would otherwise redirect to Welcome as soon as it sees the sign-out).
        router.replace('/setup/under13');
        await getSupabase().auth.signOut({ scope: 'local' });
        return;
      }
      let status = saved;
      if (!status) {
        const { data: inserted, error: insertError } = await getSupabase()
          .from('profiles')
          .insert({
            id: userId,
            username: form.username.trim(),
            display_name: form.displayName.trim(),
            birthday: isoDate(birthday),
            home_tz: phoneTimeZone(),
          })
          .select('status')
          .single();
        if (insertError || !inserted) {
          if (!insertError) throw new Error('no profile');
          const kind = saveErrorOf(insertError);
          const tooYoung = insertError.code === '23514' && (insertError.message ?? '').includes('birthday');
          setError(tooYoung ? 'birthday' : kind);
          return;
        }
        status = inserted.status;
        setSaved(status);
      }
      if (photo) {
        try {
          const key = await uploadProfileImage(photo, 'avatar');
          const { error: updateError } = await getSupabase()
            .from('profiles')
            .update({ avatar_path: key })
            .eq('id', userId);
          if (updateError) throw updateError;
        } catch {
          // The profile is saved: say so once, then a second Continue moves on without the photo.
          if (error !== 'upload') {
            setError('upload');
            return;
          }
        }
      }
      await finish(status, birthday);
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AboutView
      insets={insets}
      form={form}
      today={today}
      avatarUri={photo?.uri ?? null}
      usernameStatus={usernameStatus}
      canContinue={canContinue}
      busy={busy}
      error={error}
      onChange={(patch) => {
        setForm((f) => ({ ...f, ...patch }));
        if (error !== 'upload') setError(null);
      }}
      onPickPhoto={() =>
        void pickProfileImage('avatar').then(
          (p) => p && setPhoto(p),
          () => setError('upload'),
        )
      }
      onContinue={() => void onContinue()}
      // Leaving before a profile exists signs this phone out; signing in again comes back here.
      onBack={() =>
        void getSupabase()
          .auth.signOut({ scope: 'local' })
          .finally(() => resetTo(router, '/welcome'))
      }
    />
  );
}
