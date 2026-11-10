import { REVIEW_INTERVAL_DAYS, REVIEW_INTERVAL_NOTICE } from '@/constants/review';

/** Short first-launch intro — keep to a few screens. */
export type TutorialPage = {
  eyebrow: string;
  title: string;
  body: string;
  /** Optional accent line under body (intervals, notice). */
  accent?: string;
  footnote?: string;
};

const INTERVAL_LABEL = REVIEW_INTERVAL_DAYS.map((d) => `+${d}`).join(' · ');

export const TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    eyebrow: '망각곡선',
    title: '시간은 기억을\n희미하게 만들어요',
    body: '에빙하우스 망각곡선에 따르면, 복습하지 않으면 배운 내용은 빠르게 잊혀집니다. 레이어링은 그 타이밍에 맞춰 복습일을 잡아 줍니다.',
  },
  {
    eyebrow: '여섯 레이어',
    title: '학습일만 적으면\n복습 일정이 생겨요',
    body: '공부한 날을 기록하면 기본 주기로 복습일이 자동 생성됩니다.',
    accent: INTERVAL_LABEL,
    footnote: REVIEW_INTERVAL_NOTICE,
  },
  {
    eyebrow: '이렇게 써요',
    title: '기록하고,\n오늘 확인하고,\n캘린더로 챙기세요',
    body: '공부 후 기록을 남기고, 홈에서 오늘 복습을 체크하세요. 놓친 날은 캘린더에서 그 날짜를 열어 확인하면 됩니다.',
  },
] as const;
