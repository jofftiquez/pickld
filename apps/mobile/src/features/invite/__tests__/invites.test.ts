import { bySet, displayUrl, inviteState, inviteUrl, leftToGive, type InviteCode, type Invites } from '../invites';

const code = (c: string, setNo: number, slot: InviteCode['slot'], used = false): InviteCode => ({
  code: c,
  setNo,
  slot,
  used,
  invitee: used ? { joinedAt: '2026-11-12T03:00:00Z', profile: null } : null,
});

describe('invites', () => {
  it('a paused (frozen) account stays paused even after its first live moment', () => {
    expect(inviteState({ unlocked: true, frozen: true })).toBe('paused');
    expect(inviteState({ unlocked: false, frozen: true })).toBe('paused');
    expect(inviteState({ unlocked: false, frozen: false })).toBe('locked');
    expect(inviteState({ unlocked: true, frozen: false })).toBe('open');
  });

  it('groups codes by set in set order, each set in moment order', () => {
    const sets = bySet([
      code('E2', 2, 'evening'),
      code('W1', 1, 'whereami'),
      code('M2', 2, 'morning'),
      code('S1', 1, 'selfie'),
      code('A1', 1, 'afternoon'),
    ]);
    expect(sets.map((s) => [s.setNo, s.codes.map((c) => c.code)])).toEqual([
      [1, ['W1', 'S1', 'A1']],
      [2, ['M2', 'E2']],
    ]);
  });

  it('counts codes left only while invites are open', () => {
    const codes = [code('A', 1, 'whereami'), code('B', 1, 'ootd', true), code('C', 2, 'selfie')];
    const open: Invites = { state: 'open', link: null, codes };
    expect(leftToGive(open)).toBe(2);
    expect(leftToGive({ ...open, state: 'paused' })).toBeUndefined();
    expect(leftToGive({ ...open, state: 'locked' })).toBeUndefined();
    expect(leftToGive(undefined)).toBeUndefined();
  });

  it('builds the pickld.me/i/ link for a code or link id', () => {
    expect(inviteUrl('K7M2QX')).toBe('https://pickld.me/i/K7M2QX');
    expect(inviteUrl('a b/c')).toBe('https://pickld.me/i/a%20b%2Fc');
    expect(displayUrl(inviteUrl('K7M2QX'))).toBe('pickld.me/i/K7M2QX');
  });
});
