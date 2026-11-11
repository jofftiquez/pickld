// Contact normalization and keyed hashing for fn:contacts-match (D-4). Everything here runs in memory;
// nothing in this file stores or logs a contact.

/** Lowercased, trimmed email; null when it doesn't look like an email. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/**
 * Digits only, with a leading + kept (best effort: address books mix national and international forms,
 * and no country is assumed). Null when fewer than 7 or more than 15 digits remain (E.164 allows 15).
 */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return (t.startsWith('+') ? '+' : '') + digits;
}

const encoder = new TextEncoder();

/** HMAC-SHA256 of `message` with `key`, as lowercase hex. */
export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The keyed hash stored in contact_hashes.email_hash and looked up there. The kind prefix keeps an email
 * and a phone number with the same text from hashing alike. Input must already be normalized.
 */
export function contactHash(secret: string, kind: 'email' | 'phone', normalized: string): Promise<string> {
  return hmacHex(secret, `${kind}:${normalized}`);
}
