'use client';

import { useRouter } from 'next/navigation';
import { type CSSProperties, useCallback, useEffect, useState, useTransition } from 'react';

import { colors, radius } from '@/theme/tokens';

import { decide } from '~/app/(console)/actions';
import { t } from '~/i18n/t';
import { type Action, allowed, GUIDELINES, type Guideline } from '~/lib/decide';
import type { Filter, QueueItem } from '~/lib/queue';
import { input } from '~/lib/styles';

const base: CSSProperties = {
  font: 'inherit',
  fontSize: 14,
  fontWeight: 800,
  minHeight: 44,
  borderRadius: radius.input,
  border: `1px solid ${colors.divider}`,
  background: colors.surface,
  color: colors.ink,
};
const tone: Record<Action, CSSProperties> = {
  keep: { ...base, fontSize: 15, border: 'none', background: colors.brand, color: colors.surface },
  remove: { ...base, fontSize: 15, border: 'none', background: colors.danger, color: colors.surface },
  remove_warn: base,
  escalate: base,
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
          router.replace(filter === 'all' ? '/' : `/?filter=${filter}`, { scroll: false });
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
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const button = (action: Action) => (
    <button
      type="button"
      onClick={() => run(action)}
      disabled={pending || !can[action]}
      title={t(hint[action])}
      aria-keyshortcuts={Object.keys(SHORTCUTS)
        .find((k) => SHORTCUTS[k] === action)
        ?.toUpperCase()}
      style={{ ...tone[action], opacity: can[action] ? 1 : 0.4, cursor: can[action] ? 'pointer' : 'default' }}
    >
      {t(label[action])}
    </button>
  );

  return (
    <div role="group" aria-label={t('decide.label')} style={{ display: 'grid', gap: 8, marginTop: 'auto' }}>
      {can.remove ? (
        <label style={{ display: 'grid', gap: 4, fontSize: 12, color: colors.muted }}>
          {t('decide.guideline')}
          <select
            value={guideline}
            onChange={(e) => setGuideline(e.target.value as Guideline | '')}
            style={{ ...input, fontSize: 14, padding: '9px 10px' }}
          >
            <option value="">{t('decide.guidelinePick')}</option>
            {GUIDELINES.map((g) => (
              <option key={g} value={g}>
                {t(`guideline.${g}`)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {button('keep')}
        {button('remove')}
        {button('remove_warn')}
        {button('escalate')}
      </div>
      <p
        role="status"
        aria-live="polite"
        style={{ margin: 0, minHeight: 18, fontSize: 12, color: message ? colors.danger : colors.muted }}
      >
        {pending ? t('decide.working') : (message ?? t('decide.shortcuts'))}
      </p>
    </div>
  );
}
