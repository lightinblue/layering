# 복복 (bokbok)

에빙하우스 망각곡선 기반 복습 주기를 자동 적용하는 수험생용 복습 일정 관리 앱 (Expo / iOS).

학습일을 기록하면 **+1 · 3 · 7 · 15 · 30 · 60일** 복습 일정이 생기고, **오늘** · **기록 추가** · **캘린더** 탭으로 확인·체크합니다. 데이터는 기기 로컬(AsyncStorage)만 사용합니다.

## 요구 사항

- Node.js 22+
- [Expo Go](https://expo.dev/go) (실기기 iOS 테스트)

## 실행

```bash
npm install
npm start
```

터미널 QR을 Expo Go로 스캔하거나:

```bash
npm run ios
```

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm start` | Expo 개발 서버 |
| `npm run ios` | iOS 시뮬레이터 / Expo Go |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run typecheck` | TypeScript 검사 |

## 현재 상태 (foundation)

- Expo Router 탭: 오늘 / 기록 추가 / 캘린더 (스텁 화면)
- 도메인 타입·복습 주기 유틸·AsyncStorage 저장 스켈레톤
- MVP 기능(칩·저장·체크·캘린더)은 이후 단계에서 구현

## 라이선스

Private — `lightinblue/bokbok`
