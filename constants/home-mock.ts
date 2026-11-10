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
  day: number;
  dow: string;
  selected: boolean;
};

export type HomeScreenData = {
  dayNumber: string;
  weekdayLabel: string;
  dateLabel: string;
  weekDays: HomeWeekDay[];
  studies: HomeStudyRow[];
  reviews: HomeReviewCard[];
};

const WEEK: HomeWeekDay[] = [
  { day: 8, dow: 'SUN', selected: false },
  { day: 9, dow: 'MON', selected: true },
  { day: 10, dow: 'TUE', selected: false },
  { day: 11, dow: 'WED', selected: false },
  { day: 12, dow: 'THU', selected: false },
  { day: 13, dow: 'FRI', selected: false },
  { day: 14, dow: 'SAT', selected: false },
];

const HEADER = {
  dayNumber: '09',
  weekdayLabel: '월요일',
  dateLabel: '11월 9일',
  weekDays: WEEK,
} as const;

export type HomeDemoState = 'full' | 'few' | 'empty';

export const HOME_DEMO_STATES: HomeDemoState[] = ['full', 'few', 'empty'];

export const HOME_MOCK: Record<HomeDemoState, HomeScreenData> = {
  full: {
    ...HEADER,
    studies: [
      { id: 's1', subjectName: '분류', content: '1-2단원 필기' },
      { id: 's2', subjectName: '교육학', content: '개념 강의 3강' },
    ],
    reviews: [
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
    ],
  },
  few: {
    ...HEADER,
    studies: [{ id: 's1', subjectName: '분류', content: '1-2단원 필기' }],
    reviews: [
      {
        id: 'r1',
        intervalDays: 1,
        subjectNames: ['분류', '교육학'],
        completed: false,
      },
    ],
  },
  empty: {
    ...HEADER,
    studies: [],
    reviews: [],
  },
};

export function intervalLabel(days: ReviewIntervalDay): string {
  return `${days}일 전`;
}
