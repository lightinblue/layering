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

A free **Personal Team** shows as **`Name (Personal Team)`** in the Team dropdown and uses a different Team ID — iCloud KVS will **not** share data with the iOS app. The paid Individual team appears as **`Seoyoung Yoon`** (no “Personal Team” suffix) with Team ID **`R39JVZ3ZNL`**. Prefer that for sync testing.

**KVS status** (menu bar footer): after Run, look for `KVS 동기화됨 · subjects=ok · rec keys=…`. `클라우드 대기/비어 있음` that never clears usually means Mac iCloud Apple ID ≠ phone, or phone has not pushed yet — not a wrong Team ID when Team is already `R39JVZ3ZNL`.

## Usable now (phase 2–3 slice)

- Menu bar → today-review checklist (toggle) + “창 열기”
- Main window (≈720×480, min 640×420): landscape **LEFT 공부 기록 | RIGHT 복습**
- **추가/수정** study sheet + subject add/edit/delete (chip context menu); study row click/context menu delete
- Calendar as NavigationStack depth with study dots (not always on home)
- Theme tokens (#1991ff) + settle motion; system dark
- KVS read + write (`subjects` / `rec/YYYY-MM`) with local UserDefaults mirror when iCloud is off
- No dedicated sync UI (short KVS status line in menu bar only)

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
