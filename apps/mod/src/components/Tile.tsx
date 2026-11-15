import { cn } from '~/lib/utils';

/**
 * A stat tile (shadcn/ui card surface): the number on top, its label under it (design: ModConsole). Goes inside a
 * <dl>. `alert` tints it when the number needs attention; `hint` adds a short line.
 */
export function Tile({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col-reverse justify-end gap-1 rounded-tile border px-4 py-3.5 shadow-xs',
        alert ? 'border-transparent bg-destructive-tint' : 'bg-card',
      )}
    >
      <dt className={cn('text-xs font-semibold', alert ? 'text-destructive-text' : 'text-muted-foreground')}>
        {label}
        {hint ? <span className="block font-normal">{hint}</span> : null}
      </dt>
      <dd
        className={cn('m-0 text-2xl font-extrabold tabular-nums', alert ? 'text-destructive-text' : 'text-foreground')}
      >
        {value}
      </dd>
    </div>
  );
}
