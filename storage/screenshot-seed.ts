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
import { normalizeAppData } from '@/storage/migrate-app-data';
import type { AppData, SubjectChip } from '@/types/domain';
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
  /**
   * Which review intervals start checked (calendar fill).
   * Overridden for due-today (always off) and due-yesterday (always on).
   */
  completedIntervals?: readonly number[];
};

const SCREENSHOT_SUBJECTS: SubjectChip[] = [
  {
    id: 'shot-sub-list',
    name: '목록',
    color: colors.chipGreen,
    order: 0,
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'shot-sub-class',
    name: '분류',
    color: colors.chipBlue,
    order: 1,
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'shot-sub-path',
    name: '학도',
    color: colors.chipPurple,
    order: 2,
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
  {
    id: 'shot-sub-media',
    name: '매체',
    color: colors.chipGray,
    order: 3,
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
];

/** Empty product seed after screenshots (same as first-load default). */
export function buildDefaultAppData(): AppData {
  return normalizeAppData({
    subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s })),
    records: [],
    schedules: [],
  });
}

function studiedOnFrom(today: string, daysAgo: number): string {
  return addDays(today, -daysAgo);
}

/**
 * Rich 임용/수험 demo for home · review sheet · add sheet · month calendar.
 * Home “오늘 한 공부” stays at exactly one study so the shot reads clean.
 */
export function buildScreenshotAppData(now = new Date()): AppData {
  const today = todayKey(now);
  const createdAt = now.toISOString();
  const yesterday = addDays(today, -1);

  const specs: SeedStudySpec[] = [
    {
      id: 'shot-study-today-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: 'DDC 연습 문제',
      memo: '표 암기만 다시',
      daysAgo: 0,
    },
    {
      id: 'shot-study-d1-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: '목록규칙 필기',
      memo: '용어 한 번 더',
      daysAgo: 1,
    },
    {
      id: 'shot-study-d3-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: 'KDC 표 암기',
      daysAgo: 3,
      completedIntervals: [1],
    },
    {
      id: 'shot-study-d7-path',
      subjectId: 'shot-sub-path',
      subjectName: '학도',
      content: '사서직 기출 요약',
      daysAgo: 7,
      completedIntervals: [1, 3],
    },
    {
      id: 'shot-study-d15-media',
      subjectId: 'shot-sub-media',
      subjectName: '매체',
      content: '시청각 자료 정리',
      daysAgo: 15,
      completedIntervals: [1, 3, 7],
    },
    {
      id: 'shot-study-d30-list',
      subjectId: 'shot-sub-list',
      subjectName: '목록',
      content: 'MARC 필드 복습',
      daysAgo: 30,
      completedIntervals: [1, 3, 7, 15],
    },
    {
      id: 'shot-study-d60-class',
      subjectId: 'shot-sub-class',
      subjectName: '분류',
      content: '분류 체계 총정리',
      daysAgo: 60,
      completedIntervals: [1, 3, 7, 15, 30],
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

  const schedules = specs.flatMap((spec) => {
    const studiedOn = studiedOnFrom(today, spec.daysAgo);
    const done = new Set(spec.completedIntervals ?? []);
    return REVIEW_INTERVAL_DAYS.map((intervalDays) => {
      const dueOn = addDays(studiedOn, intervalDays);
      let completed = done.has(intervalDays);
      if (dueOn === today) completed = false;
      if (dueOn === yesterday) completed = true;
      return {
        id: `shot-rev-${spec.id}-${intervalDays}`,
        studyRecordId: spec.id,
        intervalDays,
        dueOn,
        completed,
        ...(completed ? { completedAt: createdAt } : {}),
      };
    });
  });

  const records = specs.map((spec) => {
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

  return normalizeAppData({
    subjects: SCREENSHOT_SUBJECTS.map((s) => ({ ...s, updatedAt: createdAt })),
    records,
    schedules,
  });
}
