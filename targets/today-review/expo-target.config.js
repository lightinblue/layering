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
  // Match `constants/tokens.ts` (home chrome / review cards / signature blue).
  colors: {
    $accent: '#1991ff',
    $widgetBackground: '#ffffff',
    canvas: '#ffffff',
    primary: '#1991ff',
    primarySoft: '#dff0ff',
    surface: '#f2f6fa',
    muted: '#9fb1c1',
    mutedLight: '#ced7e0',
    body: '#526477',
    accentText: '#708aa2',
  },
});
