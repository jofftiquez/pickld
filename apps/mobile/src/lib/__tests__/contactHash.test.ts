import { createHash } from 'node:crypto';

import { contactHashes, MAX_CONTACT_HASHES, sha256Hex } from '../contactHash';

const nodeSha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('contact hashing on the phone (FR-ONB-06, D-28)', () => {
  it('SHA-256 matches the standard vectors and Node across block boundaries and non-ASCII text', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    for (const n of [55, 56, 63, 64, 65, 119, 120, 1000]) expect(sha256Hex('x'.repeat(n))).toBe(nodeSha('x'.repeat(n)));
    expect(sha256Hex('email:niño@pickld.ph 🥒')).toBe(nodeSha('email:niño@pickld.ph 🥒'));
  });

  it('sends only hashes of normalised contacts: no raw email or number, one per contact, invalid ones dropped', () => {
    const hashes = contactHashes({
      emails: ['  Mika.Reyes@Example.com ', 'mika.reyes@example.com', 'not-an-email'],
      phones: ['+63 917 555 0101', '(0917) 555-0101', '12'],
    });
    expect(hashes).toEqual([
      nodeSha('email:mika.reyes@example.com'),
      nodeSha('phone:+639175550101'),
      nodeSha('phone:09175550101'),
    ]);
    const sent = JSON.stringify(hashes);
    expect(sent).not.toMatch(/example|mika|@|\+/i);
    expect(hashes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it('caps one request at the function limit', () => {
    const emails = Array.from({ length: MAX_CONTACT_HASHES + 5 }, (_, i) => `p${i}@pickld.test`);
    expect(contactHashes({ emails, phones: [] })).toHaveLength(MAX_CONTACT_HASHES);
  });
});
