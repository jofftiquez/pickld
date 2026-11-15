'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { decide } from '~/app/(console)/actions';
import { t } from '~/i18n/t';
import { type Action, allowed, GUIDELINES, type Guideline } from '~/lib/decide';
import type { Filter, QueueItem } from '~/lib/queue';
import { cn } from '~/lib/utils';

import { Button } from './ui/button';
import { NativeSelect, NativeSelectOption } from './ui/native-select';

// Keep and Remove lead in solid green and red; the other two sit quietly beside them.
const tone: Record<Action, 'default' | 'destructive' | 'outline'> = {
  keep: 'default',
  remove: 'destructive',
  remove_warn: 'outline',
  escalate: 'outline',
};
const label: Record<Action, string> = {
  keep: 'decide.keep',
  remove: 'decide.remove',
  remove_warn: 'decide.removeWarn',
  escalate: 'decide.escalate',
};
const hint: Record<Action, string> = {
  keep: 'decide.keepHint',
  remove: 'decide.removeHint',
  remove_warn: 'decide.removeWarnHint',
  escalate: 'decide.escalateHint',
};
const SHORTCUTS: Record<string, Action> = { k: 'keep', r: 'remove', e: 'escalate' };

/**
 * Keep, Remove, Remove and warn, Escalate (FR-MOD-04; design: ModConsole), with K, R and E on the keyboard.
 * A removal needs the guideline it broke. After a decision the queue moves on to the oldest item left.
 */
export function Decisions({
  item,
  filter,
  initialGuideline,
}: {
  item: Pick<QueueItem, 'id' | 'status' | 'kind'>;
  filter: Filter;
  initialGuideline: Guideline | null;
}) {
  const router = useRouter();
  const [guideline, setGuideline] = useState<Guideline | ''>(initialGuideline ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const group = useRef<HTMLDivElement>(null);
  const can = allowed(item);

  const run = useCallback(
    (action: Action) => {
      if (pending || !can[action]) return;
      const needs = action === 'remove' || action === 'remove_warn';
      if (needs && !guideline) {
        // Said, not focused: moving focus into the picker would swallow the next K or E.
        setMessage(t('decide.needGuideline'));
        return;
      }
      setMessage(null);
      start(async () => {
        const result = await decide({ itemId: item.id, action, ...(needs && guideline ? { guideline } : {}) });
        if (result.ok) {
          router.replace(filter === 'all' ? '/queue' : `/queue?filter=${filter}`, { scroll: false });
        } else {
          setMessage(t(`decide.errors.${result.code}`));
          router.refresh();
        }
      });
    },
    [pending, can, guideline, item.id, filter, router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const action = SHORTCUTS[e.key.toLowerCase()];
      if (!action) return;
      e.preventDefault();
      run(action);
    }
    window.addEventListener('keydown', onKey);
    // The panel is server-rendered, so it shows before the shortcuts listen; this says when they do.
    const el = group.current;
    el?.setAttribute('data-shortcuts', 'on');
    return () => {
      window.removeEventListener('keydown', onKey);
      el?.removeAttribute('data-shortcuts');
    };
  }, [run]);

  const button = (action: Action) => (
    <Button
      type="button"
      variant={tone[action]}
      onClick={() => run(action)}
      disabled={pending || !can[action]}
      title={t(hint[action])}
      aria-keyshortcuts={Object.keys(SHORTCUTS)
        .find((k) => SHORTCUTS[k] === action)
        ?.toUpperCase()}
      className={cn('rounded-input disabled:opacity-40', tone[action] !== 'outline' && 'text-[15px] font-extrabold')}
    >
      {t(label[action])}
    </Button>
  );

  return (
    <div ref={group} role="group" aria-label={t('decide.label')} className="mt-auto grid gap-2">
      {can.remove ? (
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('decide.guideline')}
          <NativeSelect
            value={guideline}
            onChange={(e) => setGuideline(e.target.value as Guideline | '')}
            wrapperClassName="w-full"
            className="text-foreground"
          >
            <NativeSelectOption value="">{t('decide.guidelinePick')}</NativeSelectOption>
            {GUIDELINES.map((g) => (
              <NativeSelectOption key={g} value={g}>
                {t(`guideline.${g}`)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {button('keep')}
        {button('remove')}
        {button('remove_warn')}
        {button('escalate')}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn('m-0 min-h-[18px] text-xs', message ? 'text-destructive' : 'text-muted-foreground')}
      >
        {pending ? t('decide.working') : (message ?? t('decide.shortcuts'))}
      </p>
    </div>
  );
}
