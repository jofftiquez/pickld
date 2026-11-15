import { Card } from '~/components/Card';
import { Skeleton } from '~/components/ui/skeleton';
import { t } from '~/i18n/t';

// What a console page shows while its data loads: the shape of a header and a table.
export default function Loading() {
  return (
    <div role="status" aria-label={t('table.loading')} className="flex flex-col gap-[18px]">
      <div className="grid gap-2">
        <Skeleton className="h-[26px] w-[220px] motion-reduce:animate-none" />
        <Skeleton className="h-3 w-[320px] motion-reduce:animate-none" />
      </div>
      <Card>
        <div className="border-b p-3.5">
          <Skeleton className="h-3 w-40 motion-reduce:animate-none" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_80px] gap-4 border-b px-3.5 py-4 last:border-b-0">
            {['70%', '60%', '50%', '100%'].map((w) => (
              <Skeleton key={w} className="h-3 motion-reduce:animate-none" style={{ width: w }} />
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}
