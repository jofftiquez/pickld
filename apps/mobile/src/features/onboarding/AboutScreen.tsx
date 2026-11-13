import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { phoneTimeZone } from '@/features/jar/useToday';
import { saveErrorOf } from '@/features/profile/editProfileModel';
import { pickProfileImage, uploadProfileImage, type PreparedImage } from '@/features/profile/uploadProfileImage';
import { useUsernameAvailability } from '@/features/profile/useUsernameAvailability';
import { track } from '@/lib/analytics';
import { useAuthStore } from '@/lib/authStore';
import { localDateIn } from '@/lib/jars';
import { resetTo } from '@/lib/navigation';
import { getSupabase } from '@/lib/supabase';

import { aboutProblems, completeBirthday, emptyAbout, isoDate, isUnder13, type AboutForm } from './aboutModel';
import { AboutView, type AboutError } from './AboutView';
import { nextSetupRoute, saveSetupStep } from './setupFlow';

const todayYMD = () => {
  const [year, month, day] = localDateIn(new Date(), phoneTimeZone()).split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
};

/**
 * About you (FR-ACC-03, FR-ACC-04). The photo stays on the phone until Continue. Under 13: fn:account-purge
 * deletes the account before anything is written, then Under 13. Otherwise the profile is saved first (the
 * database checks the birthday and username) and the photo uploaded after, since uploads need a profile.
 */
export function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const [today] = useState(todayYMD);
  const [form, setForm] = useState<AboutForm>(() => {
    const name = session?.user.user_metadata?.full_name;
    return emptyAbout(typeof name === 'string' ? name.slice(0, 40) : '');
  });
  const [photo, setPhoto] = useState<PreparedImage | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AboutError | null>(null);
  const usernameStatus = useUsernameAvailability(form.username, '');
  const canContinue = saved || aboutProblems(form, usernameStatus).length === 0;

  const finish = async () => {
    track('signup_step_completed', { step: 'about' });
    queryClient.setQueryData(['hasProfile', userId], true);
    const next = nextSetupRoute('/setup/about');
    if (userId) await saveSetupStep(userId, next);
    router.replace(next ?? '/');
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
        // The account is gone. Show Under 13 first, then drop the session this phone still holds (About
        // would otherwise redirect to Welcome as soon as it sees the sign-out).
        router.replace('/setup/under13');
        await getSupabase().auth.signOut({ scope: 'local' });
        return;
      }
      if (!saved) {
        const { error: insertError } = await getSupabase()
          .from('profiles')
          .insert({
            id: userId,
            username: form.username.trim(),
            display_name: form.displayName.trim(),
            birthday: isoDate(birthday),
            home_tz: phoneTimeZone(),
          });
        if (insertError) {
          const kind = saveErrorOf(insertError);
          const tooYoung = insertError.code === '23514' && (insertError.message ?? '').includes('birthday');
          setError(tooYoung ? 'birthday' : kind);
          return;
        }
        setSaved(true);
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
      await finish();
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
