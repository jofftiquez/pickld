import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ReactNode } from 'react';

import { colors } from '@/theme/tokens';

import { t } from '~/i18n/t';

import { Footer } from './Footer';
import { Header } from './Header';
import { column } from './Page';

export type LegalSlug = 'terms' | 'privacy' | 'guidelines';

/**
 * Terms, Privacy Policy and Community Guidelines (FR-PRV-04), from apps/web/content/legal/<slug>.md
 * (drafted by the founders and a lawyer, M1-27). Until a draft exists the page says it is being prepared.
 * Only the Markdown the drafts need is supported: # headings, - lists and paragraphs.
 */
async function draft(slug: LegalSlug): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), 'content/legal', `${slug}.md`), 'utf8');
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
        const Tag = (['h1', 'h2', 'h3'] as const)[heading[1]!.length - 1]!;
        return <Tag key={i}>{heading[2]}</Tag>;
      }
      if (block.split('\n').every((l) => l.startsWith('- '))) {
        return (
          <ul key={i}>
            {block.split('\n').map((l, j) => (
              <li key={j}>{l.slice(2)}</li>
            ))}
          </ul>
        );
      }
      return <p key={i}>{block.replace(/\n/g, ' ')}</p>;
    });
}

export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const text = await draft(slug);
  return (
    <div style={column}>
      <Header getAppUrl="/" />
      <main style={{ padding: '18px', flex: 1, fontSize: 15, lineHeight: 1.55, color: colors.inkSoft }}>
        {text ? (
          render(text)
        ) : (
          <>
            <h1 style={{ color: colors.ink }}>{t(`legal.${slug}`)}</h1>
            <p>{t('legal.draft')}</p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
