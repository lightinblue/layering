import type { ReviewIntervalDay } from '@/constants/review';
import type {
  HomeReviewCard,
  HomeScreenData,
  HomeStudyRow,
  HomeWeekDay,
} from '@/constants/home-types';
import {
  addDaysToDate,
  dayMeta,
  parseKey,
  startOfWeek,
  toKey,
} from '@/utils/date';
import { WEEK_RANGE } from '@/utils/home-from-app-data';

export type {
  HomeReviewCard,
  HomeReviewStudy,
  HomeScreenData,
  HomeStudyRow,
  HomeWeekDay,
} from '@/constants/home-types';

/**
 * Fixed demo “today” so canned 더미 fixtures stay stable in Expo Go.
 * (실제 mode uses the device clock instead.)
 */
export const HOME_TODAY_KEY = '2026-11-09';
export const DEMO_WEEK_START_KEY = '2026-11-08';

/** @deprecated Prefer HOME_TODAY_KEY. */
export const HOME_TODAY_DAY = 9;

const FULL_STUDIES: HomeStudyRow[] = [
  { id: 's1', subjectName: '분류', content: '1-2단원 필기' },
  { id: 's2', subjectName: '교육학', content: '개념 강의 3강' },
];

function studyDetail(
  subjectName: string,
  content: string,
  studiedOn: string,
  memo?: string,
): HomeReviewCard['studies'][number] {
  return {
    subjectName,
    content,
    studiedOn,
    ...(memo ? { memo } : {}),
  };
}

const FULL_REVIEWS: HomeReviewCard[] = [
  {
    id: 'r1',
    scheduleIds: ['r1a', 'r1b'],
    intervalDays: 1,
    subjectNames: ['분류', '교육학'],
    completed: false,
    studies: [
      studyDetail('분류', '분류 기출 요약', '2026-11-08', '오답 위주로 다시 보기'),
      studyDetail('교육학', '교육과정 개론', '2026-11-08', '용어 정리 필요'),
    ],
  },
  {
    id: 'r2',
    scheduleIds: ['r2'],
    intervalDays: 3,
    subjectNames: ['분류'],
    completed: true,
    studies: [studyDetail('분류', '1단원 핵심 정리', '2026-11-06')],
  },
  {
    id: 'r3',
    scheduleIds: ['r3'],
    intervalDays: 7,
    subjectNames: ['정검'],
    completed: false,
    studies: [
      studyDetail('정검', '정보검색 기출 20문항', '2026-11-02', '틀린 문제 표시'),
    ],
  },
  {
    id: 'r4',
    scheduleIds: ['r4'],
    intervalDays: 15,
    subjectNames: ['분류'],
    completed: false,
    studies: [studyDetail('분류', 'DDC 연습 문제', '2026-10-25')],
  },
  {
    id: 'r5',
    scheduleIds: ['r5'],
    intervalDays: 30,
    subjectNames: ['정검'],
    completed: false,
    studies: [studyDetail('정검', '데이터베이스 요약', '2026-10-10')],
  },
  {
    id: 'r6',
    scheduleIds: ['r6'],
    intervalDays: 60,
    subjectNames: ['교육학'],
    completed: false,
    studies: [studyDetail('교육학', '교육심리 용어 암기', '2026-09-10')],
  },
];

/** Per-day mock payloads for the demo week (keyed by ISO date). */
const DEMO_DAY_CONTENT: Record<
  string,
  { studies: HomeStudyRow[]; reviews: HomeReviewCard[] }
> = {
  '2026-11-08': {
    studies: [{ id: 's8', subjectName: '정검', content: '기출 10문항' }],
    reviews: [
      {
        id: 'r8a',
        scheduleIds: ['r8a'],
        intervalDays: 1,
        subjectNames: ['정검'],
        completed: true,
        studies: [studyDetail('정검', '기출 10문항 복습', '2026-11-07')],
      },
      {
        id: 'r8b',
        scheduleIds: ['r8b'],
        intervalDays: 3,
        subjectNames: ['분류'],
        completed: false,
        studies: [studyDetail('분류', 'KDC 표 암기', '2026-11-05')],
      },
    ],
  },
  '2026-11-09': { studies: FULL_STUDIES, reviews: FULL_REVIEWS },
  '2026-11-10': { studies: [], reviews: [] },
  '2026-11-11': { studies: [], reviews: [] },
  '2026-11-12': { studies: [], reviews: [] },
  '2026-11-13': { studies: [], reviews: [] },
  '2026-11-14': { studies: [], reviews: [] },
};

/** Light demo content for adjacent weeks (not the current demo week). */
function adjacentDemoContent(
  dateKey: string,
  weekdayIndex: number,
): { studies: HomeStudyRow[]; reviews: HomeReviewCard[] } {
  if (weekdayIndex === 1) {
    return {
      studies: [
        {
          id: `s-${dateKey}`,
          subjectName: '분류',
          content: '복습 노트 정리',
        },
      ],
      reviews: [
        {
          id: `r-${dateKey}`,
          scheduleIds: [`r-${dateKey}`],
          intervalDays: 1,
          subjectNames: ['분류'],
          completed: false,
          studies: [
            studyDetail('분류', '복습 노트 정리', addDaysKey(dateKey, -1)),
          ],
        },
      ],
    };
  }
  if (weekdayIndex === 3) {
    return {
      studies: [
        {
          id: `s-${dateKey}`,
          subjectName: '교육학',
          content: '요약 암기',
        },
      ],
      reviews: [],
    };
  }
  return { studies: [], reviews: [] };
}

function addDaysKey(key: string, days: number): string {
  return toKey(addDaysToDate(parseKey(key), days));
}

