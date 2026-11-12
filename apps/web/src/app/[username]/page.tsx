import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { colors, radius } from '@/theme/tokens';

import { Avatar } from '~/components/Avatar';
import { MomentPhoto } from '~/components/MomentPhoto';
import { Page } from '~/components/Page';
import { t } from '~/i18n/t';
import { bySlot, longDate } from '~/lib/format';
import { getProfile } from '~/lib/publicPage';
import { cardShadow } from '~/lib/styles';

// pickld.me/<username> (FR-WEB-01, C-2): the public profile and its newest published Everyone jars, each
// linking to its jar page. Route words are reserved usernames (0016), so they never land here.

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getProfile(decodeURIComponent((await params).username));
  if (!page) return {};
  const { display_name: name, username, bio } = page.profile;
  return {
    title: t('profile.title', { name, username }),
    description: bio ?? undefined,
    alternates: { canonical: `/${username}` },
  };
}

export default async function ProfileRoute({ params }: Props) {
  const page = await getProfile(decodeURIComponent((await params).username));
  if (!page) notFound();
  const { profile } = page;
  const name = profile.display_name;

  return (
    <Page appUrl={`pickld://u/${profile.username}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar url={profile.avatar} name={name} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</h1>
          <span style={{ fontSize: 13, color: colors.muted }}>
            {t('profile.username', { username: profile.username })} ·{' '}
            {t('profile.readers', { count: profile.reader_count })} ·{' '}
            {t('profile.authors', { count: profile.author_count })}
          </span>
        </div>
      </div>
      {profile.bio ? <p style={{ margin: 0, fontSize: 14, color: colors.inkSoft }}>{profile.bio}</p> : null}
      <h2 style={{ margin: '6px 0 0', fontSize: 17, fontWeight: 700 }}>{t('profile.jars')}</h2>
      {page.jars.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: colors.muted }}>{t('profile.noJars')}</p>
      ) : (
        page.jars.map((jar) => (
          <Link
            key={jar.id}
            href={`/j/${jar.id}`}
            aria-label={t('profile.jarLink', { date: longDate(jar.local_date), count: String(jar.visible_count) })}
            style={{
              display: 'block',
              background: colors.surface,
              borderRadius: radius.tile,
              padding: 10,
              boxShadow: cardShadow,
              color: colors.ink,
              textDecoration: 'none',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 5 }}>
              {bySlot(jar.moments).map((m) => (
                <MomentPhoto key={m.id} moment={m} authorName={name} assetBase={page.assetBase} />
              ))}
            </div>
            <p style={{ margin: '10px 4px 2px', fontSize: 13, color: colors.muted }}>
              {t('profile.jarLink', { date: longDate(jar.local_date), count: String(jar.visible_count) })}
            </p>
          </Link>
        ))
      )}
    </Page>
  );
}
