import { assertEquals } from 'jsr:@std/assert@1';
import { withSentry } from '../_shared/sentry.ts';

Deno.test('without SENTRY_DSN an error becomes a 500 { error } and nothing is loaded', async () => {
  Deno.env.delete('SENTRY_DSN');
  const handler = withSentry('test', () => {
    throw new Error('boom');
  });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await handler(new Request('http://fn.local/test'));
    assertEquals(res.status, 500);
    assertEquals((await res.json()).error.code, 'internal');
  } finally {
    console.error = original;
  }
});
