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
  colors: {
    $accent: '#1991FF',
    $widgetBackground: '#FFFFFF',
    primary: '#1991FF',
    surface: '#F2F6FA',
    muted: '#9FB1C1',
    mutedLight: '#CED7E0',
    body: '#526477',
    accentText: '#708AA2',
  },
});
