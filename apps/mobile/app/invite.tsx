import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InviteView } from '@/features/invite/InviteView';
import { useInviteLink, useInvites } from '@/features/invite/useInvites';
import { copyLink, shareLink } from '@/features/share/shareActions';
import { useAvatarUrls } from '@/lib/avatars';
import { showToast } from '@/lib/toast';

// /invite (INV-07; FR-INV-03; design: Invite): your codes, your link and the friends who joined.
// Opened from your profile, Settings, the empty feed and Find friends.
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { invites, failed, refresh } = useInvites();
  const { setEnabled, reset, busy } = useInviteLink();
  const avatars = useAvatarUrls(
    (invites?.codes ?? []).flatMap((c) =>
      c.invitee?.profile ? [{ id: c.invitee.profile.id, path: c.invitee.profile.avatarPath }] : [],
    ),
  );
  return (
    <InviteView
      invites={invites}
      avatars={avatars}
      failed={failed}
      busy={busy}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onRetry={() => void refresh()}
      onShareUrl={(url) => void shareLink(t('invite.shareMessage', { url })).catch(() => undefined)}
      onCopyUrl={(url) =>
        void copyLink(url)
          .then(() => showToast('linkCopied'))
          .catch(() => undefined)
      }
      onLinkEnabled={setEnabled}
      onResetLink={reset}
      onOpenProfile={(username) => router.push({ pathname: '/u/[username]', params: { username } })}
      onAddMoment={() => router.push('/camera')}
      onHelp={() => router.push('/settings/help')}
    />
  );
}
