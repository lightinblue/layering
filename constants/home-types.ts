import type { ReviewIntervalDay } from '@/constants/review';

export type HomeStudyRow = {
  id: string;
  subjectName: string;
  content: string;
  /** Optional memo (edit sheet prefill). */
  memo?: string;
  /** Optional chip fill snapshot from the study record. */
  subjectColor?: string;
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

export type HomeReviewCard = {
  id: string;
  /** Underlying schedule ids (one card may group same-interval reviews). */
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
