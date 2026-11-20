import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  SubjectAddResult,
  SubjectOption,
} from '@/components/home/AddStudyForm';
import { ReviewDetailContent } from '@/components/home/ReviewDetailContent';
import {
  REVIEW_COMPLETE_TOASTS,
  ReviewCompleteToast,
} from '@/components/home/ReviewCompleteToast';
import { SettingsSheet } from '@/components/home/SettingsSheet';
import { StudyDaySummary } from '@/components/home/StudyDaySummary';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  EllipseIcon,
  SettingsIcon,
} from '@/components/icons/HomeIcons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import {
  flattenWeeks,
  intervalLabel,
  weekIndexForDate,
  type HomeReviewCard,
  type HomeReviewStudy,
  type HomeScreenData,
  type HomeWeekDay,
} from '@/constants/home-mock';
import { fonts } from '@/constants/fonts';
import {
  JUMP_ANIMATE_MAX_DELTA,
  PAGER_DECELERATION,
  durations,
  springs,
} from '@/constants/motion';
import {
  REVIEW_INTERVAL_DAYS,
  type ReviewIntervalDay,
} from '@/constants/review';
import {
  colors,
  radii,
  sizes,
  spacing,
  subjectColor,
} from '@/constants/tokens';
import {
  addSubject,
  EMPTY_APP_DATA,
  loadAppData,
  removeSubject,
  reorderSubjects,
  saveAppData,
  subjectColorMap,
  toggleReviewCheck,
  toggleReviewCompleted,
  withSubjectColor,
} from '@/storage/app-data';
import { subscribeICloudMerged } from '@/storage/icloud-sync';
import {
  buildDefaultAppData,
  buildScreenshotAppData,
} from '@/storage/screenshot-seed';
import { syncTodayReviewWidgetSnapshot } from '@/storage/today-review-widget';
import { useCalendarPrefs } from '@/theme/CalendarPrefsProvider';
import {
  useColorScheme,
  useThemeColors,
  type ThemeColors,
} from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { activeSubjects } from '@/utils/icloud-merge';
import { parseKey, todayKey as deviceTodayKey } from '@/utils/date';
import {
  homeScreenDataFromAppData,
  WEEKS_BEFORE,
} from '@/utils/home-from-app-data';
import { haptics } from '@/utils/haptics';

const REVIEW_COLS = 3;

function useHomeStyles() {
  const c = useThemeColors();
  return useMemo(() => createHomeStyles(c), [c]);
}

type HomeScreenProps = {
  /** Override data (skips AsyncStorage load — tests / previews). */
  data?: HomeScreenData;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Soft ease-out (300–450ms); interruptible via cancelAnimation. */
const DATE_SHIFT = {
  duration: durations.dateShift,
  easing: Easing.out(Easing.cubic),
} as const;

const PRESS_SHIFT = {
  duration: durations.press,
  easing: Easing.out(Easing.cubic),
} as const;

const FILL_SHIFT = {
  duration: durations.fill,
  easing: Easing.out(Easing.cubic),
} as const;

const ROW_EASE = Easing.out(Easing.cubic);
const ROW_ENTER = FadeIn.duration(durations.listRow).easing(ROW_EASE);
const ROW_EXIT = FadeOut.duration(durations.listRow).easing(ROW_EASE);
const ROW_LAYOUT = LinearTransition.duration(durations.listRow).easing(
  ROW_EASE,
);

const DAY_NUMBER_TRAVEL = 86;
const DATE_META_TRAVEL = 10;
const DATE_LABEL_TRAVEL = DATE_META_TRAVEL * 0.6;
/** Chewy date-header spring — day number, weekday, month/day. */
const DATE_HEADER_SPRING = springs.dateHeader;

/**
 * Big day number — clipped vertical slide as one unit.
 * Forward: outgoing up / incoming from below; reverse for previous dates.
 * Live Y + spring keep rapid changes continuous with a chewy settle.
 */
function AnimatedDayNumber({
  dateKey,
  dayNumber,
}: {
  dateKey: string;
  dayNumber: string;
}) {
  const styles = useHomeStyles();
  const [incoming, setIncoming] = useState(dayNumber);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const dateKeyRef = useRef(dateKey);
  const incomingRef = useRef(dayNumber);
  const outY = useSharedValue(0);
  const inY = useSharedValue(0);

  const clearOutgoing = useCallback(() => {
    setOutgoing(null);
  }, []);

  useEffect(() => {
    if (dateKey === dateKeyRef.current) {
      incomingRef.current = dayNumber;
      setIncoming(dayNumber);
      return;
    }
    const dir = dateKey > dateKeyRef.current ? 1 : -1;
    dateKeyRef.current = dateKey;

    cancelAnimation(outY);
    cancelAnimation(inY);

    // Preserve mid-flight Y so rapid taps continue as one slide.
    outY.value = inY.value;
    setOutgoing(incomingRef.current);
    incomingRef.current = dayNumber;
    setIncoming(dayNumber);
    inY.value = dir * DAY_NUMBER_TRAVEL;

    outY.value = withSpring(
      -dir * DAY_NUMBER_TRAVEL,
      DATE_HEADER_SPRING,
      (finished) => {
        if (finished) runOnJS(clearOutgoing)();
      },
    );
    inY.value = withSpring(0, DATE_HEADER_SPRING);
  }, [clearOutgoing, dateKey, dayNumber, inY, outY]);

  const outgoingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: outY.value }],
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inY.value }],
  }));

  return (
    <View style={styles.dayNumberSlot}>
      {outgoing != null ? (
        <Animated.Text
          pointerEvents="none"
          style={[styles.dayNumber, styles.dayNumberOutgoing, outgoingStyle]}
          numberOfLines={1}>
          {outgoing}
        </Animated.Text>
      ) : null}
      <Animated.Text style={[styles.dayNumber, incomingStyle]} numberOfLines={1}>
        {incoming}
      </Animated.Text>
    </View>
  );
}

