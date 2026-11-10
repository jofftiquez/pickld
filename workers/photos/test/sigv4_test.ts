import { assertEquals } from 'jsr:@std/assert@1';
import { presignUrl } from '../../../supabase/functions/_shared/sigv4.ts';

// AWS's documented presigned GET example (sigv4-query-string-auth.html, "Example").
Deno.test('presignUrl matches the AWS documented example', async () => {
  const url = await presignUrl('https://examplebucket.s3.amazonaws.com/test.txt', {
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  }, { method: 'GET', expiresIn: 86400, now: new Date('2013-05-24T00:00:00Z') });
  assertEquals(
    new URL(url).searchParams.get('X-Amz-Signature'),
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  );
});
