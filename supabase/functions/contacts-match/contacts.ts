// Contact normalization and hashing for fn:contacts-match (D-4, D-28). Everything here runs in memory;
// nothing in this file stores or logs a contact.
//
// D-28: the address book never leaves the phone. The app normalizes each contact exactly like
// normalizeEmail / normalizePhone below and sends only its device hash, sha256Hex("email:<normalized>")
// or sha256Hex("phone:<normalized>"). The function then keys that with CONTACT_HASH_SECRET (keyedHash),
// so the database never holds a plain, guessable SHA-256. The caller's own sign-up email is hashed the
// same two steps here (deviceHash, then keyedHash), so a contact's device hash keys to the stored value.

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
const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of the UTF-8 bytes of `message`, as lowercase hex. */
export async function sha256Hex(message: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(message)));
}

/** HMAC-SHA256 of `message` with `key`, as lowercase hex. */
export async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return hex(await crypto.subtle.sign('HMAC', k, encoder.encode(message)));
}

/**
 * The hash the phone makes and sends (D-28). The kind prefix keeps an email and a phone number with the
 * same text from hashing alike. Input must already be normalized.
 */
export function deviceHash(kind: 'email' | 'phone', normalized: string): Promise<string> {
  return sha256Hex(`${kind}:${normalized}`);
}

/** The keyed hash stored in contact_hashes.email_hash and looked up there: HMAC(secret, device hash). */
export function keyedHash(secret: string, deviceHashHex: string): Promise<string> {
  return hmacHex(secret, deviceHashHex);
}
