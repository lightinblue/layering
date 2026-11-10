# 복복 (bokbok)

에빙하우스 망각곡선 기반 복습 주기를 자동 적용하는 수험생용 복습 일정 관리 앱 (Expo / iOS).

학습일을 기록하면 **+1 · 3 · 7 · 15 · 30 · 60일** 복습 일정이 생기고, 홈(오늘) · FAB 캘린더 스텁 · 기록 추가로 확인합니다. 데이터는 기기 로컬(AsyncStorage)만 사용합니다.

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

### 데이터 모드

홈 하단 **데이터** 세그먼트에서 전환합니다.

| 모드 | 설명 |
|------|------|
| **실제** (기본) | AsyncStorage에 과목·학습·복습 저장. 선택한 날짜 기준으로 「오늘 한 공부」「오늘 할 복습」표시 |
| **더미** | UI 미리보기용 고정 샘플 (라벨 `미리보기`). 저장은 세션 메모리만 |

웹: `?mode=dummy` / `?mode=real`

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm start` / `npx expo start` | Expo 개발 서버 |
| `npx expo start --tunnel` | LAN 이슈 시 터널 |
| `npm run ios` | iOS 시뮬레이터 |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run typecheck` | TypeScript 검사 |

## 저장 키

| 키 | 내용 |
|----|------|
| `@bokbok/app-data/v1` | `{ subjects, records, schedules }` |
| `@bokbok/data-mode/v1` | `'real'` \| `'dummy'` |

## 현재 상태

- 홈 UI: Figma 기반 (하단 탭 없음). 실제/더미 모드
- 기록 추가 → 복습 +1/3/7/15/30/60 자동 생성 · 완료 체크 저장
- 폰트: Gotham XNarrow + NEXON Lv2 Gothic (`assets/fonts/`, expo-font)
- 캘린더: 스택 스텁 (FAB)

## 라이선스

Private — `lightinblue/bokbok`
