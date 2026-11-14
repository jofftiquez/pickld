// Writes Expo Router's typed-route declarations (.expo/types/router.d.ts) without
// starting Metro, so `tsc` checks every href against the real routes in CI too.
// Metro writes the same file during development; it is git-ignored.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Set before loading the generator: it reads the app root when it loads.
process.env.EXPO_ROUTER_APP_ROOT = join(root, 'app');
const require = createRequire(join(root, 'package.json'));
const cli = require.resolve('@expo/cli/package.json', { paths: [require.resolve('expo/package.json')] });
const typedRoutes = require(require.resolve('@expo/router-server/build/typed-routes', { paths: [cli] }));

const out = join(root, '.expo', 'types');
mkdirSync(out, { recursive: true });
await typedRoutes.regenerateDeclarations(out, undefined);
