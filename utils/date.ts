/** Local-calendar date helpers (avoid UTC drift). */

/** Short weekday labels (Sun→Sat order; matches `Date#getDay`). */
const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const;
const WEEKDAY_LABELS = [
  '일요일',
  '월요일',
  '화요일',
  '수요일',
  '목요일',
  '금요일',
  '토요일',
] as const;

/** 0 = Sunday, 1 = Monday (matches `Date#getDay`). */
export type WeekStartsOn = 0 | 1;

export function todayKey(now = new Date()): string {
  return toKey(now);
}

export function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Start of the week containing `date`.
 * @param weekStartsOn 0 = Sunday (default), 1 = Monday
 */
export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = 0): Date {
  const day = date.getDay();
  const offset = (day - weekStartsOn + 7) % 7;
  return addDaysToDate(date, -offset);
}

/** Rotate Sun→Sat labels so index 0 is `weekStartsOn`. */
export function dowLabels(weekStartsOn: WeekStartsOn = 0): readonly string[] {
  if (weekStartsOn === 0) return DOW;
  return [...DOW.slice(weekStartsOn), ...DOW.slice(0, weekStartsOn)];
}

export function dayMeta(date: Date): {
  dateKey: string;
  day: number;
  dow: string;
  weekdayLabel: string;
  dateLabel: string;
  dayNumber: string;
} {
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

export { DOW, WEEKDAY_LABELS };
