// Edit profile (M3-15; FR-SOC-11, FR-ACC-03, FR-ONB-04; design: EditProfile). The database is the referee:
// profiles checks the username format and length limits (0001), refuses reserved names (0016), keeps
// usernames unique (citext) and checks avatar and cover keys. The form checks the same rules first so the
// person sees why Save is off before a round trip.
import { lidColors } from '@/theme/tokens';

import type { ProfileRow } from './profileModel';

export const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,20}$/;
export const NAME_MAX = 40;
export const BIO_MAX = 120;

/** What username_available (0017) says, plus the states the form adds around it. */
export type UsernameStatus = 'unchanged' | 'checking' | 'available' | 'taken' | 'reserved' | 'invalid';

export type EditForm = {
  displayName: string;
  username: string;
  bio: string;
  lidColor: string;
  /** Object keys of a newly uploaded avatar or cover; undefined keeps the current one. */
  avatarPath?: string;
  coverPath?: string;
};

export function formFrom(profile: Pick<ProfileRow, 'display_name' | 'username' | 'bio' | 'lid_color'>): EditForm {
  return {
    displayName: profile.display_name,
    username: profile.username,
    bio: profile.bio ?? '',
    lidColor: profile.lid_color,
  };
}

/** Usernames are case-insensitive (citext), so a change of case alone is still the same name. */
export function sameUsername(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The status before asking the server: format errors and the person's own name need no request. */
export function localUsernameStatus(candidate: string, current: string): UsernameStatus | null {
  if (sameUsername(candidate, current)) return 'unchanged';
  if (!USERNAME_PATTERN.test(candidate.trim())) return 'invalid';
  return null;
}

export type FormProblem = 'nameEmpty' | 'nameTooLong' | 'bioTooLong' | 'username' | 'lid';

export function formProblems(form: EditForm, username: UsernameStatus): FormProblem[] {
  const problems: FormProblem[] = [];
  const name = form.displayName.trim();
  if (name.length === 0) problems.push('nameEmpty');
  if (Array.from(name).length > NAME_MAX) problems.push('nameTooLong');
  if (Array.from(form.bio.trim()).length > BIO_MAX) problems.push('bioTooLong');
  if (username !== 'unchanged' && username !== 'available') problems.push('username');
  if (!(Object.values(lidColors) as string[]).includes(form.lidColor)) problems.push('lid');
  return problems;
}

export type ProfileUpdate = Partial<{
  display_name: string;
  username: string;
  bio: string | null;
  lid_color: string;
  avatar_path: string;
  cover_path: string;
}>;

/** Only the columns that changed, trimmed; an empty bio is stored as null. */
export function profileUpdate(
  original: Pick<ProfileRow, 'display_name' | 'username' | 'bio' | 'lid_color'>,
  form: EditForm,
): ProfileUpdate {
  const update: ProfileUpdate = {};
  const name = form.displayName.trim();
  const username = form.username.trim();
  const bio = form.bio.trim() === '' ? null : form.bio.trim();
  if (name !== original.display_name) update.display_name = name;
  if (username !== original.username) update.username = username;
  if (bio !== (original.bio ?? null)) update.bio = bio;
  if (form.lidColor !== original.lid_color) update.lid_color = form.lidColor;
  if (form.avatarPath !== undefined) update.avatar_path = form.avatarPath;
  if (form.coverPath !== undefined) update.cover_path = form.coverPath;
  return update;
}

export type SaveError = 'taken' | 'reserved' | 'failed';

/** A refused save in words the form can show: someone took the name meanwhile, or it is reserved (0016). */
export function saveErrorOf(error: { code?: string; message?: string }): SaveError {
  if (error.code === '23505') return 'taken';
  if (error.code === '23514' && (error.message ?? '').includes('username_reserved')) return 'reserved';
  return 'failed';
}
