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
import {
  pushSyncedPrefsToICloud,
  subscribeSyncedPrefs,
} from '@/storage/icloud-sync';

type CalendarPrefsContextValue = {
  prefs: CalendarPrefs;
  weekStartsOn: WeekdayStart;
  setWeekStartsOn: (value: WeekdayStart) => void;
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

  useEffect(() => {
    return subscribeSyncedPrefs((next) => {
      setPrefs({ weekStartsOn: next.weekStartsOn });
    });
  }, []);

  const setWeekStartsOn = useCallback((weekStartsOn: WeekdayStart) => {
    const next = { weekStartsOn };
    setPrefs(next);
    void saveCalendarPrefs(next);
    void pushSyncedPrefsToICloud({ weekStartsOn });
  }, []);

  const value = useMemo<CalendarPrefsContextValue>(
    () => ({
      prefs,
      weekStartsOn: prefs.weekStartsOn,
      setWeekStartsOn,
      hydrated,
    }),
    [prefs, setWeekStartsOn, hydrated],
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
