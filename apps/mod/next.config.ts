import path from 'node:path';

import type { NextConfig } from 'next';

// The console shares the design tokens with the app (apps/mobile/src, imported as @/…), so Turbopack's
// root is the repository.
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname, '../..') },
  // Sticker Studio uploads (FR-MOD-10) send PNG art through a Server Action; fn:sticker-studio allows 2 MB.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
};

export default config;
