import { appVersion } from '../appVersion';

const config: { version: string; extra?: Record<string, unknown> } = { version: '4.0.0' };
const application = { nativeBuildVersion: '37' as string | null };
jest.mock('expo-constants', () => ({
  get expoConfig() {
    return config;
  },
}));
jest.mock('expo-application', () => ({
  get nativeBuildVersion() {
    return application.nativeBuildVersion;
  },
}));

describe('appVersion', () => {
  it('tags a local build with its commit count, not the native build number', () => {
    config.extra = { releaseTag: 'dev', devBuild: '1423' };
    expect(appVersion()).toBe('4.0.0-dev.1423');
  });

  it('tags an EAS build with its store build number', () => {
    config.extra = { releaseTag: 'dev' };
    expect(appVersion()).toBe('4.0.0-dev.37');
  });

  it('shows the plain version once the release tag is cleared', () => {
    config.extra = { releaseTag: '', devBuild: '1423' };
    expect(appVersion()).toBe('4.0.0');
  });
});
