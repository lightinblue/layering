import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import { fonts } from '@/constants/fonts';
import { PAGER_DECELERATION } from '@/constants/motion';
import { softFromPrimary, spacing } from '@/constants/tokens';
import { useThemeColors, type ThemeColors } from '@/theme/ThemeProvider';
import { useCalendarPrefs } from '@/theme/CalendarPrefsProvider';
import { dowLabels } from '@/utils/date';
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
/** ± months around the mount focus — enough for swipe/arrow without rebuild. */
const MONTH_RADIUS = 36;
const IS_WEB = Platform.OS === 'web';

type MonthPage = {
  key: string;
  year: number;
  monthIndex: number;
};

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

function monthKey(year: number, monthIndex: number) {
  return `${year}-${monthIndex}`;
}

function monthsBetween(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number,
) {
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function buildMonthPages(originYear: number, originMonth: number): MonthPage[] {
  const pages: MonthPage[] = [];
  for (let delta = -MONTH_RADIUS; delta <= MONTH_RADIUS; delta += 1) {
    const next = shiftMonth(originYear, originMonth, delta);
    pages.push({
      key: monthKey(next.year, next.monthIndex),
      year: next.year,
      monthIndex: next.monthIndex,
    });
  }
  return pages;
}

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
  const styles = useMonthStyles();
  const { weekStartsOn } = useCalendarPrefs();
  const weekdayLabels = useMemo(
    () => dowLabels(weekStartsOn),
    [weekStartsOn],
  );
  const { width: windowWidth } = useWindowDimensions();
  // Slightly wider than prior (margin 20 vs 32) so the grid reads larger.
  const frameWidth = Math.min(windowWidth - 20, spacing.frameWidth + 8);

  // Web: single-month grid (arrows only). FlatList month pager remounts/snaps
  // to a wrong 31-day page on RN-web while the title stays on the focus month.
  if (IS_WEB) {
    return (
      <WebMonthCalendar
        year={year}
        monthIndex={monthIndex}
        todayKey={todayKey}
        focusKey={focusKey}
        progressForDay={progressForDay}
        onSelectDay={onSelectDay}
        onMonthChange={onMonthChange}
        frameWidth={frameWidth}
        weekdayLabels={weekdayLabels}
        weekStartsOn={weekStartsOn}
        primary={theme.primary}
        styles={styles}
      />
    );
  }

  return (
    <NativeMonthPager
      year={year}
      monthIndex={monthIndex}
      todayKey={todayKey}
      focusKey={focusKey}
      progressForDay={progressForDay}
      onSelectDay={onSelectDay}
      onMonthChange={onMonthChange}
      frameWidth={frameWidth}
      weekdayLabels={weekdayLabels}
      weekStartsOn={weekStartsOn}
      primary={theme.primary}
      styles={styles}
    />
  );
}

type SharedMonthProps = {
  year: number;
  monthIndex: number;
  todayKey: string;
  focusKey?: string;
  progressForDay: (dateKey: string) => DayProgress;
  onSelectDay: (dateKey: string) => void;
  onMonthChange: (year: number, monthIndex: number) => void;
  frameWidth: number;
  weekdayLabels: readonly string[];
  weekStartsOn: 0 | 1;
  primary: string;
  styles: ReturnType<typeof createMonthStyles>;
};

