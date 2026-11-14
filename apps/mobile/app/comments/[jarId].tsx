import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseEdits } from '@/features/edit/edits';
import { buildThread, type ThreadComment } from '@/features/comments/commentsModel';
import { CommentsView } from '@/features/comments/CommentsView';
import { useCommentMoment } from '@/features/comments/useCommentMoment';
import { useComments } from '@/features/comments/useComments';
import { firstName, jarTitle } from '@/features/jar/shareJar';
import { useJarPage } from '@/features/jar/useJarPage';
import { fetchMe, todayQueryKeys } from '@/features/jar/useToday';
import { ReportSheet } from '@/features/safety/ReportSheet';
import { useBlockFlow } from '@/features/safety/useBlockFlow';

// /comments/[jarId] (M3-11; FR-SOC-06): the jar's thread, from the comment pill on the Jar page.
// /comments/[jarId]?momentId=… (0068; D-51): that moment's own thread, from Moment detail or a
// notification, opening with the whole moment drawn as on Moment detail, then its author and caption,
// scrolling with the comments (D-84). Only a live moment the viewer may see comes back, so a checking,
// removed or hidden moment stays "not available" and no photo shows. The jar thread reads the jar page query (title,
// owner, count); a moment thread reads only the moment, which a reader may see before its jar is
// published (D-48). RLS decides what each returns.
export default function CommentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { jarId, momentId } = useLocalSearchParams<{ jarId: string; momentId?: string }>();
  const page = useJarPage(momentId ? undefined : jarId);
  const moment = useCommentMoment(jarId, momentId);
  const comments = useComments(jarId, momentId);
  const { viewerId } = comments;
  const me = useQuery({
    queryKey: todayQueryKeys.me(viewerId ?? ''),
    queryFn: () => fetchMe(viewerId ?? ''),
    enabled: viewerId !== null,
  });
  const jar = page.data;
  const m = moment.data;
  const [reporting, setReporting] = useState<ThreadComment | null>(null);
  // Their comments drop out when the thread is read again.
  const blockFlow = useBlockFlow();

  const ownerId = momentId ? m?.user_id : jar?.jar.user_id;
  const slot = m ? t(`slots.${m.slot}`) : null;

  return (
    <>
      <CommentsView
        jarTitle={
          momentId
            ? m && slot
              ? t('comments.momentTitle', { name: firstName(m.author?.display_name ?? t('comments.someone')), slot })
              : null
            : jar
              ? jarTitle(jar, t)
              : null
        }
        count={momentId ? (m?.comment_count ?? null) : (jar?.jar.comment_count ?? null)}
        moment={
          m && slot
            ? {
                uri: m.fullUrl ?? m.thumbUrl,
                edits: parseEdits(m.edits),
                stamp: m.tz ? { capturedAt: new Date(m.captured_at ?? m.added_at), tz: m.tz } : null,
                slot,
                authorName: m.author?.display_name ?? t('comments.someone'),
                caption: m.caption?.trim() || null,
              }
            : null
        }
        thread={
          ownerId !== undefined && comments.comments && viewerId !== null
            ? buildThread(comments.comments, viewerId, ownerId)
            : undefined
        }
        failed={comments.failed || (momentId ? moment.failed : page.failed)}
        unavailable={momentId ? m === null : jar === null}
        myName={me.data?.displayName ?? null}
        now={new Date()}
        insets={insets}
        isSending={comments.isSending}
        sendFailed={comments.sendFailed}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/jars'))}
        onRetry={() => {
          void comments.refresh();
          void (momentId ? moment.refresh() : page.refresh());
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
        onBlock={
          reporting?.author
            ? () => {
                if (reporting.author) blockFlow.open({ id: reporting.user_id, name: reporting.author.display_name });
              }
            : undefined
        }
      />
      {blockFlow.dialog}
    </>
  );
}
