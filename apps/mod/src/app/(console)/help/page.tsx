import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ReactNode } from 'react';

import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

// Console help (M3-28): the moderator playbook (apps/mod/content/playbook.md, moderators only) and the
// public Community Guidelines, read from the same file pickld.me/guidelines serves
// (apps/web/content/legal/guidelines.md) so the two can't drift apart. Only the Markdown those files use
// is supported: # headings, - lists and paragraphs.
async function read(file: string): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), file), 'utf8');
  } catch {
    return null;
  }
}

function render(markdown: string): ReactNode[] {
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const heading = /^(#{1,3})\s+(.*)$/.exec(block);
      if (heading) {
        const level = heading[1]!.length;
        const Tag = (['h2', 'h3', 'h4'] as const)[level - 1]!;
        const size = [22, 17, 15][level - 1];
        return (
          <Tag key={i} style={{ fontSize: size, fontWeight: 800, color: colors.ink, margin: '18px 0 6px' }}>
            {heading[2]}
          </Tag>
        );
      }
      if (block.split('\n').every((l) => l.startsWith('- '))) {
        return (
          <ul key={i} style={{ margin: '4px 0', paddingLeft: 20 }}>
            {block.split('\n').map((l, j) => (
              <li key={j} style={{ margin: '4px 0' }}>
                {l.slice(2)}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i} style={{ margin: '6px 0' }}>
          {block.replace(/\n/g, ' ')}
        </p>
      );
    });
}

export default async function Help() {
  const docs = [
    { label: t('help.playbook'), text: await read('content/playbook.md') },
    { label: t('help.guidelines'), text: await read('../web/content/legal/guidelines.md') },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820 }}>
      <header>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.52, margin: 0 }}>{t('help.title')}</h1>
        <p style={{ color: colors.muted, margin: '4px 0 0', fontSize: 13 }}>{t('help.subtitle')}</p>
      </header>
      {docs.map((doc) => (
        <section
          key={doc.label}
          aria-label={doc.label}
          style={{
            background: colors.surface,
            borderRadius: radius.card,
            padding: '6px 24px 18px',
            fontSize: 14,
            lineHeight: 1.55,
            color: colors.inkSoft,
          }}
        >
          {doc.text ? render(doc.text) : <p style={{ margin: '18px 0 0' }}>{t('help.missing')}</p>}
        </section>
      ))}
    </div>
  );
}
