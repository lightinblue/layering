import type { ReviewIntervalDay } from '@/constants/review';

export type HomeStudyRow = {
  id: string;
  subjectName: string;
  content: string;
  /** Optional memo (edit sheet prefill). */
  memo?: string;
  /** Optional chip fill snapshot from the study record. */
  subjectColor?: string;
  /** Optional day-band for study-day UI placement. */
  dayBand?: 'morning' | 'afternoon' | 'evening';
  /** Display order within the day (ascending). */
  dayOrder?: number;
  /** Study-day timeline todo checked. */
  dayDone?: boolean;
  createdAt?: string;
};

export type HomeReviewStudy = {
  subjectName: string;
  /** 학습 내용 (title). */
  content: string;
  studiedOn: string;
  /** Optional memo shown muted under 학습 내용. */
  memo?: string;
  /** Links to HomeStudyRow.id for dummy edit/delete. */
  studyId?: string;
  subjectColor?: string;
};

/** Toggle target — study check keyed by (studyId, intervalDays). */
export type HomeReviewCheckTarget = {
  studyId: string;
  intervalDays: ReviewIntervalDay;
};

export type HomeReviewCard = {
  id: string;
  /**
   * Check targets for this card (one card may group same-interval reviews).
   * Real AppData path always sets this; dummy mocks may omit it.
   */
  checkTargets?: HomeReviewCheckTarget[];
  /**
   * Synthetic `${studyId}#${intervalDays}` ids (compat with day-progress /
   * legacy scheduleId paths).
   */
  scheduleIds: string[];
  intervalDays: ReviewIntervalDay;
  subjectNames: string[];
  completed: boolean;
  /** Study rows shown in 「자세히」 sheet. */
  studies: HomeReviewStudy[];
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
  /** “Today” ISO date (selection baseline for today/future checks). */
  todayKey: string;
  /** Index of the current week inside `weeks`. */
  currentWeekIndex: number;
  /** Contiguous Sun–Sat weeks around the current week. */
  weeks: HomeWeekDay[][];
};
