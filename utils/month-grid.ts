/** Month calendar grid helpers (Sunday-first). */

import { addDaysToDate, startOfWeek, toKey } from '@/utils/date';

export type MonthCell = {
  dateKey: string;
  day: number;
  /** True when the cell belongs to the displayed month. */
  inMonth: boolean;
};

/** Build a 6×7 (or trimmed) Sunday-first grid for `year` + `monthIndex` (0–11). */
export function buildMonthGrid(year: number, monthIndex: number): MonthCell[] {
  const first = new Date(year, monthIndex, 1);
  const gridStart = startOfWeek(first);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDaysToDate(gridStart, i);
    cells.push({
      dateKey: toKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === monthIndex,
    });
  }
  // Drop a trailing week that is entirely outside the month.
  const lastWeek = cells.slice(35);
  if (lastWeek.every((c) => !c.inMonth)) {
    return cells.slice(0, 35);
  }
  return cells;
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function monthTitle(year: number, monthIndex: number): string {
  return `${year}년 ${monthIndex + 1}월`;
}

export function parseYearMonth(dateKey: string): {
  year: number;
  monthIndex: number;
} {
  const [y, m] = dateKey.split('-').map(Number);
  return { year: y, monthIndex: m - 1 };
}
