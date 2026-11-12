import { colors, radius } from '@/theme/tokens';

import { t } from '~/i18n/t';

import { JarGraphic } from './JarGraphic';

const storeButton = {
  height: 44,
  padding: '0 16px',
  borderRadius: 12,
  background: colors.surface,
  color: colors.ink,
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
} as const;

/**
 * The dark Get the app card and the Open in the app line (FR-WEB-03; design: WebShare). With the app
 * installed, universal links open pickld.me URLs in the app directly (M4-15); this line is the fallback
 * and uses the app's own scheme.
 */
export function GetAppCard({
  stores,
  appUrl,
}: {
  stores: { appStore: string | null; googlePlay: string };
  appUrl: string;
}) {
  return (
    <>
      <section
        style={{
          background: colors.ink,
          color: colors.surface,
          borderRadius: radius.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <JarGraphic />
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {t('cta.title1')}
          <br />
          {t('cta.title2')}
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: colors.onDarkMuted }}>{t('cta.body')}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {stores.appStore ? (
            <a href={stores.appStore} style={storeButton}>
              {t('cta.appStore')}
            </a>
          ) : null}
          <a href={stores.googlePlay} style={storeButton}>
            {t('cta.googlePlay')}
          </a>
        </div>
      </section>
      <p style={{ margin: 0, textAlign: 'center', fontSize: 12, color: colors.muted }}>
        {t('cta.already')} <a href={appUrl}>{t('cta.openApp')}</a>
      </p>
    </>
  );
}
