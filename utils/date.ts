/** Local-calendar date helpers (avoid UTC drift). */

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

/** Sunday of the week that contains `date`. */
export function startOfWeek(date: Date): Date {
  return addDaysToDate(date, -date.getDay());
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

const SHORT_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** Single-character Korean weekday (일…토). */
export function shortWeekdayLabel(date: Date): string {
  return SHORT_WEEKDAYS[date.getDay()];
}

/**
 * Schedule row label, e.g. `11/10 (화)`.
 * When `relativeToYear` is set and the date is in another year, appends `(YYYY)`.
 */
export function scheduleDateLabel(
  isoDate: string,
  relativeToYear?: number,
): string {
  const date = parseKey(isoDate);
  const base = `${date.getMonth() + 1}/${date.getDate()} (${shortWeekdayLabel(date)})`;
  if (relativeToYear != null && date.getFullYear() !== relativeToYear) {
    return `${base} (${date.getFullYear()})`;
  }
  return base;
}

export { DOW, WEEKDAY_LABELS, SHORT_WEEKDAYS };
