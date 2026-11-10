import { REVIEW_INTERVAL_DAYS } from '@/constants/review';

/** Short first-launch intro — two screens. */
export type TutorialPage = {
  eyebrow: string;
  title: string;
  body: string;
  /** Optional accent line under body (intervals). */
  accent?: string;
};

const INTERVAL_LABEL =
  REVIEW_INTERVAL_DAYS.map((d) => `${d}일`).join(', ') + ' 후';

export const TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    eyebrow: '망각곡선',
    title: '에빙하우스 망각곡선,\n그래서 이 주기예요',
    body: '복습하지 않으면 배운 내용은 빠르게 잊혀집니다. 그 타이밍에 맞춰 다시 꺼내 보면 기억이 오래 남아요. 그래서 학습일 기준으로 아래 주기를 씁니다.',
    accent: INTERVAL_LABEL,
  },
  {
    eyebrow: '이렇게 써요',
    title: '기록하고,\n오늘 확인하고,\n캘린더로 챙기세요',
    body: '공부한 날을 남기면 복습 일정이 자동으로 생깁니다. 홈에서 오늘 복습을 체크하고, 놓친 날은 캘린더에서 그 날짜를 열어 확인하세요.',
  },
] as const;
