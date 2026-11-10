import type { ReviewIntervalDay } from '@/constants/review';

export type HomeStudyRow = {
  id: string;
  subjectName: string;
  content: string;
};

export type HomeReviewCard = {
  id: string;
  intervalDays: ReviewIntervalDay;
  subjectNames: string[];
  completed: boolean;
};

export type HomeWeekDay = {
  /** ISO date YYYY-MM-DD (unique across weeks). */
  dateKey: string;
  /** Calendar day-of-month. */
  day: number;
  dow: string;
  weekdayLabel: string;
  dateLabel: string;
  dayNumber: string;
  studies: HomeStudyRow[];
  reviews: HomeReviewCard[];
};

export type HomeScreenData = {
  /** Demo “today” ISO date (selection baseline for today/future checks). */
  todayKey: string;
  /** Index of the current (demo) week inside `weeks`. */
  currentWeekIndex: number;
  /** Contiguous Sun–Sat weeks around the demo week. */
  weeks: HomeWeekDay[][];
};

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const WEEKDAY_LABELS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const;

/** Demo “today” = Mon 9 Nov 2026. */
export const HOME_TODAY_KEY = '2026-11-09';
/** Demo week Sunday start. */
export const DEMO_WEEK_START_KEY = '2026-11-08';
/** Weeks before/after the demo week available for swipe paging. */
export const WEEK_RANGE = 2;

/** @deprecated Prefer HOME_TODAY_KEY; kept for day-of-month display helpers. */
export const HOME_TODAY_DAY = 9;

const FULL_STUDIES: HomeStudyRow[] = [
  { id: 's1', subjectName: '분류', content: '1-2단원 필기' },
  { id: 's2', subjectName: '교육학', content: '개념 강의 3강' },
];

const FULL_REVIEWS: HomeReviewCard[] = [
  {
    id: 'r1',
    intervalDays: 1,
    subjectNames: ['분류', '교육학'],
    completed: false,
  },
  {
    id: 'r2',
    intervalDays: 3,
    subjectNames: ['분류'],
    completed: true,
  },
  {
    id: 'r3',
    intervalDays: 7,
    subjectNames: ['정검'],
    completed: false,
  },
  {
    id: 'r4',
    intervalDays: 15,
    subjectNames: ['분류'],
    completed: false,
  },
  {
    id: 'r5',
    intervalDays: 30,
    subjectNames: ['정검'],
    completed: false,
  },
  {
    id: 'r6',
    intervalDays: 60,
    subjectNames: ['교육학'],
    completed: false,
  },
];

const FEW_STUDIES: HomeStudyRow[] = [
  { id: 's1', subjectName: '분류', content: '1-2단원 필기' },
];

const FEW_REVIEWS: HomeReviewCard[] = [
  {
    id: 'r1',
    intervalDays: 1,
    subjectNames: ['분류', '교육학'],
    completed: false,
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
        intervalDays: 1,
        subjectNames: ['정검'],
        completed: true,
      },
      {
        id: 'r8b',
        intervalDays: 3,
        subjectNames: ['분류'],
        completed: false,
      },
    ],
  },
  // Today filled by demo state (full / few / empty)
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
  // Sparse placeholders so other weeks feel inhabited.
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
          intervalDays: 1,
          subjectNames: ['분류'],
          completed: false,
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

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function metaForDate(date: Date): Omit<HomeWeekDay, 'studies' | 'reviews'> {
  const weekdayIndex = date.getDay();
  const day = date.getDate();
  return {
    dateKey: toKey(date),
    day,
    dow: DOW[weekdayIndex],
    weekdayLabel: WEEKDAY_LABELS[weekdayIndex],
    dateLabel: `${date.getMonth() + 1}월 ${day}일`,
    dayNumber: String(day).padStart(2, '0'),
  };
}

function buildWeek(
  weekStart: Date,
  todayContent: { studies: HomeStudyRow[]; reviews: HomeReviewCard[] },
): HomeWeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const meta = metaForDate(date);
    const isDemoWeek =
      toKey(weekStart) === DEMO_WEEK_START_KEY;
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
    weeks.push(buildWeek(addDays(demoStart, offset * 7), todayContent));
  }
  return weeks;
}

export type HomeDemoState = 'full' | 'few' | 'empty';

export const HOME_DEMO_STATES: HomeDemoState[] = ['full', 'few', 'empty'];

export const HOME_MOCK: Record<HomeDemoState, HomeScreenData> = {
  full: {
    todayKey: HOME_TODAY_KEY,
    currentWeekIndex: WEEK_RANGE,
    weeks: buildWeeks({ studies: FULL_STUDIES, reviews: FULL_REVIEWS }),
  },
  few: {
    todayKey: HOME_TODAY_KEY,
    currentWeekIndex: WEEK_RANGE,
    weeks: buildWeeks({ studies: FEW_STUDIES, reviews: FEW_REVIEWS }),
  },
  empty: {
    todayKey: HOME_TODAY_KEY,
    currentWeekIndex: WEEK_RANGE,
    weeks: buildWeeks({ studies: [], reviews: [] }),
  },
};

export function intervalLabel(days: ReviewIntervalDay): string {
  return `${days}일 전`;
}

/** Flat list of all days across weeks (for lookups). */
export function flattenWeeks(weeks: HomeWeekDay[][]): HomeWeekDay[] {
  return weeks.flat();
}
