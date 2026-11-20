import type { ReviewIntervalDay } from '@/constants/review';
import type {
  HomeReviewCard,
  HomeReviewCheckTarget,
  HomeScreenData,
  HomeStudyRow,
  HomeWeekDay,
} from '@/constants/home-types';
import type { AppData, StudyRecord } from '@/types/domain';
import { DEFAULT_CYCLE } from '@/storage/migrate-app-data';
import { activeRecords } from '@/utils/icloud-merge';
import {
  addDaysToDate,
  dayMeta,
  parseKey,
  startOfWeek,
  todayKey,
  toKey,
  type WeekStartsOn,
} from '@/utils/date';
import { addDays } from '@/utils/review-schedule';

/** Weeks before the current week available for swipe paging (~3 months). */
export const WEEKS_BEFORE = 13;
/** Weeks after the current week available for swipe paging. */
export const WEEKS_AFTER = 2;

export type ReviewStudyDetail = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
  subjectColor?: string;
};

export function checkTargetId(target: HomeReviewCheckTarget): string {
  return `${target.studyId}#${target.intervalDays}`;
}

function cycleFor(record: StudyRecord): ReviewIntervalDay[] {
  return record.cycle?.length ? record.cycle : DEFAULT_CYCLE;
}

function isCheckDone(record: StudyRecord, intervalDays: number): boolean {
  return Boolean(record.checks[String(intervalDays)]?.done);
}

/** Group due reviews on a day by interval (matches Figma multi-subject cards). */
function reviewsForDay(dateKey: string, data: AppData): HomeReviewCard[] {
  type Due = { record: StudyRecord; intervalDays: ReviewIntervalDay };
  const due: Due[] = [];

  for (const record of activeRecords(data.records)) {
    for (const intervalDays of cycleFor(record)) {
      if (addDays(record.studiedOn, intervalDays) === dateKey) {
        due.push({ record, intervalDays });
      }
    }
  }
  if (due.length === 0) return [];

  const byInterval = new Map<ReviewIntervalDay, Due[]>();
  for (const item of due) {
    const list = byInterval.get(item.intervalDays) ?? [];
    list.push(item);
    byInterval.set(item.intervalDays, list);
  }

  const cards: HomeReviewCard[] = [];
  for (const [intervalDays, items] of [...byInterval.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    const checkTargets: HomeReviewCheckTarget[] = items.map((item) => ({
      studyId: item.record.id,
      intervalDays,
    }));
    const subjectNames = [
      ...new Set(items.map((item) => item.record.subjectName)),
    ];

    cards.push({
      id: checkTargets.map(checkTargetId).join('+'),
      checkTargets,
      scheduleIds: checkTargets.map(checkTargetId),
      intervalDays,
      subjectNames,
      completed: items.every((item) =>
        isCheckDone(item.record, item.intervalDays),
      ),
      studies: items.map((item) => ({
        subjectName: item.record.subjectName,
        content: item.record.content,
        studiedOn: item.record.studiedOn,
        studyId: item.record.id,
        ...(item.record.memo?.trim()
          ? { memo: item.record.memo.trim() }
          : {}),
        ...(item.record.subjectColor
          ? { subjectColor: item.record.subjectColor }
          : {}),
      })),
    });
  }
  return cards;
}

function studySortKey(r: {
  dayOrder?: number;
  createdAt?: string;
  id: string;
}): string {
  const order =
    typeof r.dayOrder === 'number' ? r.dayOrder : Number.MAX_SAFE_INTEGER;
  return `${String(order).padStart(8, '0')}|${r.createdAt ?? ''}|${r.id}`;
}

function studiesForDay(dateKey: string, data: AppData): HomeStudyRow[] {
  return activeRecords(data.records)
    .filter((r) => r.studiedOn === dateKey)
    .slice()
    .sort((a, b) => studySortKey(a).localeCompare(studySortKey(b)))
    .map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      content: r.content,
      ...(r.memo?.trim() ? { memo: r.memo.trim() } : {}),
      ...(r.subjectColor ? { subjectColor: r.subjectColor } : {}),
      ...(r.dayBand ? { dayBand: r.dayBand } : {}),
      ...(typeof r.dayOrder === 'number' ? { dayOrder: r.dayOrder } : {}),
      createdAt: r.createdAt,
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
  /** First column weekday for the week strip (0 = Sun, 1 = Mon). */
  weekStartsOn?: WeekStartsOn;
};

/** Build Home weeks around real (or provided) today from persisted AppData. */
export function homeScreenDataFromAppData(
  data: AppData,
  now = new Date(),
  options?: HomeScreenDataOptions,
): HomeScreenData {
  const today = todayKey(now);
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const currentStart = startOfWeek(
    options?.weekAnchor ?? now,
    weekStartsOn,
  );
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

/** Resolve study details for a review card (by check targets or synthetic ids). */
export function studyDetailsForSchedules(
  data: AppData,
  scheduleIds: string[],
): ReviewStudyDetail[] {
  const studies: ReviewStudyDetail[] = [];
  const seen = new Set<string>();
  for (const id of scheduleIds) {
    let studyId = id;
    const hash = id.indexOf('#');
    if (hash > 0) studyId = id.slice(0, hash);
    const record = activeRecords(data.records).find((r) => r.id === studyId);
    if (!record || seen.has(record.id)) continue;
    seen.add(record.id);
    studies.push({
      subjectName: record.subjectName,
      content: record.content,
      studiedOn: record.studiedOn,
      ...(record.memo?.trim() ? { memo: record.memo.trim() } : {}),
      ...(record.subjectColor ? { subjectColor: record.subjectColor } : {}),
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
