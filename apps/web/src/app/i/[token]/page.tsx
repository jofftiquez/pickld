import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';

import { colors, invite, join, radius } from '@/theme/tokens';

import { CopyAndOpen } from '~/components/CopyAndOpen';
import { Footer } from '~/components/Footer';
import { Header } from '~/components/Header';
import { column } from '~/components/Page';
import { t } from '~/i18n/t';
import { storeLinks } from '~/lib/env';
import { getInvite } from '~/lib/invitePage';
import { brandGlow, cardShadow } from '~/lib/styles';

// pickld.me/i/<token> (INV-05, FR-WEB-04; designs: WebInvite, WebInviteUnavailable). Opened without the app:
// who invited you (only what their public profile shows, never photos, rule 9), the code to paste at Sign
// up, and Get the app, which copies it first. With the app installed, universal links open it instead
// (`/*` in apple-app-site-association). Every reason an invite can't be used gets the same page.

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getInvite((await params).token);
  const robots = { index: false, follow: false };
  if (page.state !== 'ok') return { title: t('invite.unavailableTitle'), robots };
  const name = page.inviter?.display_name;
  const title = name ? t('invite.title', { name }) : t('invite.titleNoName');
  const description = name ? t('invite.description', { name }) : t('invite.descriptionNoName');
  return {
    title,
    description,
    robots,
    openGraph: { type: 'website', siteName: t('site.name'), title, description, url: `/i/${page.token}` },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const bigButton: CSSProperties = {
  height: 54,
  width: '100%',
  borderRadius: radius.pill,
  background: colors.brand,
  color: colors.surface,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 16,
  boxShadow: brandGlow,
};
const small: CSSProperties = { margin: 0, fontSize: 13, color: colors.muted };

export default async function InviteRoute({ params }: Props) {
  const raw = (await params).token;
  const page = await getInvite(raw);
  const stores = storeLinks();

  if (page.state !== 'ok') {
    const limited = page.state === 'limited';
    return (
      <Shell stores={stores}>
        <h1 style={{ margin: '10px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
          {t(limited ? 'invite.limitedTitle' : 'invite.unavailableTitle')}
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: colors.inkSoft }}>
          {t(limited ? 'invite.limitedBody' : 'invite.unavailableBody')}
        </p>
        <div style={{ flex: 1 }} />
        {stores.appStore ? (
          <a href={stores.appStore} style={bigButton}>
            {t('invite.getApp')}
          </a>
        ) : null}
        <p style={small}>
          {t('invite.anotherCode')} <a href="pickld://">{t('invite.openApp')}</a>
        </p>
      </Shell>
    );
  }

  const { inviter, token } = page;
  const name = inviter?.display_name;
  return (
    <Shell stores={stores}>
      {inviter ? (
        <>
          {inviter.avatar ? (
            <img
              src={inviter.avatar}
              alt={t('jar.avatar', { name: inviter.display_name })}
              style={{ ...avatarBox, objectFit: 'cover' }}
            />
          ) : (
            <span aria-hidden style={{ ...avatarBox, background: colors.brandTint }} />
          )}
          <span style={small}>{t('invite.byline', { name: inviter.display_name, username: inviter.username })}</span>
        </>
      ) : null}
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>
        {name ? t('invite.title', { name }) : t('invite.titleNoName')}
      </h1>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: colors.inkSoft }}>
        {name ? t('invite.body', { name }) : t('invite.bodyNoName')}
      </p>
      <section
        aria-label={t('invite.codeA11y', { code: token.split('').join(' ') })}
        style={{
          marginTop: 8,
          width: '100%',
          boxSizing: 'border-box',
          background: invite.slotColors.whoamiwith,
          color: colors.surface,
          borderRadius: join.cardRadius,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 0,
            top: -36,
            fontSize: 150,
            fontWeight: 800,
            lineHeight: 1,
            color: invite.watermarkOnColor,
          }}
        >
          #
        </span>
        <span aria-hidden style={{ position: 'relative', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>
          {t('invite.codeLabel')}
        </span>
        {/* A link id is 10 characters to a code's 6, so it sits smaller to fit the card. */}
        <span
          aria-hidden
          data-testid="invite-code"
          style={{
            position: 'relative',
            fontSize: token.length > 6 ? 26 : 34,
            fontWeight: 800,
            letterSpacing: token.length > 6 ? '0.1em' : '0.18em',
          }}
        >
          {token}
        </span>
      </section>
      <div style={{ flex: 1 }} />
      {stores.appStore ? (
        <>
          <CopyAndOpen code={token} href={stores.appStore} style={bigButton}>
            {t('invite.getApp')}
          </CopyAndOpen>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: colors.muted }}>{t('invite.copyHint')}</span>
        </>
      ) : null}
      <p style={{ ...small, marginTop: 4 }}>
        {t('invite.already')} <a href={`pickld://i/${token}`}>{t('invite.openApp')}</a>
      </p>
    </Shell>
  );
}

const avatarBox: CSSProperties = {
  width: 84,
  height: 84,
  borderRadius: '50%',
  flexShrink: 0,
  boxSizing: 'border-box',
  border: `4px solid ${colors.surface}`,
  boxShadow: cardShadow,
};

function Shell({ stores, children }: { stores: { appStore: string | null; googlePlay: string }; children: ReactNode }) {
  return (
    <div style={column}>
      <Header getAppUrl={stores.appStore ?? stores.googlePlay} />
      <main
        style={{
          padding: '28px 22px 24px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 12,
        }}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
