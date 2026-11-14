import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formFrom,
  formProblems,
  profileUpdate,
  saveErrorOf,
  type EditForm,
  type SaveError,
} from '@/features/profile/editProfileModel';
import { EditProfileView } from '@/features/profile/EditProfileView';
import { pickAndUploadProfileImage } from '@/features/profile/uploadProfileImage';
import { useProfile } from '@/features/profile/useProfile';
import { useUsernameAvailability } from '@/features/profile/useUsernameAvailability';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { useAuthStore } from '@/lib/authStore';
import { getSupabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { colors } from '@/theme/tokens';

type Kind = 'avatar' | 'cover';

// /settings/profile (M3-15; FR-SOC-11, FR-ACC-03, FR-ONB-04): Edit profile, from My profile. Writes only
// the columns that changed, as the user, so the profiles policies and checks decide (0001, 0002, 0016,
// 0018). After a save every query that shows the person's name or photo is read again, so a new avatar
// shows across the app (D-93): each screen's avatar query is keyed by the avatar key it reads.
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id ?? null);
  const me = useQuery({
    queryKey: todayQueryKeys.me(userId ?? ''),
    queryFn: () => fetchMe(userId ?? ''),
    enabled: userId !== null,
  });
  const { data } = useProfile(me.data?.username);
  const original = data?.profile ?? null;

  // Only the fields the person changed; the rest follow the saved profile.
  const [edits, setEdits] = useState<Partial<EditForm>>({});
  const form = original ? { ...formFrom(original), ...edits } : null;
  const [previews, setPreviews] = useState<Partial<Record<Kind, string>>>({});
  const [uploading, setUploading] = useState({ avatar: false, cover: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | 'upload' | null>(null);

  const usernameStatus = useUsernameAvailability(form?.username ?? '', original?.username ?? '');

  if (!form || !original || userId === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.muted} testID="edit-profile-loading" />
      </View>
    );
  }

  const update = profileUpdate(original, form);
  const canSave =
    Object.keys(update).length > 0 &&
    formProblems(form, usernameStatus).length === 0 &&
    !uploading.avatar &&
    !uploading.cover;

  const change = async (kind: Kind) => {
    setSaveError(null);
    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      const uploaded = await pickAndUploadProfileImage(kind);
      if (uploaded) {
        setPreviews((p) => ({ ...p, [kind]: uploaded.localUri }));
        setEdits((e) => ({ ...e, [kind === 'avatar' ? 'avatarPath' : 'coverPath']: uploaded.key }));
      }
    } catch {
      setSaveError('upload');
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }));
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await getSupabase().from('profiles').update(update).eq('id', userId);
    setSaving(false);
    if (error) {
      setSaveError(saveErrorOf(error));
      return;
    }
    await Promise.all(
      [
        'profile',
        'me',
        'feed',
        'feedAuthors',
        'jarPage',
        'momentsFeed',
        'comments',
        'explore',
        'search',
        'followList',
        'notifications',
        'avatars',
      ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
    showToast(
      Object.keys(update).every((k) => k === 'avatar_path' || k === 'cover_path') ? 'photoUpdated' : 'profileUpdated',
    );
    // A new username moves My profile to its new address.
    if (update.username) router.dismissTo({ pathname: '/u/[username]', params: { username: update.username } });
    else if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/u/[username]', params: { username: original.username } });
  };

  return (
    <EditProfileView
      form={form}
      onChange={(patch) => {
        setSaveError(null);
        setEdits((e) => ({ ...e, ...patch }));
      }}
      usernameStatus={usernameStatus}
      avatarUri={previews.avatar ?? data?.images?.avatar ?? null}
      coverUri={previews.cover ?? data?.images?.cover ?? null}
      uploading={uploading}
      canSave={canSave}
      saving={saving}
      saveError={saveError}
      insets={insets}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onSave={() => void save()}
      onChangeAvatar={() => void change('avatar')}
      onChangeCover={() => void change('cover')}
    />
  );
}
