import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileView } from '@/features/profile/ProfileView';
import { useFollow } from '@/features/profile/useFollow';
import { useProfile } from '@/features/profile/useProfile';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlockFlow } from '@/features/safety/useBlockFlow';
import { profileUrl } from '@/lib/links';

// /u/[username] (M3-13; FR-SOC-08): My profile when the username is the viewer's, else Other profile.
// The username is validated with Zod in useProfile; a bad one is "not available".
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data, failed, refresh } = useProfile(username);
  const follow = useFollow(data?.viewerId ?? null);
  const [reporting, setReporting] = useState(false);
  const blockFlow = useBlockFlow(() => router.replace('/jars'));

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jars');
  };

  return (
    <>
      <ProfileView
        data={data}
        failed={failed}
        insets={insets}
        onBack={back}
        onOpenJar={(jarId) => router.push({ pathname: '/jar/[id]', params: { id: jarId } })}
        onOpenMoment={(momentId, jarId) =>
          router.push({ pathname: '/moment/[id]', params: { id: momentId, jar: jarId } })
        }
        onToggleReading={() => {
          if (data) {
            follow.setReading({
              authorId: data.profile.id,
              username: data.profile.username,
              reading: !data.relationship.reading,
            });
          }
        }}
        followBusy={follow.busy}
        onEditProfile={() => router.push('/settings/profile')}
        onOpenList={(list) => {
          if (data) {
            router.push({ pathname: '/u/[username]/readers', params: { username: data.profile.username, list } });
          }
        }}
        onShare={() => {
          if (data) {
            void Share.share({
              message: t('profile.shareMessage', {
                name: data.profile.display_name,
                url: profileUrl(data.profile.username),
              }),
            });
          }
        }}
        onMore={() => setReporting(true)}
        onRetry={() => void refresh()}
      />
      <ReportSheet
        visible={reporting}
        subject={data ? { target: 'profile', targetId: data.profile.id } : null}
        name={data?.profile.display_name ?? ''}
        onClose={() => setReporting(false)}
        onBlock={() => {
          if (data) blockFlow.open({ id: data.profile.id, name: data.profile.display_name });
        }}
      />
      {blockFlow.dialog}
    </>
  );
}
