// Reporting (M3-21; FR-SAF-01). The database is the referee (0021): submit_report refuses targets the
// reporter can't see (42501, same as "doesn't exist") and their own content (22023), ignores a repeat tap,
// and links the report to the moderation queue. Nobody but moderators can read reports, so success is the
// "Report sent" signal.
import { useMutation } from '@tanstack/react-query';

import { track } from '@/lib/analytics';
import type { Enums } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type ReportTarget = Enums<'target_type'>;
export type ReportReason = Enums<'report_reason'>;

/** In the order of the Report sheet (design: Report). */
export const REPORT_REASONS = [
  'sexual',
  'harassment',
  'violence',
  'hate',
  'spam',
  'under_13',
  'other',
] as const satisfies readonly ReportReason[];

export type ReportInput = { target: ReportTarget; targetId: string; reason: ReportReason };

export class ReportError extends Error {
  constructor(readonly kind: 'unavailable' | 'own' | 'failed') {
    super(kind);
  }
}

export async function submitReport({ target, targetId, reason }: ReportInput): Promise<void> {
  const { error } = await getSupabase().rpc('submit_report', { target, target_id: targetId, reason });
  if (!error) return;
  if (error.code === '42501') throw new ReportError('unavailable');
  if (error.code === '22023') throw new ReportError('own');
  throw new ReportError('failed');
}

export function useReport() {
  return useMutation({
    mutationFn: submitReport,
    onSuccess: (_data, { target }) => track('report_submitted', { target }),
  });
}
