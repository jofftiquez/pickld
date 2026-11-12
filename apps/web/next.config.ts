import path from 'node:path';

import type { NextConfig } from 'next';

// The site shares the design tokens and the edits format with the app (apps/mobile/src, imported as @/…),
// so Turbopack's root is the repository.
const config: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: path.join(__dirname, '../..') },
};

export default config;
