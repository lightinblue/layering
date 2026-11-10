# 레이어링 (layering)

에빙하우스 망각곡선 기반 복습 주기를 자동 적용하는 수험생용 복습 일정 관리 앱 (Expo / iOS). App Store 표시명: **레이어링 - 규칙적인 복습 스케줄러**. GitHub 저장소는 당분간 `bokbok`을 유지합니다.

학습일을 기록하면 **+1 · 3 · 7 · 15 · 30 · 60일** 복습 일정이 생기고, 홈(오늘) · FAB 월 캘린더 · 기록 추가로 확인합니다. 데이터는 기기 로컬(AsyncStorage)만 사용합니다. 출시 빌드는 **실데이터만** 사용합니다 (실제/더미 토글 없음).

## 요구 사항

- Node.js 22+
- [Expo Go](https://expo.dev/go) (실기기 iOS 테스트)

## Expo Go로 폰에서 보기 (最短)

```bash
git clone -b cursor/home-screen-figma-affa https://github.com/lightinblue/layering.git
cd layering   # 로컬 폴더명이 bokbok이어도 동일
npm install
npx expo start -c --go
```

**반드시 `--go`**: 이 프로젝트에 `expo-dev-client`가 있어 기본 시작은 `exp+layering://`(개발 빌드용)로 뜹니다. Expo Go는 그걸 열지 못하고 「사용 가능한 데이터가 없습니다」처럼 빈 화면/빈 목록이 납니다.

터미널 QR은 **Expo Go 앱 안 스캐너**로 찍으세요 (카메라 앱 X). Expo Go는 App Store에서 **SDK 58** 지원 버전으로 업데이트하세요.

같은 Wi‑Fi/핫스팟이 아니면 터널:

```bash
npx expo start -c --go --tunnel
```

포트 충돌: 다른 Expo(예: 단색/`lucia-a`)가 `:8081`을 쓰면 Metro는 `:8082`로 뜹니다. QR만 맞으면 괜찮아요.

### App Store 스크린샷용 데모 데이터 (`__DEV__` 전용)

프로덕션에는 노출되지 않습니다. Expo Go / 개발 빌드에서만 설정 시트에 버튼이 보여요.

1. 튜토리얼을 건너뛰거나 끝낸 뒤 홈으로 들어가요.
2. 홈 좌상단 **설정** → **스크린샷 데이터 넣기** 를 눌러요.  
   (`@bokbok/app-data/v1`에 임용/수험 톤의 풍부한 기록이 바로 써지고 홈이 갱신돼요. Metro 리로드는 필요 없어요.)
3. 캡처할 화면
   - **홈(오늘)** — 오늘 한 공부 2건 + 오늘 할 복습(여러 레이어, 일부 체크됨)
   - **복습 시트** — 복습 카드의 **자세히**
   - **추가 시트** — FAB `+` (과목 칩 색: 교육학·전공·교직·기출)
   - **월 캘린더** — FAB 캘린더 아이콘 (완료율 점·활동 있는 날)
   - 주간 스트립에서 어제·그제 등 다른 날을 탭해 채워진 날도 찍을 수 있어요.
4. 끝나면 설정 → **기본으로 되돌리기** → `전공`만 있는 빈 시드로 돌아가요.

코드 진입점: `storage/screenshot-seed.ts` (`buildScreenshotAppData` / `buildDefaultAppData`).

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
| `@bokbok/theme-primary/v1` | 액센트 색 |
| `@bokbok/tutorial-seen/v1` | 첫 튜토리얼 완료 |

## 현재 상태

- 홈 UI: Figma 기반 (하단 탭 없음). 실데이터만
- 기록 추가 → 복습 +1/3/7/15/30/60 자동 생성 · 완료 체크 저장
- 폰트: Gotham XNarrow + NEXON Lv2 Gothic (`assets/fonts/`, expo-font)
- 캘린더: FAB → 월 그리드. 복습 완료율 점(0%·무일정은 숨김, primary 틴트). 다른 날 선택 시 FAB는 오늘로 이동. 날짜 탭 → 홈에서 해당일 표시

## 라이선스

Private — `lightinblue/layering`
