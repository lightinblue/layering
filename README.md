# 복복 (bokbok)

에빙하우스 망각곡선 기반 복습 주기를 자동 적용하는 수험생용 복습 일정 관리 앱 (Expo / iOS).

학습일을 기록하면 **+1 · 3 · 7 · 15 · 30 · 60일** 복습 일정이 생기고, 홈(오늘) · FAB 캘린더 스텁 · 기록 추가 스텁으로 확인합니다. 데이터는 기기 로컬(AsyncStorage)만 사용합니다.

## 요구 사항

- Node.js 22+
- [Expo Go](https://expo.dev/go) (실기기 iOS 테스트)

## Expo Go로 폰에서 보기 (最短)

```bash
git clone -b cursor/home-screen-figma-affa https://github.com/lightinblue/bokbok.git
cd bokbok
npm install
npx expo start
```

터미널에 나온 **QR을 Expo Go로 스캔**합니다.

같은 Wi‑Fi에서 연결이 안 되면 터널을 쓰세요:

```bash
npx expo start --tunnel
```

데모 상태: 홈 하단 **demo** 세그먼트(`full` / `few` / `empty`)를 탭, 또는 URL `?demo=few` / `?demo=empty` (웹).

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm start` / `npx expo start` | Expo 개발 서버 |
| `npx expo start --tunnel` | LAN 이슈 시 터널 |
| `npm run ios` | iOS 시뮬레이터 |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run typecheck` | TypeScript 검사 |

## 현재 상태

- 홈(오늘) UI: Figma full / few / empty (하단 탭 없음)
- 폰트: Gotham XNarrow + NEXON Lv2 Gothic (`assets/fonts/`, expo-font)
- 기록 추가 · 캘린더: 스택 스텁 (FAB / CTA로 진입)
- 도메인 타입·복습 주기 유틸·AsyncStorage 저장 스켈레톤

## 라이선스

Private — `lightinblue/bokbok`
