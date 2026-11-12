import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildThread, type ThreadComment } from '@/features/comments/commentsModel';
import { CommentsView } from '@/features/comments/CommentsView';
import { useComments } from '@/features/comments/useComments';
import { jarTitle } from '@/features/jar/shareJar';
import { useJarPage } from '@/features/jar/useJarPage';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { ReportSheet } from '@/features/safety/ReportSheet';

// /comments/[jarId] (M3-11; FR-SOC-06): the jar's thread, from the comment pill on the Jar page or Moment
// detail. The jar comes from the jar page query (title, owner, count); RLS decides what both return.
export default function CommentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jarId } = useLocalSearchParams<{ jarId: string }>();
  const page = useJarPage(jarId);
  const comments = useComments(jarId);
  const { viewerId } = comments;
  const me = useQuery({
    queryKey: todayQueryKeys.me(viewerId ?? ''),
    queryFn: () => fetchMe(viewerId ?? ''),
    enabled: viewerId !== null,
  });
  const jar = page.data;
  const [reporting, setReporting] = useState<ThreadComment | null>(null);

  return (
    <>
      <CommentsView
        jarTitle={jar ? jarTitle(jar, t) : null}
        count={jar?.jar.comment_count ?? null}
        thread={
          jar && comments.comments && viewerId !== null
            ? buildThread(comments.comments, viewerId, jar.jar.user_id)
            : undefined
        }
        failed={comments.failed || page.failed}
        unavailable={jar === null}
        myName={me.data?.displayName ?? null}
        now={new Date()}
        insets={insets}
        isSending={comments.isSending}
        sendFailed={comments.sendFailed}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/jars'))}
        onRetry={() => {
          void comments.refresh();
          void page.refresh();
        }}
        onSend={comments.add}
        onDelete={comments.remove}
        onReport={setReporting}
      />
      <ReportSheet
        visible={reporting !== null}
        subject={reporting ? { target: 'comment', targetId: reporting.id } : null}
        name={reporting?.author?.display_name ?? t('comments.someone')}
        onClose={() => setReporting(null)}
      />
    </>
  );
}
