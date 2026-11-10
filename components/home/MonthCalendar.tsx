import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { fonts } from '@/constants/fonts';
import { colors, softFromPrimary, spacing } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { DayProgress } from '@/utils/day-progress';
import { emptyDayProgress, progressDotColor } from '@/utils/day-progress';
import {
  buildMonthGrid,
  monthTitle,
  shiftMonth,
  type MonthCell,
} from '@/utils/month-grid';

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const DOT = 7;

type MonthCalendarProps = {
  year: number;
  monthIndex: number;
  /** Device / dummy “today” key. */
  todayKey: string;
  /** Currently focused day on home (optional highlight). */
  focusKey?: string;
  progressForDay: (dateKey: string) => DayProgress;
  onSelectDay: (dateKey: string) => void;
  onMonthChange: (year: number, monthIndex: number) => void;
};

export function MonthCalendar({
  year,
  monthIndex,
  todayKey,
  focusKey,
  progressForDay,
  onSelectDay,
  onMonthChange,
}: MonthCalendarProps) {
  const theme = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const frameWidth = Math.min(windowWidth - 32, spacing.frameWidth);
  const cells = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );
  const cellWidth = frameWidth / 7;

  const goPrev = () => {
    const next = shiftMonth(year, monthIndex, -1);
    onMonthChange(next.year, next.monthIndex);
  };
  const goNext = () => {
    const next = shiftMonth(year, monthIndex, 1);
    onMonthChange(next.year, next.monthIndex);
  };

  return (
    <View style={[styles.root, { width: frameWidth }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          onPress={goPrev}
          hitSlop={12}
          style={styles.navBtn}>
          <Text style={[styles.navGlyph, { color: theme.primary }]}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{monthTitle(year, monthIndex)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          onPress={goNext}
          hitSlop={12}
          style={styles.navBtn}>
          <Text style={[styles.navGlyph, { color: theme.primary }]}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} style={[styles.weekdayCell, { width: cellWidth }]}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => (
          <DayCell
            key={cell.dateKey}
            cell={cell}
            width={cellWidth}
            todayKey={todayKey}
            focusKey={focusKey}
            progress={
              cell.inMonth ? progressForDay(cell.dateKey) : emptyDayProgress()
            }
            primary={theme.primary}
            onPress={onSelectDay}
          />
        ))}
      </View>
    </View>
  );
}

function DayCell({
  cell,
  width,
  todayKey,
  focusKey,
  progress,
  primary,
  onPress,
}: {
  cell: MonthCell;
  width: number;
  todayKey: string;
  focusKey?: string;
  progress: DayProgress;
  primary: string;
  onPress: (dateKey: string) => void;
}) {
  const isToday = cell.dateKey === todayKey;
  const isFocus = focusKey != null && cell.dateKey === focusKey;
  const dotColor = cell.inMonth ? progressDotColor(primary, progress) : null;
  const selectedBg = softFromPrimary(primary, 0.88);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cell.day}일`}
      accessibilityState={{ selected: isFocus }}
      disabled={!cell.inMonth}
      onPress={() => onPress(cell.dateKey)}
      style={[styles.dayCell, { width }]}>
      <View
        style={[
          styles.dayInner,
          isFocus && cell.inMonth
            ? { backgroundColor: selectedBg }
            : null,
        ]}>
        <Text
          style={[
            styles.dayNum,
            !cell.inMonth && styles.dayNumOutside,
            isToday && cell.inMonth && { color: primary },
            isFocus && cell.inMonth && styles.dayNumFocus,
          ]}>
          {cell.day}
        </Text>
        <View style={styles.dotSlot}>
          {dotColor ? (
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'center',
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGlyph: {
    fontFamily: fonts.gothamMedium,
    fontSize: 28,
    lineHeight: 32,
    marginTop: -2,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
    color: colors.black,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  weekdayText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: colors.mutedLight,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayInner: {
    width: 40,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  dayNum: {
    fontFamily: fonts.gothamMedium,
    fontSize: 16,
    color: colors.black,
    textAlign: 'center',
  },
  dayNumOutside: {
    color: colors.mutedLight,
    opacity: 0.45,
  },
  dayNumFocus: {
    fontFamily: fonts.gothamBold,
  },
  dotSlot: {
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
});
