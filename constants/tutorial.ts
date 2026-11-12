import { REVIEW_INTERVAL_DAYS } from '@/constants/review';

/** Short first-launch intro — two screens. */
export type TutorialPage = {
  eyebrow: string;
  title: string;
  /** Main product copy under the visual. */
  body: string;
  /** Optional smaller supporting line (theory / context). */
  sub?: string;
  /** Optional accent line under body (intervals). */
  accent?: string;
};

const INTERVAL_LABEL =
  REVIEW_INTERVAL_DAYS.map((d) => `${d}일`).join(', ') + ' 후';

export const TUTORIAL_PAGES: readonly TutorialPage[] = [
  {
    eyebrow: '포개',
    title: '오늘의 공부를\n여섯 겹으로 포개요',
    // One Text block (\\n) so line spacing matches page-1 body copy.
    body: '포개는 공부한 내용이 잊히기 직전, 다시 꺼내어 기억을 한 겹씩 쌓아가는 복습 스케줄러예요.\n망각곡선에 맞춰 여섯 번의 복습을 차곡차곡 이어가 보세요.',
    accent: INTERVAL_LABEL,
  },
  {
    eyebrow: '이렇게 써요',
    title: '간편하게 기록하고\n오래오래 기억해요',
    body: '기록을 남기면 복습 일정이 자동으로 생깁니다.\n오늘 복습을 체크하고, 놓친 날은 캘린더에서 확인하세요.\n그럼 기록을 시작해볼까요?',
  },
] as const;
