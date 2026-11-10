const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Hex, rgb() and hsl() color literals are only allowed in src/theme/tokens.ts.
const colorLiteral = {
  selector: 'Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/]',
  message: 'Use a color from src/theme/tokens.ts instead of a color literal.',
};

// Copy lives in src/i18n/en.json (AGENTS rule 13). Any letter in JSX text, even one word, is refused;
// digits, spaces and punctuation are allowed.
const jsxCopy = [
  { selector: 'JSXText[value=/\\p{L}/u]', message: 'Put copy in src/i18n/en.json and render it with t().' },
  {
    selector: 'JSXExpressionContainer > Literal[value=/\\p{L}/u]',
    message: 'Put copy in src/i18n/en.json and render it with t().',
  },
];

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'ios/*', 'android/*'] },
  { files: ['**/*.ts', '**/*.tsx'], rules: { '@typescript-eslint/no-explicit-any': 'error' } },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/theme/tokens.ts', '**/__tests__/**', 'src/dev/**'],
    rules: { 'no-restricted-syntax': ['error', colorLiteral, ...jsxCopy] },
  },
]);
