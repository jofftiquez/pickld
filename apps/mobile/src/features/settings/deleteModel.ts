// Delete account (M4-19; FR-PRV-02, FR-PRV-03). Pure: the DELETE check and the export card's state from
// fn:data-export's answer (M4-18).
import { z } from 'zod';

export const CONFIRM_WORD = 'DELETE';

/** Exactly DELETE (capitals, as asked); spaces around it are forgiven, a lowercase "delete" is not. */
export function canDelete(typed: string): boolean {
  return typed.trim() === CONFIRM_WORD;
}

export const exportStatus = z.object({
  status: z.enum(['none', 'pending', 'running', 'done', 'failed']),
  requestedAt: z.string().nullable(),
  url: z.string().url().nullable(),
  expiresAt: z.string().nullable(),
});
export type ExportStatus = z.infer<typeof exportStatus>;

export type ExportCard =
  | { kind: 'none' }
  | { kind: 'preparing' }
  | { kind: 'ready'; url: string; expiresAt: string | null }
  | { kind: 'failed' };

/** A done job without a URL can't be opened, so it reads as failed and offers Try again. */
export function exportCard(status: ExportStatus | null | undefined): ExportCard {
  switch (status?.status) {
    case 'pending':
    case 'running':
      return { kind: 'preparing' };
    case 'done':
      return status.url ? { kind: 'ready', url: status.url, expiresAt: status.expiresAt } : { kind: 'failed' };
    case 'failed':
      return { kind: 'failed' };
    default:
      return { kind: 'none' };
  }
}