/** Weekday + month/day — same chewy spring language as the day number. */
function AnimatedDateMeta({
  dateKey,
  weekdayLabel,
  dateLabel,
}: {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
}) {
  const styles = useHomeStyles();
  const [incomingWeekday, setIncomingWeekday] = useState(weekdayLabel);
  const [outgoingWeekday, setOutgoingWeekday] = useState<string | null>(null);
  const [incomingLabel, setIncomingLabel] = useState(dateLabel);
  const [outgoingLabel, setOutgoingLabel] = useState<string | null>(null);
  const dateKeyRef = useRef(dateKey);
  const weekdayRef = useRef(weekdayLabel);
  const labelRef = useRef(dateLabel);
  const weekdayOutY = useSharedValue(0);
  const weekdayInY = useSharedValue(0);
  const weekdayOutOpacity = useSharedValue(1);
  const weekdayInOpacity = useSharedValue(1);
  const labelOutY = useSharedValue(0);
  const labelInY = useSharedValue(0);
  const labelOutOpacity = useSharedValue(1);
  const labelInOpacity = useSharedValue(1);

  const clearOutgoing = useCallback(() => {
    setOutgoingWeekday(null);
    setOutgoingLabel(null);
  }, []);

  useEffect(() => {
    if (dateKey === dateKeyRef.current) {
      weekdayRef.current = weekdayLabel;
      labelRef.current = dateLabel;
      setIncomingWeekday(weekdayLabel);
      setIncomingLabel(dateLabel);
      return;
    }
    const dir = dateKey > dateKeyRef.current ? 1 : -1;
    dateKeyRef.current = dateKey;

    cancelAnimation(weekdayOutY);
    cancelAnimation(weekdayInY);
    cancelAnimation(weekdayOutOpacity);
    cancelAnimation(weekdayInOpacity);
    cancelAnimation(labelOutY);
    cancelAnimation(labelInY);
    cancelAnimation(labelOutOpacity);
    cancelAnimation(labelInOpacity);

    weekdayOutY.value = weekdayInY.value;
    weekdayOutOpacity.value = weekdayInOpacity.value;
    labelOutY.value = labelInY.value;
    labelOutOpacity.value = labelInOpacity.value;

    setOutgoingWeekday(weekdayRef.current);
    setOutgoingLabel(labelRef.current);
    weekdayRef.current = weekdayLabel;
    labelRef.current = dateLabel;
    setIncomingWeekday(weekdayLabel);
    setIncomingLabel(dateLabel);

    weekdayInY.value = dir * DATE_META_TRAVEL;
    weekdayInOpacity.value = 0;
    labelInY.value = dir * DATE_LABEL_TRAVEL;
    labelInOpacity.value = 0;

    weekdayOutY.value = withSpring(-dir * DATE_META_TRAVEL, DATE_HEADER_SPRING);
    weekdayOutOpacity.value = withSpring(0, DATE_HEADER_SPRING);
    weekdayInY.value = withSpring(0, DATE_HEADER_SPRING);
    weekdayInOpacity.value = withSpring(1, DATE_HEADER_SPRING);

    labelOutY.value = withSpring(-dir * DATE_LABEL_TRAVEL, DATE_HEADER_SPRING);
    labelOutOpacity.value = withSpring(0, DATE_HEADER_SPRING);
    labelInY.value = withSpring(0, DATE_HEADER_SPRING, (finished) => {
      if (finished) runOnJS(clearOutgoing)();
    });
    labelInOpacity.value = withSpring(1, DATE_HEADER_SPRING);
  }, [
    clearOutgoing,
    dateKey,
    dateLabel,
    labelInOpacity,
    labelInY,
    labelOutOpacity,
    labelOutY,
    weekdayInOpacity,
    weekdayInY,
    weekdayLabel,
    weekdayOutOpacity,
    weekdayOutY,
  ]);

  const outgoingWeekdayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, weekdayOutOpacity.value)),
    transform: [{ translateY: weekdayOutY.value }],
  }));

  const incomingWeekdayStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, weekdayInOpacity.value)),
    transform: [{ translateY: weekdayInY.value }],
  }));

  const outgoingLabelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, labelOutOpacity.value)),
    transform: [{ translateY: labelOutY.value }],
  }));

  const incomingLabelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, labelInOpacity.value)),
    transform: [{ translateY: labelInY.value }],
  }));

  return (
    <View style={styles.dateMeta}>
      <View style={styles.weekdaySlot}>
        {outgoingWeekday != null ? (
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.weekday,
              styles.dateMetaOutgoing,
              outgoingWeekdayStyle,
            ]}>
            {outgoingWeekday}
          </Animated.Text>
        ) : null}
        <Animated.Text style={[styles.weekday, incomingWeekdayStyle]}>
          {incomingWeekday}
        </Animated.Text>
      </View>
      <View style={styles.dateLabelSlot}>
        {outgoingLabel != null ? (
          <Animated.Text
            pointerEvents="none"
            style={[
              styles.dateLabel,
              styles.dateMetaOutgoing,
              outgoingLabelStyle,
            ]}>
            {outgoingLabel}
          </Animated.Text>
        ) : null}
        <Animated.Text style={[styles.dateLabel, incomingLabelStyle]}>
          {incomingLabel}
        </Animated.Text>
      </View>
    </View>
  );
}

/** Soft press ease-out for FABs (no spring overshoot). */
function SoftFab({
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const styles = useHomeStyles();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        cancelAnimation(scale);
        scale.value = withTiming(0.94, PRESS_SHIFT);
      }}
      onPressOut={() => {
        cancelAnimation(scale);
        scale.value = withTiming(1, PRESS_SHIFT);
      }}
      onPress={onPress}
      style={style}>
      <Animated.View style={[styles.fabInner, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Calendar ↔ today-arrow: opacity crossfade, ease-out. */
function CalendarTodayFabIcon({ showCalendar }: { showCalendar: boolean }) {
  const calendarOpacity = useSharedValue(showCalendar ? 1 : 0);
  const arrowOpacity = useSharedValue(showCalendar ? 0 : 1);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      calendarOpacity.value = showCalendar ? 1 : 0;
      arrowOpacity.value = showCalendar ? 0 : 1;
      return;
    }
    const timing = {
      duration: durations.crossfade,
      easing: Easing.out(Easing.cubic),
    };
    cancelAnimation(calendarOpacity);
    cancelAnimation(arrowOpacity);
    calendarOpacity.value = withTiming(showCalendar ? 1 : 0, timing);
    arrowOpacity.value = withTiming(showCalendar ? 0 : 1, timing);
  }, [showCalendar, calendarOpacity, arrowOpacity]);

  const calendarStyle = useAnimatedStyle(() => ({
    opacity: calendarOpacity.value,
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: arrowOpacity.value,
  }));
  const styles = useHomeStyles();
  const theme = useThemeColors();

  return (
    <View style={styles.fabIconStack}>
      <Animated.View
        pointerEvents="none"
        style={[styles.fabIconLayer, calendarStyle]}>
        <CalendarIcon />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.fabIconLayer, styles.fabArrowPrev, arrowStyle]}>
        <ArrowRightIcon size={sizes.fabIcon} color={theme.accentText} />
      </Animated.View>
    </View>
  );
}

