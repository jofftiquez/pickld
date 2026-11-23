import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuideTip } from '@/features/guide/GuideTip';
import { useGuideTip } from '@/features/guide/useGuideTip';
import { leftToGive } from '@/features/invite/invites';
import { useInvites } from '@/features/invite/useInvites';
import { ProfileView } from '@/features/profile/ProfileView';
import { isOwnProfile } from '@/features/profile/profileModel';
import { useFollow } from '@/features/profile/useFollow';
import { useMute } from '@/features/profile/useMute';
import { useProfile } from '@/features/profile/useProfile';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlockFlow } from '@/features/safety/useBlockFlow';
import { profileUrl } from '@/lib/links';
import { useScreenFocused } from '@/lib/useScreenFocused';

// /u/[username] (M3-13; FR-SOC-08): My profile when the username is the viewer's, else Other profile.
// The username is validated with Zod in useProfile; a bad one is "not available".
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data, failed, refresh } = useProfile(username);
  const follow = useFollow(data?.viewerId ?? null);
  const mute = useMute(data?.viewerId ?? null);
  const { invites } = useInvites();
  const [reporting, setReporting] = useState(false);
  const blockFlow = useBlockFlow(() => router.replace('/jars'));

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/jars');
  };

  // First-time guide (FR-ONB-10): what reading someone means, once, on a profile of someone not read yet.
  const guide = useGuideTip(
    [{ id: 'profile', when: data != null && !isOwnProfile(data) && !data.relationship.reading && !reporting }],
    useScreenFocused(),
  );

  return (
    <View style={styles.root} {...guide.catchTaps}>
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
              // Requested cancels the request (0176).
              reading: !(data.relationship.reading || data.relationship.requested),
            });
          }
        }}
        followBusy={follow.busy}
        onToggleMute={() => {
          if (data) mute.setMuted(data.profile.id, !data.relationship.muted);
        }}
        muteBusy={mute.busy}
        onEditProfile={() => router.push('/settings/profile')}
        onSettings={() => router.push('/settings')}
        onOpenStickers={() => router.push('/stickers')}
        onOpenInvite={() => router.push('/invite')}
        invitesLeft={leftToGive(invites)}
        onAddMoment={() => router.push('/camera')}
        onOpenList={(list) => {
          if (data) {
            router.push({ pathname: '/u/[username]/readers', params: { username: data.profile.username, list } });
          }
        }}
        onOpenTogether={() => {
          if (data) router.push({ pathname: '/u/[username]/together', params: { username: data.profile.username } });
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
        guideTip={
          guide.tip === 'profile' ? (
            <GuideTip
              id="profile"
              arrow={{ side: 'top', align: 'center' }}
              onClose={guide.close}
              tipRef={guide.tipRef}
            />
          ) : null
        }
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
