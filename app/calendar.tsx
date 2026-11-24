import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import { queueHomeDay } from '@/utils/pending-home-day';

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
      // Web: jump Home to that day (no /day study sheet).
      // Queue + back — navigate/dismissTo with ?day= is flaky on Safari SPA modals.
      if (Platform.OS === 'web') {
        queueHomeDay(dateKey);
        if (router.canGoBack()) {
          router.back();
        } else {
          router.navigate('/');
        }
        return;
      }
      // Native: open the day study detail (same surface as home summary).
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
      {/*
        Always mount MonthCalendar — swapping Loading → calendar remounted the
        month FlatList on web and snapped to a wrong grid while the title stayed
        on the focus month. Progress dots fill in once appData hydrates.
      */}
      <View style={styles.content}>
        {!hydrated ? (
          <View style={styles.loadingInline} pointerEvents="none">
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : null}
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
    </SheetPanel>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  loadingInline: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 1,
  },
});
