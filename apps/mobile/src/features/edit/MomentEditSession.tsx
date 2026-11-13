import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { saveMomentEdits } from '@/features/moment/momentActions';
import type { EditableMoment } from '@/features/moment/useEditableMoment';
import { getSupabase } from '@/lib/supabase';

import { EditSession } from './EditSession';

export type MomentEditSessionProps = {
  moment: EditableMoment;
  userId: string;
  focusCaption?: boolean;
  insets: EdgeInsets;
  onLeave: () => void;
};

/**
 * The editor on an uploaded moment (M2-23, FR-CAP-10): Done saves the caption and edits as a proposal that
 * fn:moderate swaps in, and visibility at once (`saveMomentEdits`), then refreshes Today. Needs a connection;
 * if the save fails the editor stays open and the moment keeps its old version.
 */
export function MomentEditSession({ moment, userId, focusCaption, insets, onLeave }: MomentEditSessionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return (
    <EditSession
      photoUri={moment.photoUrl}
      slot={moment.slot}
      shotAt={new Date(moment.shotAt)}
      tz={moment.tz}
      initial={moment}
      saveLabel={t('edit.done')}
      focusCaption={focusCaption}
      insets={insets}
      onLeave={onLeave}
      onSave={async (input) => {
        await saveMomentEdits(getSupabase(), { kind: 'server', momentId: moment.id, jarId: moment.jarId }, input);
        void queryClient.invalidateQueries({ queryKey: ['jar', userId] });
      }}
    />
  );
}
