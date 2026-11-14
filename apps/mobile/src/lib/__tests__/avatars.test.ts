import { avatarPairs, fetchAvatarUrls } from '../avatars';

const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: mockInvoke } }) }));

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';

describe('avatarPairs', () => {
  it('lists each person with a photo once, sorted, so the same people give the same query key', () => {
    expect(
      avatarPairs([
        { id: B, path: `avatars/${B}/1.jpg` },
        { id: A, path: null },
        { id: A, path: `avatars/${A}/1.jpg` },
        { id: B, path: `avatars/${B}/1.jpg` },
        { id: 'c', path: undefined },
      ]),
    ).toEqual([`${A}:avatars/${A}/1.jpg`, `${B}:avatars/${B}/1.jpg`]);
  });

  it('gives a new key when someone uploads a new avatar (D-93)', () => {
    const before = avatarPairs([{ id: A, path: `avatars/${A}/1.jpg` }]);
    const after = avatarPairs([{ id: A, path: `avatars/${A}/2.jpg` }]);
    expect(after).not.toEqual(before);
  });
});

describe('fetchAvatarUrls', () => {
  beforeEach(() => mockInvoke.mockReset());

  it('signs profiles through fn:photo-urls in batches of 100', async () => {
    mockInvoke.mockImplementation((_name: string, { body }: { body: { profileIds: string[] } }) =>
      Promise.resolve({
        data: { data: { profiles: body.profileIds.map((id) => ({ id, avatar: `https://p/${id}` })) } },
        error: null,
      }),
    );
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const urls = await fetchAvatarUrls(ids);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenCalledWith('photo-urls', { body: { profileIds: ids.slice(0, 100) } });
    expect(urls['id-149']).toBe('https://p/id-149');
  });

  it('throws when signing fails, so nothing wrong is cached and the avatars stay on initials', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(fetchAvatarUrls([A])).rejects.toThrow('offline');
  });
});
