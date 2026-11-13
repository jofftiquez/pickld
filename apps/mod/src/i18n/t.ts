import en from './en.json';

// Copy lives in en.json (AGENTS rule 13). Keys are dotted paths; {{name}} placeholders are filled from
// vars; a numeric `count` picks a `_one` / `_other` variant when the key has them.
type Vars = Record<string, string | number>;

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
}

export function t(key: string, vars: Vars = {}): string {
  let value = lookup(key);
  if (typeof vars.count === 'number' && value === undefined) {
    value = lookup(`${key}_${vars.count === 1 ? 'one' : 'other'}`);
  }
  if (typeof value !== 'string') throw new Error(`missing copy: ${key}`);
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
}
