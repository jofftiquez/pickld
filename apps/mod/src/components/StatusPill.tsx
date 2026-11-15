import { Badge } from '~/components/ui/badge';
import { t } from '~/i18n/t';
import { cn } from '~/lib/utils';

/** Draft or Published, as a badge (design: ModConsole's source badges). */
export function StatusPill({ status }: { status: 'draft' | 'published' }) {
  const draft = status === 'draft';
  return (
    <Badge
      className={cn(
        'font-bold',
        draft ? 'border-dashed border-input bg-secondary text-foreground' : 'bg-brand-tint text-brand-text',
      )}
    >
      {t(`stickers.status.${status}`)}
    </Badge>
  );
}
