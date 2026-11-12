import {
  formFrom,
  formProblems,
  localUsernameStatus,
  profileUpdate,
  saveErrorOf,
  type EditForm,
} from '../editProfileModel';

const dale = { display_name: 'Dale Santos', username: 'dale', bio: 'coffee', lid_color: '#7fad33' };

describe('localUsernameStatus', () => {
  it('treats a change of case as the same name (citext)', () => {
    expect(localUsernameStatus('Dale', 'dale')).toBe('unchanged');
    expect(localUsernameStatus(' dale ', 'dale')).toBe('unchanged');
  });

  it.each(['da', 'a'.repeat(21), 'dale!', 'da le', ''])('refuses "%s" without asking the server', (name) => {
    expect(localUsernameStatus(name, 'dale')).toBe('invalid');
  });

  it('leaves a well-formed new name to the server', () => {
    expect(localUsernameStatus('dale.s_2', 'dale')).toBeNull();
  });
});

describe('formProblems', () => {
  const ok: EditForm = formFrom(dale);

  it('accepts an unchanged form', () => {
    expect(formProblems(ok, 'unchanged')).toEqual([]);
  });

  it('flags a blank name, an over-long bio, a username that is not available and an unknown lid', () => {
    expect(formProblems({ ...ok, displayName: '   ' }, 'unchanged')).toEqual(['nameEmpty']);
    expect(formProblems({ ...ok, bio: 'x'.repeat(121) }, 'unchanged')).toEqual(['bioTooLong']);
    expect(formProblems({ ...ok, bio: 'x'.repeat(120) }, 'unchanged')).toEqual([]);
    for (const status of ['checking', 'taken', 'reserved', 'invalid'] as const) {
      expect(formProblems(ok, status)).toEqual(['username']);
    }
    expect(formProblems(ok, 'available')).toEqual([]);
    expect(formProblems({ ...ok, lidColor: '#ff0000' }, 'unchanged')).toEqual(['lid']);
  });

  it('counts characters, not UTF-16 units, against the name limit', () => {
    expect(formProblems({ ...ok, displayName: '🥒'.repeat(40) }, 'unchanged')).toEqual([]);
  });
});

describe('profileUpdate', () => {
  it('sends nothing when nothing changed', () => {
    expect(profileUpdate(dale, { ...formFrom(dale), displayName: ' Dale Santos ' })).toEqual({});
  });

  it('sends only the changed columns, trimmed, and an emptied bio as null', () => {
    expect(
      profileUpdate(dale, {
        displayName: 'Dale',
        username: 'dale.s ',
        bio: '  ',
        lidColor: '#4a9ad4',
        avatarPath: 'avatars/u/a.jpg',
      }),
    ).toEqual({
      display_name: 'Dale',
      username: 'dale.s',
      bio: null,
      lid_color: '#4a9ad4',
      avatar_path: 'avatars/u/a.jpg',
    });
  });

  it('does not send a null bio when there was none', () => {
    expect(profileUpdate({ ...dale, bio: null }, { ...formFrom({ ...dale, bio: null }) })).toEqual({});
  });
});

describe('saveErrorOf', () => {
  it('maps the database refusals to what the form says', () => {
    expect(saveErrorOf({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe('taken');
    expect(saveErrorOf({ code: '23514', message: 'username_reserved' })).toBe('reserved');
    expect(saveErrorOf({ code: '23514', message: 'profiles_avatar_path_format' })).toBe('failed');
    expect(saveErrorOf({ message: 'Network request failed' })).toBe('failed');
  });
});
