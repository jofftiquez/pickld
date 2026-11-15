import { colors } from '@/theme/tokens';

import { Badge } from '~/components/ui/badge';
import { t } from '~/i18n/t';
import type { QueueItem } from '~/lib/queue';

const tones = {
  auto_check: { background: colors.zoneTint, color: colors.zoneText },
  report: { background: colors.dangerTint, color: colors.likeText },
  appeal: { background: colors.appealTint, color: colors.appealText },
  escalated: { background: colors.ink, color: colors.surface },
} as const;

/** Where an item came from (design: ModConsole): Auto-check, Report ×n, Appeal, or Escalated. */
export function SourceBadge({ item }: { item: Pick<QueueItem, 'source' | 'status' | 'report_count'> }) {
  const key = item.status === 'escalated' ? 'escalated' : item.source;
  const label = key === 'report' ? t('source.report', { count: item.report_count }) : t(`source.${key}`);
  return (
    <Badge className="font-bold" style={tones[key]}>
      {label}
    </Badge>
  );
}
