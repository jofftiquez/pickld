import { defineConfig } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Same two rules as apps/mobile: colors come from the shared tokens, copy from src/i18n/en.json.
const colorLiteral = {
  selector: 'Literal[value=/^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()/]',
  message: 'Use a color from apps/mobile/src/theme/tokens.ts instead of a color literal.',
};
const jsxCopy = [
  { selector: 'JSXText[value=/\\p{L}/u]', message: 'Put copy in src/i18n/en.json and render it with t().' },
  {
    selector: 'JSXExpressionContainer > Literal[value=/\\p{L}/u]',
    message: 'Put copy in src/i18n/en.json and render it with t().',
  },
];

export default defineConfig([
  ...next,
  ...nextTs,
  { ignores: ['.next/*', 'next-env.d.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Photo URLs are short-lived signed URLs from fn:public-page; next/image would cache them past expiry.
      '@next/next/no-img-element': 'off',
      'no-restricted-syntax': ['error', colorLiteral, ...jsxCopy],
    },
  },
]);
