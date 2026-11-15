import { colors, radius } from '@/theme/tokens';

import { Button } from '~/components/ui/button';
import { Card } from '~/components/Card';
import { LetInForm } from '~/components/LetInForm';
import { MakeCodeForm } from '~/components/MakeCodeForm';
import { PageHeader } from '~/components/PageHeader';
import { Section } from '~/components/Section';
import { Table } from '~/components/Table';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { type AdminCode, loadCodes, loadInviteSummary, shortDay } from '~/lib/invites';
import { supabase } from '~/lib/supabase';

import { switchCode } from './actions';

const LET_IN = 200;
const panel = { background: colors.surface, borderRadius: radius.card, padding: 16 } as const;

function madeBy(c: AdminCode): string {
  if (!c.made_by) return '—';
  return t(c.made_by.founder ? 'invites.madeBy.founder' : 'invites.madeBy.moderator', {
    name: c.made_by.display_name,
  });
}

function StateCell({ c }: { c: AdminCode }) {
  const on = c.state === 'on';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontWeight: 700, color: on ? colors.brandText : colors.muted }}>
        {t(`invites.states.${c.state}`)}
      </span>
      {c.state === 'on' || c.state === 'off' ? (
        <form action={switchCode}>
          <input type="hidden" name="code" value={c.code} />
          <input type="hidden" name="enabled" value={on ? '0' : '1'} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            aria-label={t(on ? 'invites.switchOffLabel' : 'invites.switchOnLabel', { code: c.code })}
          >
            {t(on ? 'invites.switchOff' : 'invites.switchOn')}
          </Button>
        </form>
      ) : null}
    </span>
  );
}

// Admin invite codes (INV-10, design: ModInviteCodes): codes moderators hand out in person, at events or for
// App Review, and the founders' "let people in early" button. Every write goes through a Postgres function
// that checks the role and writes the audit row (0131, 0142).
export default async function Invites() {
  const client = await supabase();
  const [summary, codes] = await Promise.all([loadInviteSummary(client), loadCodes(client)]);
  const letIn = Math.min(LET_IN, summary.waiting);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title={t('invites.title')} subtitle={t('invites.subtitle')} />

      <Section title={t('invites.totals.title')}>
        <Tile label={t('invites.totals.waiting')} value={summary.waiting.toLocaleString('en-US')} />
        <Tile label={t('invites.totals.joined')} value={summary.joined_with_codes.toLocaleString('en-US')} />
        <Tile
          label={t('invites.totals.ends')}
          value={summary.ends_at ? shortDay(summary.ends_at) : t('invites.totals.off')}
          hint={summary.ends_at ? undefined : t('invites.totals.offHint')}
        />
      </Section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('invites.list.title')}</h2>
        <Card label={t('invites.list.title')}>
          <Table
            columns={[
              { key: 'code', label: t('invites.columns.code'), width: 110 },
              { key: 'note', label: t('invites.columns.note') },
              { key: 'used', label: t('invites.columns.used'), width: 100 },
              { key: 'ends', label: t('invites.columns.ends'), width: 100 },
              { key: 'by', label: t('invites.columns.by'), width: 170 },
              { key: 'state', label: t('invites.columns.state'), width: 190 },
            ]}
            empty={t('invites.list.empty')}
            rows={codes.map((c) => ({
              key: c.code,
              cells: [
                <span key="code" style={{ fontWeight: 800, letterSpacing: 1, fontFamily: 'ui-monospace, monospace' }}>
                  {c.code}
                </span>,
                <span key="note" style={{ overflowWrap: 'anywhere' }}>
                  {c.note ?? '—'}
                </span>,
                t('invites.used', { uses: c.uses, max: c.max_uses }),
                <span key="ends" style={{ color: colors.muted }}>
                  {c.expires_at ? shortDay(c.expires_at) : '—'}
                </span>,
                <span key="by" style={{ color: colors.muted }}>
                  {madeBy(c)}
                </span>,
                <StateCell key="state" c={c} />,
              ],
            }))}
          />
        </Card>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 16 }}>
        <section aria-label={t('invites.new.title')} style={{ ...panel, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('invites.new.title')}</h2>
          <MakeCodeForm />
        </section>
        <section aria-label={t('invites.letIn.title')} style={{ ...panel, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('invites.letIn.title')}</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            {t('invites.letIn.body', { count: summary.waiting.toLocaleString('en-US') })}
          </p>
          <LetInForm count={letIn} />
        </section>
      </div>
      <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>{t('invites.waitlistLater')}</p>
    </div>
  );
}