function buildWeek(
  weekStart: Date,
  todayContent: { studies: HomeStudyRow[]; reviews: HomeReviewCard[] },
): HomeWeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDate(weekStart, i);
    const meta = dayMeta(date);
    const isDemoWeek = toKey(weekStart) === DEMO_WEEK_START_KEY;
    let content: { studies: HomeStudyRow[]; reviews: HomeReviewCard[] };
    if (isDemoWeek) {
      content =
        meta.dateKey === HOME_TODAY_KEY
          ? todayContent
          : (DEMO_DAY_CONTENT[meta.dateKey] ?? {
              studies: [],
              reviews: [],
            });
    } else {
      content = adjacentDemoContent(meta.dateKey, i);
    }
    return {
      ...meta,
      studies: content.studies,
      reviews: content.reviews,
    };
  });
}

function buildWeeks(
  todayContent: { studies: HomeStudyRow[]; reviews: HomeReviewCard[] },
): HomeWeekDay[][] {
  const demoStart = parseKey(DEMO_WEEK_START_KEY);
  const weeks: HomeWeekDay[][] = [];
  for (let offset = -WEEK_RANGE; offset <= WEEK_RANGE; offset += 1) {
    weeks.push(buildWeek(addDaysToDate(demoStart, offset * 7), todayContent));
  }
  return weeks;
}

/** Rich canned Home fixture for 「더미」 preview mode. */
export const HOME_DUMMY: HomeScreenData = {
  todayKey: HOME_TODAY_KEY,
  currentWeekIndex: WEEK_RANGE,
  weeks: buildWeeks({ studies: FULL_STUDIES, reviews: FULL_REVIEWS }),
};

/** Default subject names for 더미 add sheet. */
export const DUMMY_SUBJECTS = ['분류', '교육학', '정검'] as const;

export function intervalLabel(days: ReviewIntervalDay): string {
  return `${days}일 전`;
}

/** Flat list of all days across weeks (for lookups). */
export function flattenWeeks(weeks: HomeWeekDay[][]): HomeWeekDay[] {
  return weeks.flat();
}

/** Clone weeks deeply enough for in-session 더미 mutations. */
export function cloneHomeData(data: HomeScreenData): HomeScreenData {
  return {
    todayKey: data.todayKey,
    currentWeekIndex: data.currentWeekIndex,
    weeks: data.weeks.map((week) =>
      week.map((day) => ({
        ...day,
        studies: day.studies.map((s) => ({ ...s })),
        reviews: day.reviews.map((r) => ({
          ...r,
          scheduleIds: [...r.scheduleIds],
          subjectNames: [...r.subjectNames],
          studies: r.studies.map((s) => ({ ...s })),
        })),
      })),
    ),
  };
}

/** Apply an in-memory study + future review cards onto dummy Home data. */
export function applyDummyStudy(
  data: HomeScreenData,
  input: {
    subjectName: string;
    content: string;
    studiedOn: string;
    memo?: string;
    intervals?: ReviewIntervalDay[];
  },
): HomeScreenData {
  const intervals = input.intervals ?? [1, 3, 7, 15, 30, 60];
  const next = cloneHomeData(data);
  const studyId = `dummy-s-${Date.now().toString(36)}`;
  const memo = input.memo?.trim();

  for (const week of next.weeks) {
    for (const day of week) {
      if (day.dateKey !== input.studiedOn) continue;
      day.studies = [
        ...day.studies,
        {
          id: studyId,
          subjectName: input.subjectName,
          content: input.content,
        },
      ];
    }
  }

  for (const intervalDays of intervals) {
    const dueOn = addDaysKey(input.studiedOn, intervalDays);
    const scheduleId = `dummy-r-${intervalDays}-${Date.now().toString(36)}`;
    for (const week of next.weeks) {
      for (const day of week) {
        if (day.dateKey !== dueOn) continue;
        const existing = day.reviews.find(
          (r) => r.intervalDays === intervalDays,
        );
        const detail = {
          subjectName: input.subjectName,
          content: input.content,
          studiedOn: input.studiedOn,
          ...(memo ? { memo } : {}),
        };
        if (existing) {
          if (!existing.subjectNames.includes(input.subjectName)) {
            existing.subjectNames = [...existing.subjectNames, input.subjectName];
          }
          existing.scheduleIds = [...existing.scheduleIds, scheduleId];
          existing.studies = [...existing.studies, detail];
          existing.completed = false;
        } else {
          day.reviews = [
            ...day.reviews,
            {
              id: scheduleId,
              scheduleIds: [scheduleId],
              intervalDays: intervalDays as ReviewIntervalDay,
              subjectNames: [input.subjectName],
              completed: false,
              studies: [detail],
            },
          ].sort((a, b) => a.intervalDays - b.intervalDays);
        }
      }
    }
  }

  return next;
}

export function toggleDummyReview(
  data: HomeScreenData,
  dateKey: string,
  cardId: string,
): HomeScreenData {
  const next = cloneHomeData(data);
  for (const week of next.weeks) {
    for (const day of week) {
      if (day.dateKey !== dateKey) continue;
      day.reviews = day.reviews.map((r) =>
        r.id === cardId ? { ...r, completed: !r.completed } : r,
      );
    }
  }
  return next;
}

/** Align week index to the week containing dateKey (fallback current). */
export function weekIndexForDate(
  data: HomeScreenData,
  dateKey: string,
): number {
  const idx = data.weeks.findIndex((week) =>
    week.some((d) => d.dateKey === dateKey),
  );
  return idx >= 0 ? idx : data.currentWeekIndex;
}

export function sundayOf(dateKey: string): string {
  return toKey(startOfWeek(parseKey(dateKey)));
}