function MonthHeader({
  year,
  monthIndex,
  onPrev,
  onNext,
  styles,
}: {
  year: number;
  monthIndex: number;
  onPrev: () => void;
  onNext: () => void;
  styles: ReturnType<typeof createMonthStyles>;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 달"
        onPress={onPrev}
        hitSlop={12}
        style={styles.navBtn}>
        <View style={styles.navArrowPrev}>
          <ArrowRightIcon size={NAV_ARROW} />
        </View>
      </Pressable>
      <Text style={styles.title}>{monthTitle(year, monthIndex)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        onPress={onNext}
        hitSlop={12}
        style={styles.navBtn}>
        <ArrowRightIcon size={NAV_ARROW} />
      </Pressable>
    </View>
  );
}

function WebMonthCalendar({
  year,
  monthIndex,
  todayKey,
  focusKey,
  progressForDay,
  onSelectDay,
  onMonthChange,
  frameWidth,
  weekdayLabels,
  weekStartsOn,
  primary,
  styles,
}: SharedMonthProps) {
  const cellWidth = frameWidth / 7;
  const cells = useMemo(
    () => buildMonthGrid(year, monthIndex, weekStartsOn),
    [year, monthIndex, weekStartsOn],
  );

  const goPrev = () => {
    const next = shiftMonth(year, monthIndex, -1);
    haptics.monthChange();
    onMonthChange(next.year, next.monthIndex);
  };
  const goNext = () => {
    const next = shiftMonth(year, monthIndex, 1);
    haptics.monthChange();
    onMonthChange(next.year, next.monthIndex);
  };

  return (
    <View style={[styles.root, { width: frameWidth }]}>
      <MonthHeader
        year={year}
        monthIndex={monthIndex}
        onPrev={goPrev}
        onNext={goNext}
        styles={styles}
      />

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label, index) => (
          <View
            key={`${weekStartsOn}-${index}-${label}`}
            style={[styles.weekdayCell, { width: cellWidth }]}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.monthPage, { width: frameWidth }]}>
        <View style={styles.grid}>
          {cells.map((cell) => (
            <DayCell
              key={cell.dateKey}
              cell={cell}
              width={cellWidth}
              todayKey={todayKey}
              focusKey={focusKey}
              progress={
                cell.inMonth
                  ? progressForDay(cell.dateKey)
                  : emptyDayProgress()
              }
              primary={primary}
              onPress={onSelectDay}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function NativeMonthPager({
  year,
  monthIndex,
  todayKey,
  focusKey,
  progressForDay,
  onSelectDay,
  onMonthChange,
  frameWidth,
  weekdayLabels,
  weekStartsOn,
  primary,
  styles,
}: SharedMonthProps) {
  const originRef = useRef({ year, monthIndex });
  const pages = useMemo(
    () => buildMonthPages(originRef.current.year, originRef.current.monthIndex),
    [],
  );
  const listRef = useRef<FlatList<MonthPage>>(null);
  const settledIndexRef = useRef(MONTH_RADIUS);
  const draggingRef = useRef(false);
  const [titlePage, setTitlePage] = useState(() => ({ year, monthIndex }));

  const indexFor = useCallback((y: number, m: number) => {
    const delta = monthsBetween(
      originRef.current.year,
      originRef.current.monthIndex,
      y,
      m,
    );
    return MONTH_RADIUS + delta;
  }, []);

  // Parent-controlled month (arrows / external) → page with day-strip feel.
  useEffect(() => {
    const nextIndex = indexFor(year, monthIndex);
    if (nextIndex < 0 || nextIndex >= pages.length) return;
    setTitlePage({ year, monthIndex });
    if (settledIndexRef.current === nextIndex) return;
    settledIndexRef.current = nextIndex;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  }, [year, monthIndex, indexFor, pages.length]);

  const goPrev = () => {
    const next = shiftMonth(year, monthIndex, -1);
    const idx = indexFor(next.year, next.monthIndex);
    if (idx < 0 || idx >= pages.length) return;
    haptics.monthChange();
    onMonthChange(next.year, next.monthIndex);
  };
  const goNext = () => {
    const next = shiftMonth(year, monthIndex, 1);
    const idx = indexFor(next.year, next.monthIndex);
    if (idx < 0 || idx >= pages.length) return;
    haptics.monthChange();
    onMonthChange(next.year, next.monthIndex);
  };

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      if (frameWidth <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / frameWidth);
      const clamped = Math.max(0, Math.min(pages.length - 1, next));
      if (!wasDragging) {
        settledIndexRef.current = indexFor(year, monthIndex);
        return;
      }
      settledIndexRef.current = clamped;
      const page = pages[clamped];
      if (!page) return;
      setTitlePage({ year: page.year, monthIndex: page.monthIndex });
      if (page.year !== year || page.monthIndex !== monthIndex) {
        haptics.monthChange();
        onMonthChange(page.year, page.monthIndex);
      }
    },
    [frameWidth, indexFor, monthIndex, onMonthChange, pages, year],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<MonthPage> | null | undefined, index: number) => ({
      length: frameWidth,
      offset: frameWidth * index,
      index,
    }),
    [frameWidth],
  );

  const cellWidth = frameWidth / 7;

  const renderMonth = useCallback(
    ({ item }: { item: MonthPage }) => {
      const cells = buildMonthGrid(item.year, item.monthIndex, weekStartsOn);
      return (
        <View style={[styles.monthPage, { width: frameWidth }]}>
          <View style={styles.grid}>
            {cells.map((cell) => (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                width={cellWidth}
                todayKey={todayKey}
                focusKey={focusKey}
                progress={
                  cell.inMonth
                    ? progressForDay(cell.dateKey)
                    : emptyDayProgress()
                }
                primary={primary}
                onPress={onSelectDay}
              />
            ))}
          </View>
        </View>
      );
    },
    [
      cellWidth,
      focusKey,
      frameWidth,
      onSelectDay,
      primary,
      progressForDay,
      styles.grid,
      styles.monthPage,
      todayKey,
      weekStartsOn,
    ],
  );

  return (
    <View style={[styles.root, { width: frameWidth }]}>
      <MonthHeader
        year={titlePage.year}
        monthIndex={titlePage.monthIndex}
        onPrev={goPrev}
        onNext={goNext}
        styles={styles}
      />

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label, index) => (
          <View
            key={`${weekStartsOn}-${index}-${label}`}
            style={[styles.weekdayCell, { width: cellWidth }]}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate={PAGER_DECELERATION}
        disableIntervalMomentum
        keyExtractor={(item) => item.key}
        extraData={weekStartsOn}
        renderItem={renderMonth}
        getItemLayout={getItemLayout}
        initialScrollIndex={MONTH_RADIUS}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={({ index }) => {
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index, animated: false });
          });
        }}
        style={{ width: frameWidth }}
        // Same paging language as home day / week strips.
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        removeClippedSubviews
      />
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
  const theme = useThemeColors();
  const styles = useMonthStyles();
  const isToday = cell.dateKey === todayKey;
  const isFocus = focusKey != null && cell.dateKey === focusKey;
  const dotColor = cell.inMonth
    ? progressDotColor(primary, progress, theme.softMixTarget)
    : null;
  const selectedBg = softFromPrimary(primary, 0.88, theme.softMixTarget);

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
          isFocus && cell.inMonth ? { backgroundColor: selectedBg } : null,
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

function useMonthStyles() {
  const c = useThemeColors();
  return useMemo(() => createMonthStyles(c), [c]);
}

function createMonthStyles(c: ThemeColors) {
  return StyleSheet.create({
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
    color: c.body,
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
    color: c.mutedLight,
    textAlign: 'center',
  },
  monthPage: {
    alignItems: 'center',
    // Hold 6-week height so 5-week months don’t shrink the pager mid-swipe.
    minHeight: 62 * 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
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
    color: c.accentText,
    textAlign: 'center',
  },
  dayNumOutside: {
    color: c.mutedLight,
    opacity: 0.45,
  },
  dayNumFocus: {
    fontFamily: fonts.gothamBold,
    color: c.body,
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
}
