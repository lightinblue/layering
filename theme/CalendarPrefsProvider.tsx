import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_CALENDAR_PREFS,
  loadCalendarPrefs,
  saveCalendarPrefs,
  type CalendarPrefs,
  type WeekdayStart,
} from '@/storage/calendar-prefs';

type CalendarPrefsContextValue = {
  prefs: CalendarPrefs;
  weekStartsOn: WeekdayStart;
  monthStartsOn: WeekdayStart;
  setWeekStartsOn: (value: WeekdayStart) => void;
  setMonthStartsOn: (value: WeekdayStart) => void;
  hydrated: boolean;
};

const CalendarPrefsContext = createContext<CalendarPrefsContextValue | null>(
  null,
);

export function CalendarPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_CALENDAR_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadCalendarPrefs();
      if (cancelled) return;
      setPrefs(stored);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: CalendarPrefs) => {
    setPrefs(next);
    void saveCalendarPrefs(next);
  }, []);

  const setWeekStartsOn = useCallback(
    (weekStartsOn: WeekdayStart) => {
      persist({ ...prefs, weekStartsOn });
    },
    [persist, prefs],
  );

  const setMonthStartsOn = useCallback(
    (monthStartsOn: WeekdayStart) => {
      persist({ ...prefs, monthStartsOn });
    },
    [persist, prefs],
  );

  const value = useMemo<CalendarPrefsContextValue>(
    () => ({
      prefs,
      weekStartsOn: prefs.weekStartsOn,
      monthStartsOn: prefs.monthStartsOn,
      setWeekStartsOn,
      setMonthStartsOn,
      hydrated,
    }),
    [prefs, setWeekStartsOn, setMonthStartsOn, hydrated],
  );

  return (
    <CalendarPrefsContext.Provider value={value}>
      {children}
    </CalendarPrefsContext.Provider>
  );
}

export function useCalendarPrefs(): CalendarPrefsContextValue {
  const ctx = useContext(CalendarPrefsContext);
  if (!ctx) {
    throw new Error('useCalendarPrefs must be used within CalendarPrefsProvider');
  }
  return ctx;
}
