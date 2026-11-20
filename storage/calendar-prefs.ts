import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

/**
 * Weekday index matching `Date#getDay()`:
 * 0 = Sunday, 1 = Monday.
 * Local AsyncStorage mirror; synced across devices via KVS `prefs`.
 * Applies to both home week strip and month calendar grid.
 */
export type WeekdayStart = 0 | 1;

export type CalendarPrefs = {
  /** First column for home week strip + month calendar grid. */
  weekStartsOn: WeekdayStart;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  weekStartsOn: 0,
};

export const WEEKDAY_START_OPTIONS: {
  value: WeekdayStart;
  label: string;
  accessibilityLabel: string;
}[] = [
  { value: 0, label: '일요일', accessibilityLabel: '일요일부터' },
  { value: 1, label: '월요일', accessibilityLabel: '월요일부터' },
];

function isWeekdayStart(value: unknown): value is WeekdayStart {
  return value === 0 || value === 1;
}

/**
 * Normalize stored JSON (including legacy `{ weekStartsOn, monthStartsOn }`).
 * Prefer `weekStartsOn`; if missing, fall back to legacy `monthStartsOn`.
 */
export function normalizeCalendarPrefs(raw: unknown): CalendarPrefs {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CALENDAR_PREFS };
  const parsed = raw as {
    weekStartsOn?: unknown;
    monthStartsOn?: unknown;
  };
  if (isWeekdayStart(parsed.weekStartsOn)) {
    return { weekStartsOn: parsed.weekStartsOn };
  }
  if (isWeekdayStart(parsed.monthStartsOn)) {
    return { weekStartsOn: parsed.monthStartsOn };
  }
  return { ...DEFAULT_CALENDAR_PREFS };
}

export async function loadCalendarPrefs(): Promise<CalendarPrefs> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.calendarPrefs);
  if (!raw) return { ...DEFAULT_CALENDAR_PREFS };
  try {
    const prefs = normalizeCalendarPrefs(JSON.parse(raw));
    // Rewrite legacy two-field blobs to the single-field shape.
    const trimmed = JSON.stringify(prefs);
    if (raw !== trimmed) {
      await AsyncStorage.setItem(STORAGE_KEYS.calendarPrefs, trimmed);
    }
    return prefs;
  } catch {
    return { ...DEFAULT_CALENDAR_PREFS };
  }
}

export async function saveCalendarPrefs(prefs: CalendarPrefs): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.calendarPrefs,
    JSON.stringify(normalizeCalendarPrefs(prefs)),
  );
}
