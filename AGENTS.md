# 레이어링 (layering)

Expo / React Native iOS 앱. MVP: 오늘 · 기록 추가 · 캘린더. 기기 AsyncStorage + (iOS) login-less iCloud KVS sync for studies/subjects/checks.

## Expo has changed — do not trust your training data

1. Read the major version of `expo` in `package.json`.
2. Fetch matching docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. Index: https://docs.expo.dev/llms.txt

## Commands

```bash
npx expo install <package>
npx expo start
npx expo lint
npx tsc --noEmit
```

## Scope

- Follow product docs for MVP only (FR-A/B/C). No progress rates, reschedule, notifications, Android/web deploy. iCloud KVS sync is in-tree (`modules/icloud-kvs`); needs a native rebuild.
- Review intervals: +1, 3, 7, 15, 30, 60 days from study date.
- Missed reviews stay on their original due date.
