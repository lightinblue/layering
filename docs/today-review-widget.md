# 「오늘 할 복습」iOS 홈 위젯

WidgetKit extension (`targets/today-review`) reads the App Group snapshot written by the app.

| | |
|--|--|
| App Group | `group.com.lightinblue.layering.poogae` |
| UserDefaults key | `todayReviewWidget.v1` |
| Bundle id | `com.lightinblue.layering.today-review` |
| Xcode / EAS target name | `todayreview` (no hyphen — must match `PBXNativeTarget` + `appExtensions.targetName`) |
| Widget kind | `TodayReviewWidget` (`ExtensionStorage.reloadWidget()` + ofKind) |
| Deep link | `layering://` (today home) |
| Chrome | Signature blue theme-dot before title; tokens match home (`primary` / `primarySoft` / `surface`) |
| Sizes | Small / Medium summary · Large card list (chip + `N일 전` + checkbox; no title / 자세히) |
| Tap (v1) | Whole widget opens the app (`layering://`). Checkbox is **display-only** — no in-widget toggle. |

Expo Go cannot show this widget — use a **dev client** or **TestFlight** binary.

## Interaction (design)

**v1:** Tap anywhere → open today home. Large-row checkboxes show completed state only; they are not buttons.

**Later:** In-widget check-off needs iOS 17+ interactive widgets (`Button` + `AppIntent` / `Toggle`) writing App Group + reloading timelines. Not in v1.

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
3. `ios.appleTeamId` is set in `app.json` (`R39JVZ3ZNL`)
