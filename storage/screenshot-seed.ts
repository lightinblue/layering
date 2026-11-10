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
  { id: 'shot-sub-ed', name: '교육학', color: colors.chipGreen },
  { id: 'shot-sub-maj', name: '전공', color: colors.chipBlue },
  { id: 'shot-sub-teach', name: '교직', color: colors.chipPurple },
  { id: 'shot-sub-past', name: '기출', color: colors.chipOrange },
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
 * Keeps today under the 3-study cap (2 studies) so FAB add still works.
 */
export function buildScreenshotAppData(now = new Date()): AppData {
  const today = todayKey(now);
  const createdAt = now.toISOString();

  const specs: SeedStudySpec[] = [
    // —— Today (home “오늘 한 공부”) ——
    {
      id: 'shot-study-today-ed',
      subjectId: 'shot-sub-ed',
      subjectName: '교육학',
      content: '교육과정 핵심 정리',
      memo: '성취기준만 다시 훑기',
      daysAgo: 0,
    },
    {
      id: 'shot-study-today-maj',
      subjectId: 'shot-sub-maj',
      subjectName: '전공',
      content: '1단원 개념 정리',
      daysAgo: 0,
    },

    // —— Feed today’s reviews (+1 / +3 / +7 / +15 / +30 / +60) ——
    {
      id: 'shot-study-d1-ed',
      subjectId: 'shot-sub-ed',
      subjectName: '교육학',
      content: '학습이론 필기',
      memo: '용어 한 번 더',
      daysAgo: 1,
    },
    {
      id: 'shot-study-d1-past',
      subjectId: 'shot-sub-past',
      subjectName: '기출',
      content: '기출 20문항',
      memo: '틀린 번호만',
      daysAgo: 1,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d3-maj',
      subjectId: 'shot-sub-maj',
      subjectName: '전공',
      content: '교과내용 요약',
      daysAgo: 3,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d7-teach',
      subjectId: 'shot-sub-teach',
      subjectName: '교직',
      content: '교육행정 개념',
      daysAgo: 7,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d15-ed',
      subjectId: 'shot-sub-ed',
      subjectName: '교육학',
      content: '교육심리 용어',
      daysAgo: 15,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d30-maj',
      subjectId: 'shot-sub-maj',
      subjectName: '전공',
      content: '오답 노트 정리',
      daysAgo: 30,
      completedIntervals: [1, 3, 7, 15],
    },
    {
      id: 'shot-study-d60-teach',
      subjectId: 'shot-sub-teach',
      subjectName: '교직',
      content: '교육사 연표',
      daysAgo: 60,
      completedIntervals: [1, 3, 7, 15, 30],
    },

    // —— Week strip neighbors ——
    {
      id: 'shot-study-d2-past',
      subjectId: 'shot-sub-past',
      subjectName: '기출',
      content: '틀린 문제 표시',
      daysAgo: 2,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d4-ed',
      subjectId: 'shot-sub-ed',
      subjectName: '교육학',
      content: '수업설계 요약',
      daysAgo: 4,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d5-teach',
      subjectId: 'shot-sub-teach',
      subjectName: '교직',
      content: '생활지도 사례',
      daysAgo: 5,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d6-maj',
      subjectId: 'shot-sub-maj',
      subjectName: '전공',
      content: '단원별 키워드',
      daysAgo: 6,
      completedIntervals: [1],
    },

    // —— Month calendar fill (spread activity + some completed dots) ——
    {
      id: 'shot-study-d10-past',
      subjectId: 'shot-sub-past',
      subjectName: '기출',
      content: '기출 10문항',
      daysAgo: 10,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d12-ed',
      subjectId: 'shot-sub-ed',
      subjectName: '교육학',
      content: '교육평가 정리',
      daysAgo: 12,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d18-maj',
      subjectId: 'shot-sub-maj',
      subjectName: '전공',
      content: '핵심 도식 암기',
      daysAgo: 18,
      completedIntervals: [1, 3, 7, 15],
    },
    {
      id: 'shot-study-d22-teach',
      subjectId: 'shot-sub-teach',
      subjectName: '교직',
      content: '교육관계법 요약',
      daysAgo: 22,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d28-past',
      subjectId: 'shot-sub-past',
      subjectName: '기출',
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
