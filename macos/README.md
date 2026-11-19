# 포개 macOS

First milestone: **SwiftUI** menu-bar + main-window shell with landscape home, calendar depth stub, and iCloud KVS **read** path shared with iOS.

## Why SwiftUI (not Expo macOS)

| Need | SwiftUI Mac | Expo / RN macOS |
|------|-------------|-----------------|
| Menu bar popover + window | First-class (`MenuBarExtra`) | Awkward / limited |
| Mac App Store | Native entitlements + notarization path | Extra native shell |
| Same iCloud KVS as iOS | Direct `NSUbiquitousKeyValueStore` + same ubiquity id | Needs custom native module wiring |
| Landscape Mac UI + motion | SwiftUI animations | Possible, but menu bar still weak |

iOS Expo app stays as-is (`com.lightinblue.layering` unchanged). Mac uses **`com.lightinblue.layering.mac`** and the **same** KVS container `$(TeamIdentifierPrefix)com.lightinblue.layering`.

## Open / build

Requires **Xcode** (full app, not CLT-only):

```bash
open macos/PoogaeMac.xcodeproj
# or
xcodebuild -project macos/PoogaeMac.xcodeproj -scheme PoogaeMac -configuration Debug build
```

**Signing (first run on a new Mac):** Xcode has no Apple ID until you add one — that is why Issue navigator shows “No Accounts” / missing Mac App Development profiles. App Sandbox + iCloud KVS entitlements **cannot** use “Sign to Run Locally”; a development certificate is required.

1. **Xcode → Settings… → Accounts → + → Apple ID** → sign in with the Apple ID that owns team `R39JVZ3ZNL` (same as iOS).
2. Select target **PoogaeMac** → **Signing & Capabilities** → check **Automatically manage signing** → **Team** = `R39JVZ3ZNL` (not empty).
3. Press **Run** (My Mac). Xcode will create the Mac development cert/profile if needed.

A free **Personal Team** can also clear the two signing errors for My Mac-only debug, but its Team ID ≠ `R39JVZ3ZNL`, so iCloud KVS will **not** share data with the iOS app. Prefer the paid team above for real sync testing.

## Milestone 1 contents

- Menu bar extra → today-review checklist popover + “창 열기”
- Main window (≈980×640): today **공부 기록** + **복습 카드** (horizontal)
- Calendar as NavigationStack destination (not always on home)
- Theme tokens (#1991ff) + light motion
- KVS read: `subjects` + `rec/YYYY-MM` → merge helpers → home lists (write/push later)

## Layout

```
macos/
  README.md
  PoogaeMac.xcodeproj/
  PoogaeMac/
    PoogaeMacApp.swift
    App/ Home/ Calendar/ Theme/ Sync/
    Resources/ (Assets, entitlements, Info.plist)
```
