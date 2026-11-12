// Find friends (FR-ONB-06, D-28): the address book is read on the phone, every email and number is hashed
// here (contactHash.ts), and only the hashes go to fn:contacts-match. The raw contacts never leave the
// phone and are not kept after the hashes are made.
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { z } from 'zod';

import { contactHashes } from '@/lib/contactHash';
import { getSupabase } from '@/lib/supabase';

export type FriendMatch = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  reading: boolean;
};

/** Asks for contacts (the system prompt shows on first use) and hashes them; `denied` when refused. */
export async function hashAddressBook(): Promise<string[] | 'denied'> {
  const permission = await requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  const people = await Contact.getAllDetails([ContactField.EMAILS, ContactField.PHONES]);
  return contactHashes({
    emails: people.flatMap((p) => (p.emails ?? []).flatMap((e) => (e.address ? [e.address] : []))),
    phones: people.flatMap((p) => (p.phones ?? []).flatMap((n) => (n.number ? [n.number] : []))),
  });
}

const matchResponse = z.object({
  data: z.object({
    matches: z.array(
      z.object({
        id: z.string(),
        username: z.string(),
        displayName: z.string(),
        avatarPath: z.string().nullable(),
        following: z.boolean(),
      }),
    ),
  }),
});
const avatarResponse = z.object({
  data: z.object({ profiles: z.array(z.object({ id: z.string(), avatar: z.string().nullable() })) }),
});

/** Pickld people among the hashed contacts, with signed avatar URLs (initials when those fail). */
export async function matchContacts(hashes: string[]): Promise<FriendMatch[]> {
  if (hashes.length === 0) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke<unknown>('contacts-match', { body: { hashes } });
  if (error) throw new Error('contacts-match failed');
  const matches = matchResponse.parse(data).data.matches;
  const withAvatar = matches
    .filter((m) => m.avatarPath !== null)
    .map((m) => m.id)
    .slice(0, 100); // fn:photo-urls MAX_BATCH
  let avatars = new Map<string, string | null>();
  if (withAvatar.length > 0) {
    const urls = await supabase.functions.invoke<unknown>('photo-urls', {
      body: { momentIds: [], profileIds: withAvatar },
    });
    const parsed = avatarResponse.safeParse(urls.data);
    if (!urls.error && parsed.success) avatars = new Map(parsed.data.data.profiles.map((p) => [p.id, p.avatar]));
  }
  return matches.map((m) => ({
    id: m.id,
    username: m.username,
    displayName: m.displayName,
    avatarUrl: avatars.get(m.id) ?? null,
    reading: m.following,
  }));
}