export default function HomeScreen({ data: dataProp }: HomeScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const dayParam = firstParam(params.day);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useThemeColors();
  const colorScheme = useColorScheme();
  const styles = useHomeStyles();
  const { weekStartsOn } = useCalendarPrefs();

  const [hydrated, setHydrated] = useState(dataProp != null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const appDataRef = useRef<AppData | null>(null);
  appDataRef.current = appData;
  /** When set, week strip is recentered on this date (calendar jump). */
  const [weekAnchorKey, setWeekAnchorKey] = useState<string | null>(null);
  const appliedDayRef = useRef<string | null>(null);
  /** Bumps on foreground so local “today” recomputes after midnight / TZ. */
  const [clockNonce, setClockNonce] = useState(0);

  const [selectedKey, setSelectedKey] = useState(deviceTodayKey);
  const [weekIndex, setWeekIndex] = useState(WEEKS_BEFORE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<{
    intervalDays: number;
    studies: HomeReviewStudy[];
  } | null>(null);
  /** Jump home week strip to this 학습일 after the review sheet finishes closing. */
  const pendingReviewDateRef = useRef<string | null>(null);
  /** Round-robin index for review-complete toast copies. */
  const toastIndexRef = useRef(0);
  const [completeToast, setCompleteToast] = useState<{
    token: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (dataProp) return;
    let cancelled = false;
    (async () => {
      const storedApp = await loadAppData();
      if (cancelled) return;
      setAppData(storedApp);
      setWeekAnchorKey(null);
      const screen = homeScreenDataFromAppData(storedApp, new Date(), {
        weekStartsOn,
      });
      setSelectedKey(screen.todayKey);
      setWeekIndex(screen.currentWeekIndex);
      setHydrated(true);
      // 포개 widget: seed snapshot after first load.
      void syncTodayReviewWidgetSnapshot(storedApp);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataProp, weekStartsOn]);

  // Apply iCloud remote merges into home state + widget (no sync status UI).
  useEffect(() => {
    if (dataProp) return;
    return subscribeICloudMerged((merged) => {
      setAppData(merged);
      void syncTodayReviewWidgetSnapshot(merged);
    });
  }, [dataProp]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      setClockNonce((n) => n + 1);
      // 포개 widget: rewrite on foreground (covers todayKey rollover).
      if (!dataProp && appData) {
        void syncTodayReviewWidgetSnapshot(appData);
      }
    });
    return () => sub.remove();
  }, [dataProp, appData]);

  // Reload after /day (or calendar) edits — home stays mounted so local
  // appData would otherwise stay stale while AsyncStorage already moved on.
  useFocusEffect(
    useCallback(() => {
      if (dataProp) return;
      let cancelled = false;
      void (async () => {
        const stored = await loadAppData();
        if (cancelled) return;
        setAppData(stored);
        void syncTodayReviewWidgetSnapshot(stored);
      })();
      return () => {
        cancelled = true;
      };
    }, [dataProp]),
  );

  const base: HomeScreenData = useMemo(() => {
    if (dataProp) return dataProp;
    return homeScreenDataFromAppData(
      appData ?? EMPTY_APP_DATA,
      new Date(),
      {
        weekStartsOn,
        ...(weekAnchorKey ? { weekAnchor: parseKey(weekAnchorKey) } : {}),
      },
    );
    // clockNonce: recompute local todayKey on foreground
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataProp, appData, weekAnchorKey, weekStartsOn, clockNonce]);

  const todayKey = base.todayKey;
  const allDays = useMemo(() => flattenWeeks(base.weeks), [base.weeks]);

  const selected = useMemo(() => {
    return (
      allDays.find((d) => d.dateKey === selectedKey) ??
      allDays.find((d) => d.dateKey === todayKey) ??
      allDays[0]
    );
  }, [allDays, selectedKey, todayKey]);

  const isToday = selected != null && selected.dateKey === todayKey;

  const frameWidth = Math.min(windowWidth - 16, spacing.frameWidth);
  const contentWidth = Math.min(frameWidth, spacing.contentWidth);
  const reviewCardWidth = useMemo(() => {
    const gaps = spacing.reviewGap * (REVIEW_COLS - 1);
    return (contentWidth - gaps) / REVIEW_COLS;
  }, [contentWidth]);

  const subjectOptions = useMemo((): SubjectOption[] => {
    if (!appData) return [];
    return activeSubjects(appData.subjects).map((s) => {
      const chip = withSubjectColor(s);
      return { name: chip.name, color: chip.color ?? subjectColor(chip.name) };
    });
  }, [appData]);

  /** Include soft-deleted chips so study rows keep their color after remove. */
  const colorByName = useMemo(
    () => (appData ? subjectColorMap(appData.subjects) : {}),
    [appData],
  );

  const persistApp = useCallback(async (next: AppData) => {
    setAppData(next);
    await saveAppData(next);
    // 포개 widget: review toggle · study add/delete/edit · subject changes.
    await syncTodayReviewWidgetSnapshot(next);
  }, []);

  const selectedDateKey = selected?.dateKey ?? todayKey;

  const hideCompleteToast = useCallback(() => {
    setCompleteToast(null);
  }, []);

  const showCompleteToast = useCallback(() => {
    const message =
      REVIEW_COMPLETE_TOASTS[
        toastIndexRef.current % REVIEW_COMPLETE_TOASTS.length
      ];
    toastIndexRef.current += 1;
    setCompleteToast((prev) => ({
      token: (prev?.token ?? 0) + 1,
      message,
    }));
  }, []);

  const toggleReview = useCallback(
    (dateKey: string, card: HomeReviewCard) => {
      if (card.completed) {
        haptics.checkOff();
      } else {
        haptics.checkOn();
        showCompleteToast();
      }
      if (dataProp || !appData) return;
      let next = appData;
      if (card.checkTargets && card.checkTargets.length > 0) {
        for (const target of card.checkTargets) {
          next = toggleReviewCheck(
            next,
            target.studyId,
            target.intervalDays,
          );
        }
      } else {
        for (const id of card.scheduleIds) {
          next = toggleReviewCompleted(next, id);
        }
      }
      void persistApp(next);
    },
    [dataProp, appData, persistApp, showCompleteToast],
  );

  const goOpenDay = useCallback(
    (dateKey: string) => {
      haptics.select();
      router.push({ pathname: '/day', params: { date: dateKey } });
    },
    [router],
  );

  const goCalendar = useCallback(() => {
    haptics.calendarOpen();
    router.push({
      pathname: '/calendar',
      params: { focus: selectedDateKey },
    });
  }, [router, selectedDateKey]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const onAddSubject = useCallback(
    (rawName: string, color: string): SubjectAddResult => {
      if (dataProp) return { ok: false, reason: 'empty' };
      const current = appDataRef.current;
      if (!current) return { ok: false, reason: 'empty' };
      const result = addSubject(current, rawName, color);
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === 'missing' ? 'empty' : result.reason,
        };
      }
      void persistApp(result.data);
      return { ok: true };
    },
    [dataProp, persistApp],
  );

  const onRemoveSubject = useCallback(
    (name: string) => {
      if (dataProp) return;
      const current = appDataRef.current;
      if (!current) return;
      const result = removeSubject(current, name);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [dataProp, persistApp],
  );

  const onReorderSubjects = useCallback(
    (orderedNames: string[]) => {
      if (dataProp) return;
      const current = appDataRef.current;
      if (!current) return;
      const result = reorderSubjects(current, orderedNames);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [dataProp, persistApp],
  );

  const applySeededAppData = useCallback(
    async (next: AppData) => {
      await persistApp(next);
      setWeekAnchorKey(null);
      const screen = homeScreenDataFromAppData(next, new Date(), {
        weekStartsOn,
      });
      setSelectedKey(screen.todayKey);
      setWeekIndex(screen.currentWeekIndex);
      setReviewOpen(null);
      closeSettings();
    },
    [closeSettings, persistApp, weekStartsOn],
  );

  // Keep the selected day in view when week-start preference changes.
  useEffect(() => {
    if (dataProp) return;
    setWeekIndex(weekIndexForDate(base, selectedKey));
  }, [weekStartsOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScreenshotSeed = useCallback(async () => {
    if (!__DEV__ || dataProp) return;
    await applySeededAppData(buildScreenshotAppData());
  }, [applySeededAppData, dataProp]);

  const handleScreenshotReset = useCallback(async () => {
    if (!__DEV__ || dataProp) return;
    await applySeededAppData(buildDefaultAppData());
  }, [applySeededAppData, dataProp]);

  const onDetail = useCallback(
    (card: HomeReviewCard) => {
      setReviewOpen({
        intervalDays: card.intervalDays,
        studies: card.studies,
      });
    },
    [],
  );

  const closeReview = useCallback(() => {
    pendingReviewDateRef.current = null;
    setReviewOpen(null);
  }, []);

  const selectDay = useCallback(
    (dateKey: string) => {
      haptics.select();
      setSelectedKey(dateKey);
      setWeekIndex(weekIndexForDate(base, dateKey));
    },
    [base],
  );

  const selectDayFromCalendar = useCallback(
    (dateKey: string) => {
      const contained = flattenWeeks(base.weeks).some(
        (d) => d.dateKey === dateKey,
      );
      if (contained) {
        setSelectedKey(dateKey);
        setWeekIndex(weekIndexForDate(base, dateKey));
        return;
      }
      setWeekAnchorKey(dateKey);
      setSelectedKey(dateKey);
      setWeekIndex(WEEKS_BEFORE);
    },
    [base],
  );

  const onReviewStudyPress = useCallback((studiedOn: string) => {
    const dateKey = studiedOn.trim();
    if (!dateKey) return;
    pendingReviewDateRef.current = dateKey;
    setReviewOpen(null);
  }, []);

  const onReviewDismissed = useCallback(() => {
    const dateKey = pendingReviewDateRef.current;
    pendingReviewDateRef.current = null;
    if (!dateKey) return;
    haptics.select();
    selectDayFromCalendar(dateKey);
  }, [selectDayFromCalendar]);

  const goToday = useCallback(() => {
    haptics.todayJump();
    selectDayFromCalendar(todayKey);
  }, [selectDayFromCalendar, todayKey]);

  useEffect(() => {
    if (!hydrated) return;
    if (!dayParam || !isDateKey(dayParam)) {
      appliedDayRef.current = null;
      return;
    }
    if (appliedDayRef.current === dayParam) return;
    appliedDayRef.current = dayParam;
    selectDayFromCalendar(dayParam);
    router.setParams({ day: undefined });
  }, [hydrated, dayParam, selectDayFromCalendar, router]);

  const onWeekChange = useCallback(
    (nextIndex: number, weekdayIndex: number) => {
      const week = base.weeks[nextIndex];
      if (!week) return;
      const nextDay = week[weekdayIndex] ?? week[0];
      haptics.weekPage();
      setWeekIndex(nextIndex);
      setSelectedKey(nextDay.dateKey);
    },
    [base.weeks],
  );

  const onDayPagerChange = useCallback(
    (nextIndex: number) => {
      const day = allDays[nextIndex];
      if (!day) return;
      haptics.daySwipe();
      setSelectedKey(day.dateKey);
      setWeekIndex(weekIndexForDate(base, day.dateKey));
    },
    [allDays, base],
  );

  const selectedWeekdayIndex = useMemo(() => {
    const week = base.weeks[weekIndex];
    if (!week || !selected) return 0;
    const idx = week.findIndex((d) => d.dateKey === selected.dateKey);
    return idx >= 0 ? idx : 0;
  }, [base.weeks, weekIndex, selected]);

  const dayIndex = useMemo(() => {
    if (!selected) return 0;
    const idx = allDays.findIndex((d) => d.dateKey === selected.dateKey);
    return idx >= 0 ? idx : 0;
  }, [allDays, selected]);

  const fabInsetX = Math.max(16, (windowWidth - contentWidth) / 2);
  const fabBottom = 24 + insets.bottom;

  if (!hydrated || !selected) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, 8) + 12 },
        ]}>
        <View style={[styles.frame, { maxWidth: frameWidth }]}>
          <View style={styles.topBlock}>
            <View style={styles.headerRow}>
              <View style={styles.dayRow}>
                <AnimatedDayNumber
                  dateKey={selected.dateKey}
                  dayNumber={selected.dayNumber}
                />
                {isToday ? <EllipseIcon /> : null}
              </View>
              <AnimatedDateMeta
                dateKey={selected.dateKey}
                weekdayLabel={selected.weekdayLabel}
                dateLabel={selected.dateLabel}
              />
            </View>

            <WeekStripPager
              key={`${base.todayKey}:${weekAnchorKey ?? 'home'}:${base.weeks[0]?.[0]?.dateKey ?? ''}`}
              weeks={base.weeks}
              weekIndex={weekIndex}
              selectedKey={selected.dateKey}
              weekdayIndex={selectedWeekdayIndex}
              width={frameWidth}
              accentColor={theme.primary}
              onSelectDay={selectDay}
              onWeekChange={onWeekChange}
            />
          </View>

          <DayContentPager
            days={allDays}
            dayIndex={dayIndex}
            width={frameWidth}
            contentWidth={contentWidth}
            reviewCardWidth={reviewCardWidth}
            todayKey={todayKey}
            accent={theme.primary}
            accentSoft={theme.primarySoft}
            colorByName={colorByName}
            onDayChange={onDayPagerChange}
            onOpenDay={goOpenDay}
            onToggle={toggleReview}
            onDetail={onDetail}
          />
        </View>
      </View>

      <SoftFab
        accessibilityLabel="설정"
        onPress={openSettings}
        style={[
          styles.fab,
          {
            left: fabInsetX,
            bottom: fabBottom,
          },
        ]}>
        <SettingsIcon />
      </SoftFab>

      <SoftFab
        accessibilityLabel={isToday ? '캘린더' : '오늘로 이동'}
        onPress={isToday ? goCalendar : goToday}
        style={[
          styles.fab,
          {
            right: fabInsetX,
            bottom: fabBottom,
          },
        ]}>
        <CalendarTodayFabIcon showCalendar={isToday} />
      </SoftFab>

      {completeToast ? (
        <ReviewCompleteToast
          token={completeToast.token}
          message={completeToast.message}
          bottom={fabBottom + sizes.fab + 12}
          onHidden={hideCompleteToast}
        />
      ) : null}

      <BottomSheetModal visible={settingsOpen} onClose={closeSettings}>
        <SettingsSheet
          subjects={dataProp ? undefined : subjectOptions}
          onAddSubject={dataProp ? undefined : onAddSubject}
          onRemoveSubject={dataProp ? undefined : onRemoveSubject}
          onReorderSubjects={dataProp ? undefined : onReorderSubjects}
          onScreenshotSeed={
            __DEV__ && !dataProp ? handleScreenshotSeed : undefined
          }
          onScreenshotReset={
            __DEV__ && !dataProp ? handleScreenshotReset : undefined
          }
        />
      </BottomSheetModal>

      <BottomSheetModal
        visible={reviewOpen != null}
        onClose={closeReview}
        onDismissed={onReviewDismissed}>
        {reviewOpen ? (
          <ReviewDetailContent
            studies={reviewOpen.studies}
            colorByName={colorByName}
            onStudyPress={onReviewStudyPress}
          />
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

function WeekStripPager({
  weeks,
  weekIndex,
  selectedKey,
  weekdayIndex,
  width,
  accentColor,
  onSelectDay,
  onWeekChange,
}: {
  weeks: HomeWeekDay[][];
  weekIndex: number;
  selectedKey: string;
  weekdayIndex: number;
  width: number;
  accentColor: string;
  onSelectDay: (dateKey: string) => void;
  onWeekChange: (weekIndex: number, weekdayIndex: number) => void;
}) {
  const styles = useHomeStyles();
  const listRef = useRef<FlatList<HomeWeekDay[]>>(null);
  const settledIndexRef = useRef(weekIndex);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (width <= 0) return;
    if (draggingRef.current) return;
    if (settledIndexRef.current === weekIndex) return;
    const delta = Math.abs(weekIndex - settledIndexRef.current);
    const animate = delta > 0 && delta <= JUMP_ANIMATE_MAX_DELTA;
    settledIndexRef.current = weekIndex;
    listRef.current?.scrollToIndex({ index: weekIndex, animated: animate });
  }, [weekIndex, width]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      const clamped = Math.max(0, Math.min(weeks.length - 1, next));
      settledIndexRef.current = clamped;
      if (clamped !== weekIndex) {
        onWeekChange(clamped, weekdayIndex);
      }
    },
    [onWeekChange, weekIndex, weekdayIndex, weeks.length, width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<HomeWeekDay[]> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const cellWidth = width / 7;

  const renderWeek = useCallback(
    ({ item: days }: { item: HomeWeekDay[] }) => (
      <WeekStripPage
        days={days}
        width={width}
        cellWidth={cellWidth}
        selectedKey={selectedKey}
        accentColor={accentColor}
        onSelectDay={onSelectDay}
      />
    ),
    [accentColor, cellWidth, onSelectDay, selectedKey, width],
  );

  return (
    <FlatList
      ref={listRef}
      data={weeks}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate={PAGER_DECELERATION}
      disableIntervalMomentum
      keyExtractor={(_, index) => `week-${index}`}
      renderItem={renderWeek}
      getItemLayout={getItemLayout}
      initialScrollIndex={weekIndex}
      onScrollBeginDrag={() => {
        draggingRef.current = true;
      }}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScrollToIndexFailed={({ index }) => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index, animated: false });
        });
      }}
      style={[styles.weekPager, { width }]}
      extraData={`${selectedKey}:${weekIndex}`}
    />
  );
}

