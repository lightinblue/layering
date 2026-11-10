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
    eyebrow: '어떻게?',
    title: '에빙하우스의 망각곡선,\n주기를 따라 철저히 복습해요',
    body: '이론에 맞춰 들여다보면 절대 잊지 않을 수 있어요.\n그래서 우리는 이 주기를 사용해 여섯 레이어를 만듭니다.',
    accent: INTERVAL_LABEL,
  },
  {
    eyebrow: '이렇게 써요',
    title: '간편하게 기록하고\n오래오래 기억해요',
    body: '공부한 날을 남기면 복습 일정이 자동으로 생깁니다. 홈에서 오늘 복습을 체크하고, 놓친 날은 캘린더에서 확인하세요.\n그럼 기록을 시작해볼까요?',
  },
] as const;
