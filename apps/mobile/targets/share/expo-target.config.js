// Photos share extension (FR-CAP-02): "Share → Pickld" on a photo hands it to the app's /shared-photo screen,
// where the user picks the slot. Bundle id <app>.share; the App Group is the app's (app.config.ts).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'share',
  name: 'PickldShare',
  displayName: config.name,
  bundleIdentifier: '.share',
  deploymentTarget: '16.4',
  frameworks: ['UniformTypeIdentifiers', 'ImageIO'],
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
