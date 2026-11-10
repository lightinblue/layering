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
  /** Calendar day-of-month within the demo week. */
  day: number;
  dow: string;
  weekdayLabel: string;
  dateLabel: string;
  dayNumber: string;
  studies: HomeStudyRow[];
  reviews: HomeReviewCard[];
};

export type HomeScreenData = {
  /** Demo “today” day-of-month (selection baseline for future checks). */
  todayDay: number;
  weekDays: HomeWeekDay[];
};

/** Demo week: Sun 8 – Sat 14 Nov; “today” = Mon 9. */
export const HOME_TODAY_DAY = 9;

const WEEK_META: Omit<HomeWeekDay, 'studies' | 'reviews'>[] = [
  {
    day: 8,
    dow: 'SUN',
    dayNumber: '08',
    weekdayLabel: '일요일',
    dateLabel: '11월 8일',
  },
  {
    day: 9,
    dow: 'MON',
    dayNumber: '09',
    weekdayLabel: '월요일',
    dateLabel: '11월 9일',
  },
  {
    day: 10,
    dow: 'TUE',
    dayNumber: '10',
    weekdayLabel: '화요일',
    dateLabel: '11월 10일',
  },
  {
    day: 11,
    dow: 'WED',
    dayNumber: '11',
    weekdayLabel: '수요일',
    dateLabel: '11월 11일',
  },
  {
    day: 12,
    dow: 'THU',
    dayNumber: '12',
    weekdayLabel: '목요일',
    dateLabel: '11월 12일',
  },
  {
    day: 13,
    dow: 'FRI',
    dayNumber: '13',
    weekdayLabel: '금요일',
    dateLabel: '11월 13일',
  },
  {
    day: 14,
    dow: 'SAT',
    dayNumber: '14',
    weekdayLabel: '토요일',
    dateLabel: '11월 14일',
  },
];

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

/** Per-day mock payloads keyed by day-of-month (demo week). */
const DAY_CONTENT: Record<
  number,
  { studies: HomeStudyRow[]; reviews: HomeReviewCard[] }
> = {
  // Past: lighter day
  8: {
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
  // Today — filled by demo state (full / few / empty)
  9: { studies: FULL_STUDIES, reviews: FULL_REVIEWS },
  // Future days: empty (no add CTA when selected)
  10: { studies: [], reviews: [] },
  11: { studies: [], reviews: [] },
  12: { studies: [], reviews: [] },
  13: { studies: [], reviews: [] },
  14: { studies: [], reviews: [] },
};

function buildWeek(
  todayContent: { studies: HomeStudyRow[]; reviews: HomeReviewCard[] },
): HomeWeekDay[] {
  return WEEK_META.map((meta) => {
    const content =
      meta.day === HOME_TODAY_DAY
        ? todayContent
        : (DAY_CONTENT[meta.day] ?? { studies: [], reviews: [] });
    return {
      ...meta,
      studies: content.studies,
      reviews: content.reviews,
    };
  });
}

export type HomeDemoState = 'full' | 'few' | 'empty';

export const HOME_DEMO_STATES: HomeDemoState[] = ['full', 'few', 'empty'];

export const HOME_MOCK: Record<HomeDemoState, HomeScreenData> = {
  full: {
    todayDay: HOME_TODAY_DAY,
    weekDays: buildWeek({ studies: FULL_STUDIES, reviews: FULL_REVIEWS }),
  },
  few: {
    todayDay: HOME_TODAY_DAY,
    weekDays: buildWeek({ studies: FEW_STUDIES, reviews: FEW_REVIEWS }),
  },
  empty: {
    todayDay: HOME_TODAY_DAY,
    weekDays: buildWeek({ studies: [], reviews: [] }),
  },
};

export function intervalLabel(days: ReviewIntervalDay): string {
  return `${days}일 전`;
}
