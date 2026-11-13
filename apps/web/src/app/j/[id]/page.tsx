import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { colors, radius } from '@/theme/tokens';

import { Avatar } from '~/components/Avatar';
import { MomentPhoto } from '~/components/MomentPhoto';
import { Page } from '~/components/Page';
import { t } from '~/i18n/t';
import { coverFirst, jarCaption, longDate, weekday } from '~/lib/format';
import { getJar } from '~/lib/publicPage';
import { cardShadow } from '~/lib/styles';

// pickld.me/j/<id> (FR-WEB-01, C-2; design: WebShare). Everyone jars show their live, non-private
// moments, the jar's cover first (D-56); Readers jars show a teaser with no photos. Anything else is a 404
// (decided in public_jar, 0025 and 0069).

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const jar = await getJar((await params).id);
  if (!jar) return {};
  const name = jar.author.display_name;
  const day = weekday(jar.local_date);
  const title = jar.readers_only ? t('jar.titleReaders', { name }) : t('jar.titleEveryone', { name, weekday: day });
  const description = jar.readers_only
    ? t('og.descriptionReaders', { name })
    : t('og.description', { name, weekday: day, count: String(jar.visible_count) });
  const url = `/j/${jar.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'article', siteName: t('site.name'), title, description, url },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function JarRoute({ params }: Props) {
  const jar = await getJar((await params).id);
  if (!jar) notFound();
  const { author } = jar;
  const name = author.display_name;
  const moments = coverFirst(jar.moments ?? [], jar.cover_moment_id);
  const caption = jarCaption(moments, jar.cover_moment_id);

  return (
    <Page appUrl={`pickld://jar/${jar.id}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar url={author.avatar} name={name} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
            {t('jar.shared', { name, weekday: weekday(jar.local_date) })}
          </h1>
          <span style={{ fontSize: 12, color: colors.muted }}>
            <a href={`/${author.username}`} style={{ color: colors.muted, textDecoration: 'none' }}>
              {t('jar.meta', {
                link: `pickld.me/${author.username}`,
                date: longDate(jar.local_date),
                count: String(jar.visible_count),
              })}
            </a>
          </span>
        </div>
      </div>
      <section style={{ background: colors.surface, borderRadius: radius.tile, padding: 10, boxShadow: cardShadow }}>
        {jar.readers_only ? (
          <div data-testid="readers-teaser" style={{ padding: '18px 8px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t('jar.readersTitle', { name })}</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.inkSoft }}>
              {t('jar.readersBody', { name, count: String(jar.visible_count) })}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5 }}>
              {moments.map((m) => (
                <MomentPhoto key={m.id} moment={m} authorName={name} assetBase={jar.assetBase} />
              ))}
            </div>
            {caption ? (
              <p style={{ margin: '10px 4px 2px', fontSize: 13, color: colors.inkSoft }}>
                {t('jar.caption', { caption })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </Page>
  );
}
