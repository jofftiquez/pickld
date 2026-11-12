// Keeps the home screen widgets current (M6-09; FR-WID-01). Runs on Today: whenever a slot fills (a capture
// joins the local queue, so this works offline) the Today widget gets a fresh timeline, with an entry every
// 30 minutes until the jar's day ends and an empty jar after midnight. The Friend widget gets the newest live
// moment from someone the user reads; RLS (moments_others_select) leaves out private moments and jars the user
// can't view. Its thumbnail is copied into the App Group folder, the only place the widget can read files from.
import { useQuery } from '@tanstack/react-query';
import { Directory, File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { z } from 'zod';

import type { Enums } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

import { friendCaption, todayTimeline, type WidgetStrings } from './widgetPayload';
import { FriendWidget, TodayWidget, widgetColors } from './widgets';

const latestRow = z.object({
  id: z.string(),
  jar_id: z.string(),
  user_id: z.string(),
  slot: z.string(),
});
const urlsResponse = z.object({
  data: z.object({ moments: z.array(z.object({ id: z.string(), thumb: z.string().nullable() })) }),
});

export type FriendMoment = {
  momentId: string;
  jarId: string;
  displayName: string;
  slot: Enums<'slot'>;
  thumb: string | null;
};

/** The newest live moment by anyone the user reads, or null. */
export async function fetchFriendMoment(userId: string): Promise<FriendMoment | null> {
  const supabase = getSupabase();
  const follows = await supabase.from('follows').select('author_id').eq('reader_id', userId);
  if (follows.error) throw new Error(follows.error.message);
  const authors = follows.data.map((f) => f.author_id);
  if (authors.length === 0) return null;
  const { data, error } = await supabase
    .from('moments')
    .select('id, jar_id, user_id, slot')
    .in('user_id', authors)
    .eq('status', 'live')
    .order('added_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = z.array(latestRow).parse(data)[0];
  if (!row) return null;
  const [profile, urls] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', row.user_id).single(),
    supabase.functions.invoke<unknown>('photo-urls', { body: { momentIds: [row.id] } }),
  ]);
  const parsed = urlsResponse.safeParse(urls.data);
  return {
    momentId: row.id,
    jarId: row.jar_id,
    displayName: profile.data?.display_name ?? '',
    slot: row.slot as Enums<'slot'>,
    thumb: parsed.success ? (parsed.data.data.moments[0]?.thumb ?? null) : null,
  };
}

/** Copies the thumbnail into the App Group folder under the moment's id; '' when that fails. */
async function sharedImage(friend: FriendMoment): Promise<string> {
  if (!friend.thumb || !widgetsDirectory) return '';
  try {
    const dir = new Directory(widgetsDirectory);
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `friend-${friend.momentId}.jpg`);
    if (!dest.exists) {
      // Only the newest friend photo is kept.
      for (const item of dir.list()) if (item instanceof File && item.name.startsWith('friend-')) item.delete();
      await File.downloadFileAsync(friend.thumb, dest, { idempotent: true });
    }
    return dest.uri;
  } catch {
    return '';
  }
}

export function useWidgetSync(userId: string | null, filledSlots: readonly Enums<'slot'>[], tz: string) {
  const { t } = useTranslation();
  const enabled = Platform.OS === 'ios' && userId !== null;
  const key = filledSlots.join(',');

  useEffect(() => {
    if (!enabled) return;
    const strings: WidgetStrings = {
      title: t('widgets.title'),
      moments: (count, total) => t('widgets.moments', { count, total }),
      nextUp: (tag) => t('widgets.nextUp', { tag }),
      full: t('widgets.full'),
      captureLabel: t('widgets.capture'),
    };
    const entries = todayTimeline(key === '' ? [] : (key.split(',') as Enums<'slot'>[]), new Date(), tz, strings);
    try {
      TodayWidget.updateTimeline(entries.map((e) => ({ date: e.date, props: { ...e.props, colors: widgetColors } })));
    } catch {
      // Widgets are optional: a build without the extension (Expo Go, tests) just skips them.
    }
  }, [enabled, key, tz, t]);

  const friend = useQuery({
    queryKey: ['widgetFriend', userId ?? ''] as const,
    queryFn: () => fetchFriendMoment(userId ?? ''),
    enabled,
  });
  useEffect(() => {
    if (!enabled || friend.data === undefined) return;
    const data = friend.data;
    void (async () => {
      const imageUri = data ? await sharedImage(data) : '';
      try {
        FriendWidget.updateSnapshot({
          caption: data ? friendCaption(data.displayName, data.slot) : '',
          imageUri,
          url: data ? `pickld://moment/${data.momentId}?jar=${data.jarId}` : 'pickld://jars',
          placeholder: t('widgets.friendEmpty'),
          colors: widgetColors,
        });
      } catch {
        // See above.
      }
    })();
  }, [enabled, friend.data, t]);
}
