// The phone's key-value store, kept across a simulated relaunch (fresh module instance).
const mockDisk = new Map<string, string>();
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => mockDisk.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockDisk.set(k, v),
    removeItem: async (k: string) => void mockDisk.delete(k),
  },
}));

const load = () => {
  let mod: typeof import('../setupFlow') | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual('../setupFlow');
  });
  return mod!;
};

describe('setup resume (FR-ONB-09)', () => {
  beforeEach(() => mockDisk.clear());

  it('a step saved before quitting is where the next launch resumes, per person', async () => {
    await load().saveSetupStep('u-1', '/setup/day');
    const relaunched = load();
    expect(await relaunched.readSetupStep('u-1')).toBe('/setup/day');
    expect(await relaunched.readSetupStep('u-2')).toBeNull();
  });

  it('finishing setup clears it; an unknown stored value is ignored', async () => {
    const flow = load();
    await flow.saveSetupStep('u-1', '/setup/day');
    await flow.saveSetupStep('u-1', null);
    expect(await flow.readSetupStep('u-1')).toBeNull();
    mockDisk.set('setupStep:u-1', '/settings');
    expect(await flow.readSetupStep('u-1')).toBeNull();
  });

  it('About you leads to Your day', () => {
    expect(load().nextSetupRoute('/setup/about')).toBe('/setup/day');
  });
});
