# 「오늘 할 복습」iOS 홈 위젯

WidgetKit extension (`targets/today-review`) reads the App Group snapshot written by the app.

| | |
|--|--|
| App Group | `group.com.lightinblue.layering.poogae` |
| UserDefaults key | `todayReviewWidget.v1` |
| Bundle id | `com.lightinblue.layering.today-review` |
| Deep link | `layering://` (today home) |
| Sizes | Small / Medium summary · Large card list (chip + `N일 전` + checkbox; no title / 자세히) |

Expo Go cannot show this widget — use a **dev client** or **TestFlight** binary.

## Build (EAS)

```bash
# Device install / local iteration
eas build --platform ios --profile development

# Internal share
eas build --platform ios --profile preview

# TestFlight / App Store
eas build --platform ios --profile production
```

Profiles: `eas.json`. First build after adding the target may ask EAS to register `….today-review` and sync App Groups — accept.

1. Install the build and open the app once (writes the snapshot + reloads timelines).
2. Home Screen → long-press → **+** → search **오늘 할 복습** → add Small / Medium / Large.

## Local Xcode

Needs full **Xcode.app** (not only Command Line Tools):

```bash
npx expo prebuild -p ios
xed ios
```

Run the app scheme on a Simulator or device, then add the widget from the gallery. Re-prebuild after changing `targets/today-review/expo-target.config.js` or app entitlements.

## Apple Developer checklist

1. App Group `group.com.lightinblue.layering.poogae`
2. Enable App Groups on `com.lightinblue.layering` and `com.lightinblue.layering.today-review`
3. Optional: `ios.appleTeamId` in `app.json`
