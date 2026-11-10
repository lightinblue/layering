/**
 * __DEV__ App Store screenshot seed — writes rich real AppData into
 * `@bokbok/app-data/v1`. Dates are relative to the device clock so Expo Go
 * screenshots always look like “today”.
 *
 * Production builds never import this from UI paths that ship without `__DEV__`.
 */

import { REVIEW_INTERVAL_DAYS } from '@/constants/review';
import { colors } from '@/constants/tokens';
import { DEFAULT_SUBJECTS } from '@/storage/app-data';
import type {
  AppData,
  ReviewSchedule,
  StudyRecord,
  SubjectChip,
} from '@/types/domain';
import { todayKey } from '@/utils/date';
import { addDays } from '@/utils/review-schedule';

type SeedStudySpec = {
  id: string;
  subjectId: string;
  subjectName: string;
  content: string;
  memo?: string;
  /** Days before today (0 = today). */
  daysAgo: number;
  /** Which review intervals are already checked off. */
  completedIntervals?: readonly number[];
};

const SCREENSHOT_SUBJECTS: SubjectChip[] = [
  { id: 'shot-sub-list', name: '목록', color: colors.chipGreen },
  { id: 'shot-sub-class', name: '분류', color: colors.chipBlue },
  { id: 'shot-sub-path', name: '학도', color: colors.chipPurple },
  { id: 'shot-sub-media', name: '매체', color: colors.chipOrange },
];

/** Empty product seed after screenshots (same as first-load default). */
export function buildDefaultAppData(): AppData {
  return {
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    records: [],
    schedules: [],
  };
}

function studiedOnFrom(today: string, daysAgo: number): string {
  return addDays(today, -daysAgo);
}

function makeSchedules(
  studyId: string,
  studiedOn: string,
  completedIntervals: readonly number[] = [],
  completedAt: string,
): ReviewSchedule[] {
  const done = new Set(completedIntervals);
  return REVIEW_INTERVAL_DAYS.map((intervalDays) => {
    const completed = done.has(intervalDays);
    return {
      id: `shot-rev-${studyId}-${intervalDays}`,
      studyRecordId: studyId,
      intervalDays,
      dueOn: addDays(studiedOn, intervalDays),
      completed,
      ...(completed ? { completedAt } : {}),
    };
  });
}

/**
 * Rich 임용/수험 demo for home · review sheet · add sheet · month calendar.
 * Home “오늘 한 공부” stays at exactly one study so the shot reads clean.
 */
export function buildScreenshotAppData(now = new Date()): AppData {
  const today = todayKey(now);
  const createdAt = now.toISOString();

  const specs: SeedStudySpec[] = [
    // —— Today: exactly one study ——
    {
      id: 'shot-study-today-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: 'DDC 연습 문제',
      memo: '표 암기만 다시',
      daysAgo: 0,
    },

    // —— Feed today’s reviews (+1 / +3 / +7 / +15 / +30 / +60) ——
    {
      id: 'shot-study-d1-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: '목록규칙 필기',
      memo: '용어 한 번 더',
      daysAgo: 1,
    },
    {
      id: 'shot-study-d1-media',
      subjectId: 'shot-sub-media',
      subjectName: '매체',
      content: '매체 기출 20문항',
      memo: '틀린 번호만',
      daysAgo: 1,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d3-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: 'KDC 표 암기',
      daysAgo: 3,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d7-path',
      subjectId: 'shot-sub-path',
      subjectName: '학도',
      content: '이용자 서비스 요약',
      daysAgo: 7,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d15-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: 'MARC 필드 정리',
      daysAgo: 15,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d30-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: '분류 오답 노트',
      daysAgo: 30,
      completedIntervals: [1, 3, 7, 15],
    },
    {
      id: 'shot-study-d60-path',
      subjectId: 'shot-sub-path',
      subjectName: '학도',
      content: '도서관사 연표',
      daysAgo: 60,
      completedIntervals: [1, 3, 7, 15, 30],
    },

    // —— Week strip neighbors ——
    {
      id: 'shot-study-d2-media',
      subjectId: 'shot-sub-media',
      subjectName: '매체',
      content: '틀린 문제 표시',
      daysAgo: 2,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d4-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: '표목 선택 연습',
      daysAgo: 4,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d5-path',
      subjectId: 'shot-sub-path',
      subjectName: '학도',
      content: '정보원 안내 사례',
      daysAgo: 5,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d6-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: '단원별 키워드',
      daysAgo: 6,
      completedIntervals: [1],
    },

    // —— Month calendar fill ——
    {
      id: 'shot-study-d10-media',
      subjectId: 'shot-sub-media',
      subjectName: '매체',
      content: '매체 기출 10문항',
      daysAgo: 10,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d12-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: '목록 평가 정리',
      daysAgo: 12,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d18-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: '핵심 도식 암기',
      daysAgo: 18,
      completedIntervals: [1, 3, 7, 15],
    },
    {
      id: 'shot-study-d22-path',
      subjectId: 'shot-sub-path',
      subjectName: '학도',
      content: '도서관법 요약',
      daysAgo: 22,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d28-media',
      subjectId: 'shot-sub-media',
      subjectName: '매체',
      content: '모의고사 해설',
      daysAgo: 28,
      completedIntervals: [1, 3],
    },
  ];

  const records: StudyRecord[] = specs.map((spec) => {
    const studiedOn = studiedOnFrom(today, spec.daysAgo);
    return {
      id: spec.id,
      subjectId: spec.subjectId,
      subjectName: spec.subjectName,
      content: spec.content,
      ...(spec.memo ? { memo: spec.memo } : {}),
      studiedOn,
      createdAt,
    };
  });

  const schedules: ReviewSchedule[] = specs.flatMap((spec) =>
    makeSchedules(
      spec.id,
      studiedOnFrom(today, spec.daysAgo),
      spec.completedIntervals ?? [],
      createdAt,
    ),
  );

  return {
    subjects: SCREENSHOT_SUBJECTS.map((s) => ({ ...s })),
    records,
    schedules,
  };
}
