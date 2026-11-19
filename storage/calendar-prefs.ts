import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

/**
 * Weekday index matching `Date#getDay()`:
 * 0 = Sunday, 1 = Monday.
 * Device-local only (not iCloud-synced).
 */
export type WeekdayStart = 0 | 1;

export type CalendarPrefs = {
  /** Home week strip first column. */
  weekStartsOn: WeekdayStart;
  /** Month calendar grid first column. */
  monthStartsOn: WeekdayStart;
};

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  weekStartsOn: 0,
  monthStartsOn: 0,
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

export async function loadCalendarPrefs(): Promise<CalendarPrefs> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.calendarPrefs);
  if (!raw) return { ...DEFAULT_CALENDAR_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<CalendarPrefs>;
    return {
      weekStartsOn: isWeekdayStart(parsed.weekStartsOn)
        ? parsed.weekStartsOn
        : DEFAULT_CALENDAR_PREFS.weekStartsOn,
      monthStartsOn: isWeekdayStart(parsed.monthStartsOn)
        ? parsed.monthStartsOn
        : DEFAULT_CALENDAR_PREFS.monthStartsOn,
    };
  } catch {
    return { ...DEFAULT_CALENDAR_PREFS };
  }
}

export async function saveCalendarPrefs(prefs: CalendarPrefs): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.calendarPrefs, JSON.stringify(prefs));
}
