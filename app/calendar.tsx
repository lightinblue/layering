import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MonthCalendar } from '@/components/home/MonthCalendar';
import {
  demoContentForDate,
  HOME_TODAY_KEY,
} from '@/constants/home-mock';
import { fonts } from '@/constants/fonts';
import { colors } from '@/constants/tokens';
import { loadAppData } from '@/storage/app-data';
import {
  DATA_MODE_LABEL,
  DEFAULT_DATA_MODE,
  loadDataMode,
  type DataMode,
} from '@/storage/data-mode';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import {
  progressFromAppData,
  progressFromReviewCards,
  type DayProgress,
} from '@/utils/day-progress';
import { parseYearMonth } from '@/utils/month-grid';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Full-month 전체보기 — progress dots + day → home selection. */
export default function CalendarScreen() {
  const router = useRouter();
  const theme = useThemeColors();
  const params = useLocalSearchParams<{ focus?: string }>();
  const focusParam = firstParam(params.focus);

  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<DataMode>(DEFAULT_DATA_MODE);
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
      const [storedMode, storedApp] = await Promise.all([
        loadDataMode(),
        loadAppData(),
      ]);
      if (cancelled) return;
      setMode(storedMode);
      setAppData(storedApp);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effectiveToday =
    mode === 'dummy' ? HOME_TODAY_KEY : todayKey();

  const progressForDay = useCallback(
    (dateKey: string): DayProgress => {
      if (mode === 'dummy') {
        return progressFromReviewCards(demoContentForDate(dateKey).reviews);
      }
      if (!appData) {
        return { total: 0, completed: 0, ratio: null };
      }
      return progressFromAppData(appData, dateKey);
    },
    [mode, appData],
  );

  const onMonthChange = useCallback((nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonthIndex(nextMonth);
  }, []);

  const onSelectDay = useCallback(
    (dateKey: string) => {
      // Pop the modal and land on home with the chosen day selected.
      if (typeof router.dismissTo === 'function') {
        router.dismissTo({
          pathname: '/',
          params: { day: dateKey },
        });
        return;
      }
      router.navigate({
        pathname: '/',
        params: { day: dateKey },
      });
    },
    [router],
  );

  const modeHint = useMemo(() => {
    if (mode === 'dummy') return `${DATA_MODE_LABEL.dummy} · 미리보기`;
    return DATA_MODE_LABEL.real;
  }, [mode]);

  if (!hydrated) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MonthCalendar
        year={year}
        monthIndex={monthIndex}
        todayKey={effectiveToday}
        focusKey={focusParam}
        progressForDay={progressForDay}
        onSelectDay={onSelectDay}
        onMonthChange={onMonthChange}
      />
      <Text style={styles.modeHint}>{modeHint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mainWhite,
    paddingTop: 12,
    paddingBottom: 24,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeHint: {
    marginTop: 20,
    alignSelf: 'center',
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
});
