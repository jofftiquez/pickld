// Accessibility audit (M5-01; NFR-A11Y-01..03, AGENTS rule 11), run by scripts/a11y-audit.test.mjs and
// on its own with `node scripts/a11y-audit.mjs`. Reads every .tsx under app/ and src/ (tests and dev
// screens excluded) with the TypeScript parser and reports:
// - a pressable (Pressable, Touchable*, or a component whose props spread into one) without an
//   accessibilityLabel, unless it's hidden from screen readers (accessible={false} / importantForAccessibility="no");
// - text that refuses system text size (allowFontScaling={false}, or maxFontSizeMultiplier below 2) without
//   an `a11y-fixed-size:` comment saying why (text drawn into a photo or a fixed shape).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRESSABLES = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback']);

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'dev' ? [] : files(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

function attrs(el) {
  const out = new Map();
  let spread = false;
  for (const a of el.attributes.properties) {
    if (ts.isJsxSpreadAttribute(a)) spread = true;
    else out.set(a.name.getText(), a.initializer);
  }
  return { out, spread };
}

function literal(init) {
  if (!init) return true; // bare attribute = true
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (ts.isNumericLiteral(e)) return Number(e.text);
    if (ts.isStringLiteral(e)) return e.text;
  }
  return undefined;
}

export function audit(paths = [...files(join(root, 'app')), ...files(join(root, 'src'))]) {
  const problems = [];
  for (const file of paths) {
    const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const lines = src.text.split('\n');
    // A fixed-size text needs a reason: an `a11y-fixed-size:` comment in its opening tag or the 3 lines above.
    const fixedSize = (node) => {
      const first = src.getLineAndCharacterOfPosition(node.getStart()).line;
      const last = src.getLineAndCharacterOfPosition(node.getEnd()).line;
      return lines.slice(Math.max(0, first - 3), last + 1).some((l) => l.includes('a11y-fixed-size:'));
    };
    const where = (node) => `${relative(root, file)}:${src.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const visit = (node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const name = node.tagName.getText();
        const { out, spread } = attrs(node);
        if (PRESSABLES.has(name) || PRESSABLES.has(name.split('.').at(-1))) {
          const hidden =
            literal(out.get('accessible')) === false ||
            literal(out.get('importantForAccessibility')) === 'no-hide-descendants' ||
            literal(out.get('importantForAccessibility')) === 'no';
          // A spread can carry the label from the caller (kit components pass their props through).
          if (!hidden && !out.has('accessibilityLabel') && !out.has('aria-label') && !spread) {
            problems.push({ kind: 'label', at: where(node), name });
          }
        }
        if (literal(out.get('allowFontScaling')) === false && !fixedSize(node))
          problems.push({ kind: 'font-scaling', at: where(node), name });
        const max = literal(out.get('maxFontSizeMultiplier'));
        if (typeof max === 'number' && max < 2 && !fixedSize(node))
          problems.push({ kind: 'font-scaling', at: where(node), name });
      }
      ts.forEachChild(node, visit);
    };
    visit(src);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = audit();
  for (const p of problems) console.log(`${p.kind}\t${p.at}\t<${p.name}>`);
  console.log(`${problems.length} problem(s)`);
  process.exitCode = problems.length ? 1 : 0;
}
