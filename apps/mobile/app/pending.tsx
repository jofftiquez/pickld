import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { replaceUpload } from '@/features/capture/replaceUpload';
import { retryUpload } from '@/features/jar/retryUpload';
import { PendingView } from '@/features/pending/PendingView';
import { usePendingUploads } from '@/features/pending/usePendingUploads';
import { captureError } from '@/lib/monitoring';
import { discardItem } from '@/lib/queue/store';

// /pending (FR-CAP-04, NFR-OFF-01): Pending uploads, every moment still on the phone across all days. Opened
// from Today's header button and from Settings.
export default function PendingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { days } = usePendingUploads();
  return (
    <PendingView
      days={days}
      now={new Date()}
      insets={insets}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onOpen={(row) => router.push(`/edit/${row.id}`)}
      onRetry={(row) => void retryUpload(row.id)}
      onReplace={(row) => void replaceUpload(row.id)}
      onDiscard={(row) =>
        // It started uploading since the list was drawn: it can't be discarded now, and the list updates.
        void discardItem(row.id).catch((error: unknown) => captureError(error, { area: 'pending-discard' }))
      }
    />
  );
}
