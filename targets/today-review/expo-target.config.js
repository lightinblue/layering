/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  // Must match EAS appExtensions.targetName / PRODUCT_NAME (hyphens stripped).
  // @bacons/apple-targets sanitizes for EAS as "todayreview" but uses `name`
  // as the PBXNativeTarget name — a mismatch fails Configure Xcode project.
  name: 'todayreview',
  displayName: '오늘 할 복습',
  deploymentTarget: '17.0',
  bundleIdentifier: '.today-review',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.lightinblue.layering.poogae',
      ],
  },
  // Mirrors `constants/palette.ts` — widget follows system luminosity (not in-app force).
  colors: {
    $accent: { color: '#1991ff', dark: '#1991ff' },
    $widgetBackground: { color: '#ffffff', dark: '#0B0F14' },
    canvas: { color: '#ffffff', dark: '#0B0F14' },
    primary: { color: '#1991ff', dark: '#1991ff' },
    primarySoft: { color: '#dff0ff', dark: '#16324A' },
    surface: { color: '#f2f6fa', dark: '#1A222C' },
    muted: { color: '#9fb1c1', dark: '#8B9AAB' },
    mutedLight: { color: '#ced7e0', dark: '#3A4554' },
    body: { color: '#526477', dark: '#C5CED8' },
    accentText: { color: '#708aa2', dark: '#9AABBC' },
  },
});
