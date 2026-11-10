// Fails if a Supabase service key (or a public env var meant to hold one) appears in the app source or
// an exported bundle (AGENTS rule 2, NFR-SEC-02). The anon/publishable key is allowed.
// Usage: node scripts/scan-secrets.mjs <dir-or-file> [...]
import { Buffer } from 'node:buffer';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const JWT = /eyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
const RULES = [
  { name: 'Supabase secret key', pattern: /(?<![A-Za-z0-9_])sb_secret_[A-Za-z0-9][A-Za-z0-9_-]{15,}/g },
  { name: 'public env var named like a secret', pattern: /EXPO_PUBLIC_[A-Z0-9_]*(?:SERVICE|SECRET)[A-Z0-9_]*/g },
  { name: 'service role env var', pattern: /SUPABASE_SERVICE_ROLE(?:_KEY)?/g },
];
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|json|hbc|map|html|txt|env.*)$|^\.env/;

function jwtRole(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role;
  } catch {
    return undefined;
  }
}

/** Returns a list of `{ rule, match }` findings for one text. */
export function findSecrets(text) {
  const findings = [];
  for (const m of text.matchAll(JWT)) {
    if (jwtRole(m[1]) === 'service_role') findings.push({ rule: 'service_role JWT', match: m[0] });
  }
  for (const { name, pattern } of RULES) {
    for (const m of text.matchAll(pattern)) findings.push({ rule: name, match: m[0] });
  }
  return findings;
}

function* files(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    yield* files(join(path, entry));
  }
}

export function scanPaths(paths) {
  const findings = [];
  for (const root of paths) {
    for (const file of files(root)) {
      const name = file.split('/').pop() ?? '';
      if (!TEXT_FILE.test(name)) continue;
      for (const f of findSecrets(readFileSync(file, 'latin1'))) findings.push({ file, ...f });
    }
  }
  return findings;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error('usage: scan-secrets.mjs <dir-or-file> [...]');
    process.exit(2);
  }
  const findings = scanPaths(paths);
  for (const f of findings) {
    // Never print the key itself.
    console.error(`${relative(process.cwd(), f.file)}: ${f.rule} (${f.match.slice(0, 12)}…)`);
  }
  if (findings.length > 0) {
    console.error(`scan-secrets: ${findings.length} finding(s); service keys must never ship in the app.`);
    process.exit(1);
  }
  console.log(`scan-secrets: no service keys in ${paths.join(', ')}`);
}
