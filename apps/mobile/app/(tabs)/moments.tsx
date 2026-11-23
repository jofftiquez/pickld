import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { caughtUpRow } from '@/features/feed/tabUnread';
import { useSeenBeforeVisit } from '@/features/feed/useTabUnread';
import { GuideTip } from '@/features/guide/GuideTip';
import { useGuideTip } from '@/features/guide/useGuideTip';
import { MomentsFeedView } from '@/features/moments/MomentsFeedView';
import { useMomentsFeed } from '@/features/moments/useMomentsFeed';
import { useTimelineJump } from '@/features/scrubber/useTimelineJump';
import { useAvatarUrls } from '@/lib/avatars';
import { useScreenFocused } from '@/lib/useScreenFocused';

// Moments tab (QA round 1, piece 5; FR-SOC-01, FR-SOC-02, D-52, D-53): live moments from people the user
// reads and their own, newest first. A card opens the moment's thread; Go to jar opens its jar (D-94).
export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The date scrubber's jump (FR-SOC-01): the timeline starts at that day and pages both ways from it.
  const jump = useTimelineJump('moments');
  const feed = useMomentsFeed(jump.from);
  const { userId } = feed;
  // Re-signed when someone changes their photo (D-93).
  const avatars = useAvatarUrls((feed.moments ?? []).map((m) => ({ id: m.author_id, path: m.author_avatar_path })));
  // The spinner shows only for a pull, not for background refetches.
  const [pulling, setPulling] = useState(false);
  // "You're all caught up" above the first moment that was already here on the last visit; order unchanged.
  const seenAt = useSeenBeforeVisit('moments');
  const caughtUpBefore = useMemo(
    () =>
      caughtUpRow(feed.moments ?? [], seenAt, userId, (m) => ({
        key: m.moment_id,
        authorId: m.author_id,
        at: m.added_at,
      })),
    [feed.moments, seenAt, userId],
  );

  // First-time guide (FR-ONB-10): how Moments and Jars are ordered, once, on whichever opens first.
  const guide = useGuideTip([{ id: 'feed', when: true }], useScreenFocused());

  return (
    <View style={styles.root} {...guide.catchTaps}>
      <MomentsFeedView
        key={jump.viewKey}
        moments={feed.moments}
        authors={feed.authors}
        viewerId={userId}
        avatars={avatars}
        insets={insets}
        isLoading={feed.isLoading}
        isRefreshing={pulling}
        isFetchingNextPage={feed.isFetchingNextPage}
        onRefresh={() => {
          jump.refetchDays();
          // Pulling at the top of a jumped-to day goes back to the newest moments.
          if (jump.jumped) return jump.clearJump();
          setPulling(true);
          void feed.refresh().finally(() => setPulling(false));
        }}
        onBackToTop={(mode) => {
          if (jump.jumped) jump.clearJump();
          else if (mode === 'reload') void feed.refresh();
        }}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        scrubber={jump.scrubber}
        isFetchingPreviousPage={feed.isFetchingPreviousPage}
        onStartReached={() => {
          if (feed.hasPreviousPage && !feed.isFetchingPreviousPage) feed.fetchPreviousPage();
        }}
        onOpenJar={(m) => router.push({ pathname: '/jar/[id]', params: { id: m.jar_id } })}
        onToggleLike={feed.toggleLike}
        onOpenComments={(m) =>
          router.push({ pathname: '/comments/[jarId]', params: { jarId: m.jar_id, momentId: m.moment_id } })
        }
        onFindPeople={() => router.navigate('/discover')}
        onInvite={() => router.push('/invite')}
        caughtUpBefore={caughtUpBefore}
        guideTip={
          guide.tip === 'feed' ? (
            <GuideTip id="feed" arrow={{ side: 'top', align: 'start' }} onClose={guide.close} tipRef={guide.tipRef} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
