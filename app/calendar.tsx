import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { MonthCalendar } from '@/components/home/MonthCalendar';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import { loadAppData } from '@/storage/app-data';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import {
  progressFromAppData,
  type DayProgress,
} from '@/utils/day-progress';
import { parseYearMonth } from '@/utils/month-grid';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Full-month calendar — progress dots + day → home selection. */
export default function CalendarScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusParam = firstParam(params.focus);

  const [hydrated, setHydrated] = useState(false);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [year, setYear] = useState(() => {
    const key = focusParam && /^\d{4}-\d{2}-\d{2}$/.test(focusParam)
      ? focusParam
      : todayKey();
    return parseYearMonth(key).year;
  });
  const [monthIndex, setMonthIndex] = useState(() => {
    const key = focusParam && /^\d{4}-\d{2}-\d{2}$/.test(focusParam)
      ? focusParam
      : todayKey();
    return parseYearMonth(key).monthIndex;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedApp = await loadAppData();
      if (cancelled) return;
      setAppData(storedApp);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveToday = todayKey();

  const progressForDay = useCallback(
    (dateKey: string): DayProgress => {
      if (!appData) {
        return { total: 0, completed: 0, ratio: null };
      }
      return progressFromAppData(appData, dateKey);
    },
    [appData],
  );

  const onMonthChange = useCallback((nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonthIndex(nextMonth);
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const onSelectDay = useCallback(
    (dateKey: string) => {
      // Open the day timeline depth (same surface as home summary).
      if (typeof router.dismissTo === 'function') {
        router.dismissTo({
          pathname: '/day',
          params: { date: dateKey },
        });
        return;
      }
      router.navigate({
        pathname: '/day',
        params: { date: dateKey },
      });
    },
    [router],
  );

  return (
    <SheetPanel onClose={onClose}>
      {!hydrated ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          <MonthCalendar
            year={year}
            monthIndex={monthIndex}
            todayKey={effectiveToday}
            focusKey={focusParam}
            progressForDay={progressForDay}
            onSelectDay={onSelectDay}
            onMonthChange={onMonthChange}
          />
        </View>
      )}
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  loading: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
