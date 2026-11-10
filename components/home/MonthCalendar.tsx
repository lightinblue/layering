import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { colors, softFromPrimary, spacing } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import { DOW } from '@/utils/date';
import type { DayProgress } from '@/utils/day-progress';
import { emptyDayProgress, progressDotColor } from '@/utils/day-progress';
import {
  buildMonthGrid,
  monthTitle,
  shiftMonth,
  type MonthCell,
} from '@/utils/month-grid';
import { haptics } from '@/utils/haptics';

const DOT = 8;
/** Month nav chevron — slightly larger than home 「자세히」 arrow. */
const NAV_ARROW = 18;
const TITLE_SIZE = 16;

/** Soft ease-out — same language as date / week pill. */
const MONTH_EASE = Easing.out(Easing.cubic);

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
  // Slightly wider than prior (margin 20 vs 32) so the grid reads larger.
  const frameWidth = Math.min(windowWidth - 20, spacing.frameWidth + 8);
  const cells = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );
  const cellWidth = frameWidth / 7;

  const goPrev = () => {
    haptics.monthChange();
    const next = shiftMonth(year, monthIndex, -1);
    onMonthChange(next.year, next.monthIndex);
  };
  const goNext = () => {
    haptics.monthChange();
    const next = shiftMonth(year, monthIndex, 1);
    onMonthChange(next.year, next.monthIndex);
  };

  const monthKey = `${year}-${monthIndex}`;

  return (
    <View style={[styles.root, { width: frameWidth }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          onPress={goPrev}
          hitSlop={12}
          style={styles.navBtn}>
          <View style={styles.navArrowPrev}>
            <ArrowRightIcon size={NAV_ARROW} />
          </View>
        </Pressable>
        <Animated.Text
          key={`title-${monthKey}`}
          entering={FadeIn.duration(durations.monthChange).easing(MONTH_EASE)}
          exiting={FadeOut.duration(durations.monthChange).easing(MONTH_EASE)}
          style={styles.title}>
          {monthTitle(year, monthIndex)}
        </Animated.Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          onPress={goNext}
          hitSlop={12}
          style={styles.navBtn}>
          <ArrowRightIcon size={NAV_ARROW} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {DOW.map((label) => (
          <View key={label} style={[styles.weekdayCell, { width: cellWidth }]}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <Animated.View
        key={`grid-${monthKey}`}
        entering={FadeIn.duration(durations.monthChange).easing(MONTH_EASE)}
        exiting={FadeOut.duration(durations.monthChange).easing(MONTH_EASE)}
        style={styles.grid}>
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
      </Animated.View>
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
      onPress={() => {
        haptics.select();
        onPress(cell.dateKey);
      }}
      style={[styles.dayCell, { width }]}>
      <View
        style={[
          styles.dayInner,
          { width: Math.min(44, Math.max(32, width - 4)) },
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
    gap: 16,
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
  navArrowPrev: {
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: TITLE_SIZE,
    color: colors.body,
    letterSpacing: -TITLE_SIZE * 0.04,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  weekdayText: {
    fontFamily: fonts.nexonBold,
    fontSize: 12,
    color: colors.mutedLight,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: 5,
  },
  dayInner: {
    // Width capped to cell so narrow frames don’t clip neighbors.
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 6,
    paddingBottom: 6,
  },
  dayNum: {
    fontFamily: fonts.gothamMedium,
    fontSize: 17,
    // Blue-gray (not pure black); lighter than month title (`body`).
    color: colors.accentText,
    textAlign: 'center',
  },
  dayNumOutside: {
    color: colors.mutedLight,
    opacity: 0.45,
  },
  dayNumFocus: {
    fontFamily: fonts.gothamBold,
    color: colors.body,
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
