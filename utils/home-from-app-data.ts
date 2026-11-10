import type { ReviewIntervalDay } from '@/constants/review';
import type {
  HomeReviewCard,
  HomeScreenData,
  HomeStudyRow,
  HomeWeekDay,
} from '@/constants/home-types';
import type { AppData, ReviewSchedule, StudyRecord } from '@/types/domain';
import {
  addDaysToDate,
  dayMeta,
  parseKey,
  startOfWeek,
  todayKey,
  toKey,
} from '@/utils/date';

/** Weeks before the current week available for swipe paging (~3 months). */
export const WEEKS_BEFORE = 13;
/** Weeks after the current week available for swipe paging. */
export const WEEKS_AFTER = 2;

export type ReviewStudyDetail = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
};

/** Group schedules due on a day by interval (matches Figma multi-subject cards). */
function reviewsForDay(
  dateKey: string,
  data: AppData,
): HomeReviewCard[] {
  const due = data.schedules.filter((s) => s.dueOn === dateKey);
  if (due.length === 0) return [];

  const byInterval = new Map<ReviewIntervalDay, ReviewSchedule[]>();
  for (const schedule of due) {
    const list = byInterval.get(schedule.intervalDays) ?? [];
    list.push(schedule);
    byInterval.set(schedule.intervalDays, list);
  }

  const cards: HomeReviewCard[] = [];
  for (const [intervalDays, schedules] of [...byInterval.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const studies = schedules
      .map((s) => data.records.find((r) => r.id === s.studyRecordId))
      .filter((r): r is StudyRecord => r != null);

    const subjectNames = [
      ...new Set(studies.map((s) => s.subjectName)),
    ];

    cards.push({
      id: schedules.map((s) => s.id).join('+'),
      scheduleIds: schedules.map((s) => s.id),
      intervalDays,
      subjectNames,
      completed: schedules.every((s) => s.completed),
      studies: studies.map((s) => ({
        subjectName: s.subjectName,
        content: s.content,
        studiedOn: s.studiedOn,
        ...(s.memo?.trim() ? { memo: s.memo.trim() } : {}),
      })),
    });
  }
  return cards;
}

function studiesForDay(dateKey: string, data: AppData): HomeStudyRow[] {
  return data.records
    .filter((r) => r.studiedOn === dateKey)
    .map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      content: r.content,
    }));
}

function buildWeek(weekStart: Date, data: AppData): HomeWeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDate(weekStart, i);
    const meta = dayMeta(date);
    return {
      ...meta,
      studies: studiesForDay(meta.dateKey, data),
      reviews: reviewsForDay(meta.dateKey, data),
    };
  });
}

export type HomeScreenDataOptions = {
  /**
   * Center the swipeable week strip on this date’s week.
   * Defaults to `now` (device / dummy “today”).
   */
  weekAnchor?: Date;
};

/** Build Home weeks around real (or provided) today from persisted AppData. */
export function homeScreenDataFromAppData(
  data: AppData,
  now = new Date(),
  options?: HomeScreenDataOptions,
): HomeScreenData {
  const today = todayKey(now);
  const currentStart = startOfWeek(options?.weekAnchor ?? now);
  const weeks: HomeWeekDay[][] = [];
  for (let offset = -WEEKS_BEFORE; offset <= WEEKS_AFTER; offset += 1) {
    weeks.push(buildWeek(addDaysToDate(currentStart, offset * 7), data));
  }
  return {
    todayKey: today,
    currentWeekIndex: WEEKS_BEFORE,
    weeks,
  };
}

/** Resolve study details for a review card (by schedule ids). */
export function studyDetailsForSchedules(
  data: AppData,
  scheduleIds: string[],
): ReviewStudyDetail[] {
  const studies: ReviewStudyDetail[] = [];
  const seen = new Set<string>();
  for (const id of scheduleIds) {
    const schedule = data.schedules.find((s) => s.id === id);
    if (!schedule) continue;
    const record = data.records.find((r) => r.id === schedule.studyRecordId);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    studies.push({
      subjectName: record.subjectName,
      content: record.content,
      studiedOn: record.studiedOn,
      ...(record.memo?.trim() ? { memo: record.memo.trim() } : {}),
    });
  }
  return studies;
}

export function findDayInWeeks(
  weeks: HomeWeekDay[][],
  dateKey: string,
): HomeWeekDay | undefined {
  for (const week of weeks) {
    const day = week.find((d) => d.dateKey === dateKey);
    if (day) return day;
  }
  return undefined;
}

/** Re-key helper when building relative dummy dates from a fixed anchor. */
export function shiftKey(baseKey: string, days: number): string {
  return toKey(addDaysToDate(parseKey(baseKey), days));
}
