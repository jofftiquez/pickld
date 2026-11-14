import type { CSSProperties, ReactNode } from 'react';

import { storeLinks } from '~/lib/env';

import { Footer } from './Footer';
import { GetAppCard } from './GetAppCard';
import { Header } from './Header';

/** The phone-width column the shared-link and legal pages sit in; the marketing pages use the full width. */
export const column: CSSProperties = {
  maxWidth: 480,
  margin: '0 auto',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
};

/** Header, content, the Get the app card and the legal footer, shared by every shared-link page. */
export function Page({ appUrl, children }: { appUrl: string; children: ReactNode }) {
  const stores = storeLinks();
  return (
    <div style={column}>
      <Header getAppUrl={stores.appStore ?? stores.googlePlay} />
      <main style={{ padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {children}
        <GetAppCard stores={stores} appUrl={appUrl} />
      </main>
      <Footer />
    </div>
  );
}
