import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { z } from 'zod';

const Extra = z.object({ releaseTag: z.string().optional(), devBuild: z.string().optional() });

/** The version shown in Settings and support emails: `4.0.0-dev.N` while app.config.ts has a release tag,
 * plain `4.0.0` once it's cleared. N is the git commit count on local builds, else the store build number. */
export function appVersion(): string {
  const version = Constants.expoConfig?.version ?? '';
  const extra = Extra.safeParse(Constants.expoConfig?.extra ?? {});
  const tag = extra.success ? extra.data.releaseTag : undefined;
  if (!tag) return version;
  const build = (extra.success ? extra.data.devBuild : undefined) ?? Application.nativeBuildVersion;
  return build ? `${version}-${tag}.${build}` : `${version}-${tag}`;
}
