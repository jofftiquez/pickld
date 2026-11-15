import { colors, radius } from '@/theme/tokens';

import { Card } from '~/components/Card';
import { InviteGraph } from '~/components/InviteGraph';
import { PageHeader } from '~/components/PageHeader';
import { Section } from '~/components/Section';
import { Table } from '~/components/Table';
import { Tile } from '~/components/Tile';
import { t } from '~/i18n/t';
import { loadInviteNetwork, nodeName } from '~/lib/inviteGraph';
import { supabase } from '~/lib/supabase';

const TOP = 15;

// The whole invite network (console only, rules 9 and 10): everyone who joined with an invite, the waitlist and
// console codes they started from, and who brought in whom, as a graph to pan, zoom and click through (0145).
export default async function InviteNetwork() {
  const network = await loadInviteNetwork(await supabase());
  const people = network.nodes.filter((n) => n.type === 'person');
  const sources = network.nodes.filter((n) => n.type !== 'person');
  const top = people
    .filter((n) => (n.total ?? 0) > 0)
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || b.direct - a.direct)
    .slice(0, TOP);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      <PageHeader title={t('network.title')} subtitle={t('network.subtitle')} />

      <Section title={t('network.totals')}>
        <Tile label={t('network.people')} value={network.people.toLocaleString('en-US')} />
        <Tile
          label={t('network.roots')}
          value={sources.reduce((sum, n) => sum + n.direct, 0).toLocaleString('en-US')}
        />
        <Tile
          label={t('network.biggest')}
          value={top[0] ? String(top[0].total) : t('network.none')}
          hint={top[0] ? nodeName(top[0]) : undefined}
        />
        <Tile
          label={t('network.suspended')}
          value={String(people.filter((n) => n.status === 'suspended').length)}
          alert={people.some((n) => n.status === 'suspended')}
        />
      </Section>

      {network.nodes.length === 0 ? (
        <p style={{ margin: 0, color: colors.muted, fontSize: 14 }}>{t('network.empty')}</p>
      ) : (
        <section
          aria-label={t('network.label')}
          style={{ background: colors.surface, borderRadius: radius.card, padding: 16, display: 'grid', gap: 8 }}
        >
          <InviteGraph nodes={network.nodes} edges={network.edges} height={640} label={t('network.label')} />
          {network.truncated ? (
            <p style={{ margin: 0, color: colors.muted, fontSize: 12 }}>
              {t('network.truncated', { count: network.limit.toLocaleString('en-US') })}
            </p>
          ) : null}
        </section>
      )}

      <section style={{ display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t('network.top')}</h2>
        <Card label={t('network.top')}>
          <Table
            columns={[
              { key: 'person', label: t('network.columns.person') },
              { key: 'direct', label: t('network.columns.direct'), width: 110, align: 'right' },
              { key: 'total', label: t('network.columns.total'), width: 110, align: 'right' },
              { key: 'status', label: t('network.columns.status'), width: 170 },
            ]}
            empty={t('network.empty')}
            rows={top.map((n) => ({
              key: n.id,
              href: `/users/${n.id}#invite-tree`,
              linkLabel: n.username ? `@${n.username}` : undefined,
              cells: [
                <span key="person" style={{ fontWeight: 700 }}>
                  {nodeName(n)}
                  {n.display_name ? (
                    <span style={{ color: colors.muted, fontWeight: 400 }}> · {n.display_name}</span>
                  ) : null}
                </span>,
                String(n.direct),
                String(n.total),
                <span key="status" style={{ color: n.status === 'suspended' ? colors.likeText : colors.muted }}>
                  {t(`users.invites.status.${n.status ?? 'active'}`)}
                  {n.frozen ? ` · ${t('graph.paused')}` : ''}
                </span>,
              ],
            }))}
          />
        </Card>
      </section>
    </div>
  );
}