/** One week row: moving selection pill + per-day text (dots stay on cells). */
function WeekStripPage({
  days,
  width,
  cellWidth,
  selectedKey,
  accentColor,
  onSelectDay,
}: {
  days: HomeWeekDay[];
  width: number;
  cellWidth: number;
  selectedKey: string;
  accentColor: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const styles = useHomeStyles();
  const selectedIndex = days.findIndex((d) => d.dateKey === selectedKey);
  const pillX = useSharedValue(
    selectedIndex >= 0 ? selectedIndex * cellWidth : 0,
  );
  const pillOpacity = useSharedValue(selectedIndex >= 0 ? 1 : 0);
  const primed = useRef(false);
  const cellWidthRef = useRef(cellWidth);

  useEffect(() => {
    const widthChanged = cellWidthRef.current !== cellWidth;
    cellWidthRef.current = cellWidth;

    if (selectedIndex < 0) {
      cancelAnimation(pillX);
      cancelAnimation(pillOpacity);
      pillOpacity.value = withTiming(0, DATE_SHIFT);
      primed.current = false;
      return;
    }

    const targetX = selectedIndex * cellWidth;
    if (!primed.current || widthChanged) {
      cancelAnimation(pillX);
      cancelAnimation(pillOpacity);
      pillX.value = targetX;
      pillOpacity.value = 1;
      primed.current = true;
      return;
    }

    cancelAnimation(pillX);
    cancelAnimation(pillOpacity);
    pillOpacity.value = 1;
    pillX.value = withTiming(targetX, DATE_SHIFT);
  }, [cellWidth, pillOpacity, pillX, selectedIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={[styles.weekPage, { width }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.weekSelectionPill,
          { width: cellWidth, height: sizes.weekCell.height },
          pillStyle,
        ]}
      />
      {days.map((d) => (
        <WeekDayCell
          key={d.dateKey}
          day={d}
          width={cellWidth}
          selected={d.dateKey === selectedKey}
          accentColor={accentColor}
          onSelectDay={onSelectDay}
        />
      ))}
    </View>
  );
}

function WeekDayCell({
  day,
  width,
  selected,
  accentColor,
  onSelectDay,
}: {
  day: HomeWeekDay;
  width: number;
  selected: boolean;
  accentColor: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const theme = useThemeColors();
  const styles = useHomeStyles();
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    cancelAnimation(selectedProgress);
    selectedProgress.value = withTiming(selected ? 1 : 0, DATE_SHIFT);
  }, [selected, selectedProgress]);

  const dayNumStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [theme.muted, theme.black],
    ),
  }));

  const dowStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [theme.mutedLight, accentColor],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${day.weekdayLabel} ${day.dateLabel}`}
      onPress={() => onSelectDay(day.dateKey)}
      style={{ width }}>
      <View style={[styles.weekCell, { width }]}>
        <Animated.Text style={[styles.weekDayNum, dayNumStyle]}>
          {day.day}
        </Animated.Text>
        <Animated.Text style={[styles.weekDow, dowStyle]}>
          {day.dow}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

function DayContentPager({
  days,
  dayIndex,
  width,
  contentWidth,
  reviewCardWidth,
  todayKey,
  accent,
  accentSoft,
  colorByName,
  onDayChange,
  onOpenDay,
  onToggle,
  onDetail,
}: {
  days: HomeWeekDay[];
  dayIndex: number;
  width: number;
  contentWidth: number;
  reviewCardWidth: number;
  todayKey: string;
  accent: string;
  accentSoft: string;
  colorByName: Record<string, string>;
  onDayChange: (dayIndex: number) => void;
  onOpenDay: (dateKey: string) => void;
  onToggle: (dateKey: string, card: HomeReviewCard) => void;
  onDetail: (card: HomeReviewCard) => void;
}) {
  const styles = useHomeStyles();
  const listRef = useRef<FlatList<HomeWeekDay>>(null);
  const settledIndexRef = useRef(dayIndex);
  const draggingRef = useRef(false);
  /** Cross-axis size so each page fills to the content bottom (empty review still swipes). */
  const [pageHeight, setPageHeight] = useState(0);

  useEffect(() => {
    if (width <= 0) return;
    if (draggingRef.current) return;
    if (settledIndexRef.current === dayIndex) return;
    const delta = Math.abs(dayIndex - settledIndexRef.current);
    // Near jumps (incl. FAB 「오늘」) animate — 슈루룩; far jumps snap.
    const animate = delta > 0 && delta <= JUMP_ANIMATE_MAX_DELTA;
    settledIndexRef.current = dayIndex;
    listRef.current?.scrollToIndex({ index: dayIndex, animated: animate });
  }, [dayIndex, width]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      draggingRef.current = false;
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      const clamped = Math.max(0, Math.min(days.length - 1, next));
      settledIndexRef.current = clamped;
      if (clamped !== dayIndex) {
        onDayChange(clamped);
      }
    },
    [dayIndex, days.length, onDayChange, width],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<HomeWeekDay> | null | undefined, index: number) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width],
  );

  const renderDay = useCallback(
    ({ item: day }: { item: HomeWeekDay }) => {
      const dayIsToday = day.dateKey === todayKey;
      return (
        <View
          style={[
            styles.dayPage,
            { width },
            pageHeight > 0 ? { height: pageHeight } : null,
          ]}>
          <View style={[styles.sections, { maxWidth: contentWidth }]}>
            <StudyDaySummary
              studies={day.studies}
              isToday={dayIsToday}
              colorByName={colorByName}
              onOpenDay={() => onOpenDay(day.dateKey)}
            />
            <ReviewSection
              reviews={day.reviews}
              cardWidth={reviewCardWidth}
              isToday={dayIsToday}
              accent={accent}
              accentSoft={accentSoft}
              colorByName={colorByName}
              onToggle={(card) => onToggle(day.dateKey, card)}
              onDetail={onDetail}
            />
          </View>
        </View>
      );
    },
    [
      accent,
      accentSoft,
      colorByName,
      contentWidth,
      onOpenDay,
      onDetail,
      onToggle,
      pageHeight,
      reviewCardWidth,
      styles,
      todayKey,
      width,
    ],
  );

  return (
    <FlatList
      ref={listRef}
      data={days}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate={PAGER_DECELERATION}
      disableIntervalMomentum
      keyExtractor={(item) => item.dateKey}
      renderItem={renderDay}
      getItemLayout={getItemLayout}
      initialScrollIndex={dayIndex}
      onScrollBeginDrag={() => {
        draggingRef.current = true;
      }}
      onMomentumScrollEnd={onMomentumScrollEnd}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.height);
        if (next > 0 && next !== pageHeight) setPageHeight(next);
      }}
      onScrollToIndexFailed={({ index }) => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index, animated: false });
        });
      }}
      style={[styles.dayPager, { width }]}
      extraData={`${pageHeight}:${days.length}`}
    />
  );
}

function ReviewSection({
  reviews,
  cardWidth,
  isToday,
  accent,
  accentSoft,
  colorByName,
  onToggle,
  onDetail,
}: {
  reviews: HomeReviewCard[];
  cardWidth: number;
  isToday: boolean;
  accent: string;
  accentSoft: string;
  colorByName: Record<string, string>;
  onToggle: (card: HomeReviewCard) => void;
  onDetail: (card: HomeReviewCard) => void;
}) {
  const styles = useHomeStyles();
  const byInterval = useMemo(() => {
    const map = new Map<ReviewIntervalDay, HomeReviewCard>();
    for (const card of reviews) {
      map.set(card.intervalDays, card);
    }
    return map;
  }, [reviews]);

  return (
    <View style={[styles.section, styles.reviewSection]}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>
          {isToday ? '오늘 할 복습' : '이 날 할 복습'}
        </Text>
      </View>
      <View style={styles.reviewGrid}>
        {REVIEW_INTERVAL_DAYS.map((days) => {
          const card = byInterval.get(days);
          if (card) {
            return (
              <ReviewCard
                key={card.id}
                card={card}
                width={cardWidth}
                accent={accent}
                accentSoft={accentSoft}
                colorByName={colorByName}
                onToggle={() => onToggle(card)}
                onDetail={() => onDetail(card)}
              />
            );
          }
          return (
            <EmptyReviewSlot key={`empty-${days}`} days={days} width={cardWidth} />
          );
        })}
      </View>
    </View>
  );
}

/** Placeholder for a due-interval with no study scheduled that day. */
function EmptyReviewSlot({
  days,
  width,
}: {
  days: ReviewIntervalDay;
  width: number;
}) {
  const styles = useHomeStyles();
  const label = intervalLabel(days);
  return (
    <View
      accessibilityLabel={`${label} 공부 기록이 없어요`}
      style={[styles.reviewCard, styles.reviewCardEmpty, { width }]}>
      <View style={styles.emptySlotCopy}>
        <Text style={[styles.intervalText, styles.emptySlotLine]}>{label}</Text>
        <Text style={styles.emptySlotLine}>공부 기록이</Text>
        <Text style={styles.emptySlotLine}>없어요</Text>
      </View>
    </View>
  );
}

/** Checkbox fill 스륵 — color ease-in, no bounce-scale. */
function ReviewCheck({
  completed,
  accent,
  onToggle,
}: {
  completed: boolean;
  accent: string;
  onToggle: () => void;
}) {
  const theme = useThemeColors();
  const styles = useHomeStyles();
  const progress = useSharedValue(completed ? 1 : 0);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      progress.value = completed ? 1 : 0;
      return;
    }
    cancelAnimation(progress);
    progress.value = withTiming(completed ? 1 : 0, FILL_SHIFT);
  }, [completed, progress]);

  const boxStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [theme.mutedLight, accent],
      ),
    }),
    [accent],
  );

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      onPress={onToggle}
      // Visual 32 → hit ~44 with 6pt slop each side.
      hitSlop={6}>
      <Animated.View style={[styles.checkbox, boxStyle]}>
        <CheckIcon />
      </Animated.View>
    </Pressable>
  );
}

function ReviewCard({
  card,
  width,
  accent,
  accentSoft,
  colorByName,
  onToggle,
  onDetail,
}: {
  card: HomeReviewCard;
  width: number;
  accent: string;
  accentSoft: string;
  colorByName: Record<string, string>;
  onToggle: () => void;
  onDetail: () => void;
}) {
  const theme = useThemeColors();
  const styles = useHomeStyles();
  const progress = useSharedValue(card.completed ? 1 : 0);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      progress.value = card.completed ? 1 : 0;
      return;
    }
    cancelAnimation(progress);
    progress.value = withTiming(card.completed ? 1 : 0, FILL_SHIFT);
  }, [card.completed, progress]);

  const cardStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        [theme.surface, accentSoft],
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ['#00000000', accent],
      ),
    }),
    [accent, accentSoft, theme.surface],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="자세히"
      onPress={onDetail}>
      <Animated.View style={[styles.reviewCard, { width }, cardStyle]}>
        <View style={styles.reviewCardInner}>
          <View style={styles.reviewTopBlock}>
            <View style={styles.reviewTop}>
              <ReviewCheck
                completed={card.completed}
                accent={accent}
                onToggle={onToggle}
              />
              <Text style={styles.intervalText} numberOfLines={1}>
                {intervalLabel(card.intervalDays)}
              </Text>
            </View>
            <View style={styles.reviewChips}>
              {card.subjectNames.map((name) => {
                const study = card.studies.find((s) => s.subjectName === name);
                return (
                  <View
                    key={name}
                    accessibilityLabel={name}
                    style={[
                      styles.reviewChip,
                      {
                        backgroundColor: subjectColor(
                          name,
                          study?.subjectColor ?? colorByName,
                        ),
                      },
                    ]}>
                    <Text style={styles.reviewChipText}>{name.charAt(0)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>자세히</Text>
            <ArrowRightIcon />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

function createHomeStyles(c: ThemeColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.mainWhite,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: spacing.frameWidth,
    gap: spacing.blockGap,
    alignItems: 'center',
    /** Nudge date block slightly below safe area. */
    paddingTop: 12,
  },
  /** Header + week: tighter than frame blockGap. */
  topBlock: {
    width: '100%',
    maxWidth: spacing.frameWidth,
    gap: spacing.headerWeekGap,
    alignItems: 'center',
    flexShrink: 0,
  },
  headerRow: {
    width: '100%',
    maxWidth: spacing.headerWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 0,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dayNumberSlot: {
    height: DAY_NUMBER_TRAVEL,
    overflow: 'hidden',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dayNumber: {
    fontFamily: fonts.gothamBold,
    fontSize: sizes.dayNumber,
    color: c.black,
    lineHeight: DAY_NUMBER_TRAVEL,
    letterSpacing: -2,
    flexShrink: 0,
    includeFontPadding: false,
  },
  dayNumberOutgoing: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dateMeta: {
    minWidth: 85,
    alignItems: 'flex-end',
    gap: 6,
  },
  weekdaySlot: {
    width: '100%',
    height: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  dateLabelSlot: {
    width: '100%',
    height: 26,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  dateMetaOutgoing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  weekday: {
    fontFamily: fonts.nexonMedium,
    fontSize: 22,
    color: c.muted,
    textAlign: 'right',
    width: '100%',
  },
  dateLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 20,
    color: c.mutedLight,
    textAlign: 'right',
    width: '100%',
  },
  weekPager: {
    maxWidth: spacing.frameWidth,
    flexGrow: 0,
  },
  weekPage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  weekSelectionPill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: radii.weekDay,
    backgroundColor: c.surface,
    zIndex: 0,
  },
  dayPager: {
    maxWidth: spacing.frameWidth,
    // Fill remaining frame so empty review / bottom whitespace still pages days.
    flex: 1,
    alignSelf: 'stretch',
  },
  dayPage: {
    alignItems: 'center',
  },
  weekCell: {
    // Width set per layout (frameWidth / 7) so narrow phones don’t overflow.
    height: sizes.weekCell.height,
    borderRadius: radii.weekDay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  weekDayNum: {
    fontFamily: fonts.gothamBold,
    fontSize: 22,
    color: c.muted,
    textAlign: 'center',
    width: 26,
  },
  weekDow: {
    fontFamily: fonts.nexonBold,
    fontSize: 12,
    color: c.mutedLight,
    textAlign: 'center',
    width: 26,
  },
  sections: {
    flex: 1,
    width: '100%',
    maxWidth: spacing.contentWidth,
    gap: spacing.sectionGap,
    marginTop: 0,
  },
  section: {
    width: '100%',
    gap: 8,
  },
  reviewSection: {
    flexGrow: 1,
    gap: 7,
  },
  sectionLabelWrap: {
    padding: spacing.labelPad,
    alignSelf: 'flex-start',
  },
  sectionLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: c.sectionLabel,
  },
  studyList: {
    width: '100%',
    paddingHorizontal: spacing.labelPad,
    gap: spacing.studyRowGap,
    minHeight: 105,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  studyChip: {
    width: sizes.studyChip.width,
    height: sizes.studyChip.height,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 4,
  },
  studyChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: c.onAccent,
    textAlign: 'center',
  },
  studyBody: {
    flex: 1,
    minWidth: 0,
    height: sizes.studyBodyHeight,
    backgroundColor: c.surface,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  studyBodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: c.body,
  },
  addStudyBtn: {
    height: sizes.addStudyHeight,
    borderRadius: radii.chip,
    // Empty / future shell fill (`c.surface` = #F2F6FA).
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  addStudyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: c.accentText,
  },
  addStudyMoreBtn: {
    height: sizes.studyBodyHeight,
    borderRadius: radii.chip,
    // Records exist — no gray shell behind the extra “+ 공부 기록 추가”.
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  addStudyMoreText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: c.accentText,
  },
  studyCapHint: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
    color: c.muted,
    paddingHorizontal: spacing.labelPad,
  },
  reviewGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.reviewGap,
  },
  reviewCard: {
    backgroundColor: c.surface,
    borderRadius: radii.reviewCard,
    paddingTop: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 120,
  },
  reviewCardEmpty: {
    // No checkbox / detail — white shell + hairline border (not gray fill).
    backgroundColor: c.white,
    borderWidth: 1,
    // One step lighter than mutedLight (#ced7e0).
    borderColor: c.hairline,
    justifyContent: 'flex-start',
  },
  reviewCardInner: {
    flex: 1,
    gap: 12,
    justifyContent: 'space-between',
  },
  emptySlotCopy: {
    gap: 2,
  },
  reviewTopBlock: {
    gap: 9,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  checkbox: {
    width: sizes.reviewCheckbox,
    height: sizes.reviewCheckbox,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOff: {
    backgroundColor: c.mutedLight,
  },
  intervalText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: c.accentText,
    letterSpacing: -0.44,
    flexShrink: 1,
  },
  emptySlotLine: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    // Noticeably lighter than filled 「N일 전」 (accentText).
    color: c.mutedLight,
    letterSpacing: -0.44,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reviewChip: {
    width: sizes.reviewChip.width,
    height: sizes.reviewChip.height,
    borderRadius: radii.reviewChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: c.onAccent,
    textAlign: 'center',
    lineHeight: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
    alignSelf: 'stretch',
    flexShrink: 0,
  },
  detailText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 10,
    color: c.muted,
    letterSpacing: -0.4,
    textAlign: 'right',
    lineHeight: 12,
    flexShrink: 0,
  },
  fab: {
    position: 'absolute',
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: radii.fab,
    backgroundColor: c.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.fabShadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: c.fabShadowOpacity,
    shadowRadius: 32,
    elevation: 4,
    zIndex: 10,
  },
  fabInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconStack: {
    width: sizes.fabIcon,
    height: sizes.fabIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIconLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabArrowPrev: {
    transform: [{ scaleX: -1 }],
  },
});
}
