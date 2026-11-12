import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

import {
  AddStudyForm,
  type AddStudyPayload,
  type SubjectAddResult,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { ReviewDetailContent } from '@/components/home/ReviewDetailContent';
import {
  REVIEW_COMPLETE_TOASTS,
  ReviewCompleteToast,
} from '@/components/home/ReviewCompleteToast';
import { SettingsSheet } from '@/components/home/SettingsSheet';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  EllipseIcon,
  PlusIcon,
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
  type HomeStudyRow,
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
  appendStudyWithReviews,
  deleteStudyWithReviews,
  EMPTY_APP_DATA,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  MAX_SUBJECTS,
  removeSubject,
  reorderSubjects,
  saveAppData,
  subjectColorMap,
  toggleReviewCompleted,
  updateStudyWithReviews,
  withSubjectColor,
} from '@/storage/app-data';
import {
  buildDefaultAppData,
  buildScreenshotAppData,
} from '@/storage/screenshot-seed';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { parseKey, todayKey as deviceTodayKey } from '@/utils/date';
import {
  homeScreenDataFromAppData,
  WEEKS_BEFORE,
} from '@/utils/home-from-app-data';
import { haptics } from '@/utils/haptics';

const REVIEW_COLS = 3;

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
/** Fixed column width so tens stay visually locked while ones flip. */
const DAY_DIGIT_WIDTH = 44;
/** Chewy digit reel — soft overshoot settle (09→08: only ones rolls). */
const DIGIT_REEL_SPRING = springs.digitReel;

/**
 * One digit column — slides only when this glyph changes.
 * Forward: outgoing up / incoming from below; reverse for previous dates.
 * Live Y values keep rapid day changes continuous.
 */
function AnimatedDigit({
  digit,
  dateKey,
}: {
  digit: string;
  dateKey: string;
}) {
  const [incoming, setIncoming] = useState(digit);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const dateKeyRef = useRef(dateKey);
  const digitRef = useRef(digit);
  const outY = useSharedValue(0);
  const inY = useSharedValue(0);

  const clearOutgoing = useCallback(() => {
    setOutgoing(null);
  }, []);

  useEffect(() => {
    if (dateKey === dateKeyRef.current) {
      digitRef.current = digit;
      setIncoming(digit);
      return;
    }
    const dir = dateKey > dateKeyRef.current ? 1 : -1;
    dateKeyRef.current = dateKey;

    // Unchanged digit stays put (tens on 09→08).
    if (digit === digitRef.current) {
      return;
    }

    cancelAnimation(outY);
    cancelAnimation(inY);

    // Preserve mid-flight Y so rapid taps continue as one reel.
    outY.value = inY.value;
    setOutgoing(digitRef.current);
    digitRef.current = digit;
    setIncoming(digit);
    inY.value = dir * DAY_NUMBER_TRAVEL;

    outY.value = withSpring(
      -dir * DAY_NUMBER_TRAVEL,
      DIGIT_REEL_SPRING,
      (finished) => {
        if (finished) runOnJS(clearOutgoing)();
      },
    );
    inY.value = withSpring(0, DIGIT_REEL_SPRING);
  }, [clearOutgoing, dateKey, digit, inY, outY]);

  const outgoingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: outY.value }],
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: inY.value }],
  }));

  return (
    <View style={styles.dayDigitSlot}>
      {outgoing != null ? (
        <Animated.Text
          pointerEvents="none"
          style={[styles.dayNumber, styles.dayDigitOutgoing, outgoingStyle]}
          numberOfLines={1}>
          {outgoing}
        </Animated.Text>
      ) : null}
      <Animated.Text
        style={[styles.dayNumber, styles.dayDigit, incomingStyle]}
        numberOfLines={1}>
        {incoming}
      </Animated.Text>
    </View>
  );
}

/**
 * Big day number — per-digit clipped reel.
 * Tens hold when unchanged; ones flip with a chewy spring.
 */
function AnimatedDayNumber({
  dateKey,
  dayNumber,
}: {
  dateKey: string;
  dayNumber: string;
}) {
  const digits = useMemo(() => {
    const padded = dayNumber.padStart(2, '0').slice(-2);
    return [padded[0]!, padded[1]!] as const;
  }, [dayNumber]);

  return (
    <View style={styles.dayNumberSlot}>
      <View style={styles.dayNumberDigits}>
        <AnimatedDigit digit={digits[0]} dateKey={dateKey} />
        <AnimatedDigit digit={digits[1]} dateKey={dateKey} />
      </View>
    </View>
  );
}

/** Weekday + month/day — same direction/timing as the day number. */
function AnimatedDateMeta({
  dateKey,
  weekdayLabel,
  dateLabel,
}: {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
}) {
  const [incomingWeekday, setIncomingWeekday] = useState(weekdayLabel);
  const [outgoingWeekday, setOutgoingWeekday] = useState<string | null>(null);
  const [incomingLabel, setIncomingLabel] = useState(dateLabel);
  const [outgoingLabel, setOutgoingLabel] = useState<string | null>(null);
  const dateKeyRef = useRef(dateKey);
  const weekdayRef = useRef(weekdayLabel);
  const labelRef = useRef(dateLabel);
  const progress = useSharedValue(1);
  const direction = useSharedValue(1);

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
    direction.value = dir;
    setOutgoingWeekday(weekdayRef.current);
    setOutgoingLabel(labelRef.current);
    weekdayRef.current = weekdayLabel;
    labelRef.current = dateLabel;
    setIncomingWeekday(weekdayLabel);
    setIncomingLabel(dateLabel);
    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withTiming(1, DATE_SHIFT, (finished) => {
      if (finished) runOnJS(clearOutgoing)();
    });
  }, [
    clearOutgoing,
    dateKey,
    dateLabel,
    direction,
    progress,
    weekdayLabel,
  ]);

  const outgoingWeekdayStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateY: -direction.value * DATE_META_TRAVEL * progress.value },
    ],
  }));

  const incomingWeekdayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: direction.value * DATE_META_TRAVEL * (1 - progress.value),
      },
    ],
  }));

  const outgoingLabelStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      {
        translateY: -direction.value * (DATE_META_TRAVEL * 0.6) * progress.value,
      },
    ],
  }));

  const incomingLabelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY:
          direction.value * (DATE_META_TRAVEL * 0.6) * (1 - progress.value),
      },
    ],
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
        <ArrowRightIcon size={sizes.fabIcon} color={colors.accentText} />
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

  const [hydrated, setHydrated] = useState(dataProp != null);
  const [appData, setAppData] = useState<AppData | null>(null);
  /** When set, week strip is recentered on this date (calendar jump). */
  const [weekAnchorKey, setWeekAnchorKey] = useState<string | null>(null);
  const appliedDayRef = useRef<string | null>(null);
  /** Bumps on foreground so local “today” recomputes after midnight / TZ. */
  const [clockNonce, setClockNonce] = useState(0);

  const [selectedKey, setSelectedKey] = useState(deviceTodayKey);
  const [weekIndex, setWeekIndex] = useState(WEEKS_BEFORE);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  /** When set, the add sheet opens in edit mode for this study. */
  const [editingStudy, setEditingStudy] = useState<HomeStudyRow | null>(null);
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
      const screen = homeScreenDataFromAppData(storedApp);
      setSelectedKey(screen.todayKey);
      setWeekIndex(screen.currentWeekIndex);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataProp]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') setClockNonce((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const base: HomeScreenData = useMemo(() => {
    if (dataProp) return dataProp;
    return homeScreenDataFromAppData(
      appData ?? EMPTY_APP_DATA,
      new Date(),
      weekAnchorKey ? { weekAnchor: parseKey(weekAnchorKey) } : undefined,
    );
    // clockNonce: recompute local todayKey on foreground
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataProp, appData, weekAnchorKey, clockNonce]);

  const todayKey = base.todayKey;
  const allDays = useMemo(() => flattenWeeks(base.weeks), [base.weeks]);

  const selected = useMemo(() => {
    return (
      allDays.find((d) => d.dateKey === selectedKey) ??
      allDays.find((d) => d.dateKey === todayKey) ??
      allDays[0]
    );
  }, [allDays, selectedKey, todayKey]);

  const studies = selected?.studies ?? [];

  const isToday = selected != null && selected.dateKey === todayKey;
  const atStudyCap = studies.length >= MAX_STUDIES_PER_DAY;
  // Future days may add studies; reviews stay on dueOn only (not “오늘 할 복습”).
  const allowAdd = !atStudyCap;

  const frameWidth = Math.min(windowWidth - 16, spacing.frameWidth);
  const contentWidth = Math.min(frameWidth, spacing.contentWidth);
  const reviewCardWidth = useMemo(() => {
    const gaps = spacing.reviewGap * (REVIEW_COLS - 1);
    return (contentWidth - gaps) / REVIEW_COLS;
  }, [contentWidth]);

  const subjectOptions = useMemo((): SubjectOption[] => {
    if (!appData) return [];
    return appData.subjects.map((s) => {
      const chip = withSubjectColor(s);
      return { name: chip.name, color: chip.color ?? subjectColor(chip.name) };
    });
  }, [appData]);

  const colorByName = useMemo(
    () => subjectColorMap(subjectOptions),
    [subjectOptions],
  );

  const persistApp = useCallback(async (next: AppData) => {
    setAppData(next);
    await saveAppData(next);
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
      for (const id of card.scheduleIds) {
        next = toggleReviewCompleted(next, id);
      }
      void persistApp(next);
    },
    [dataProp, appData, persistApp, showCompleteToast],
  );

  const goAdd = useCallback(() => {
    if (atStudyCap) {
      haptics.reject();
      return;
    }
    setEditingStudy(null);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }, [atStudyCap]);

  const goEditStudy = useCallback(
    (row: HomeStudyRow) => {
      let next = row;
      if (appData) {
        const record = appData.records.find((r) => r.id === row.id);
        if (record) {
          const memo = record.memo?.trim();
          next = {
            id: record.id,
            subjectName: record.subjectName,
            content: record.content,
            ...(memo ? { memo } : {}),
            ...(record.subjectColor
              ? { subjectColor: record.subjectColor }
              : {}),
          };
        }
      }
      setEditingStudy(next);
      setAddKey((k) => k + 1);
      setAddOpen(true);
    },
    [appData],
  );

  const closeAdd = useCallback(() => {
    // Keep editingStudy until dismiss finishes so edit UI does not flip mid-close.
    setAddOpen(false);
  }, []);

  const onAddDismissed = useCallback(() => {
    setEditingStudy(null);
  }, []);

  const onSaveAdd = useCallback(
    (payload: AddStudyPayload) => {
      const content = payload.title.trim();
      const memo = payload.memo.trim();
      const studiedOn = selectedDateKey;
      if (dataProp || !appData) return;
      if (!content) {
        haptics.reject();
        return;
      }

      if (editingStudy) {
        const next = updateStudyWithReviews(appData, editingStudy.id, {
          subjectName: payload.subject,
          content,
          studiedOn,
          ...(memo ? { memo } : {}),
        });
        void persistApp(next);
        haptics.save();
        setAddOpen(false);
        return;
      }

      if (appData.subjects.length === 0) {
        haptics.reject();
        return;
      }

      if (studies.length >= MAX_STUDIES_PER_DAY) {
        haptics.reject();
        setAddOpen(false);
        return;
      }

      const next = appendStudyWithReviews(appData, {
        subjectName: payload.subject,
        content,
        studiedOn,
        ...(memo ? { memo } : {}),
      });
      void persistApp(next);
      haptics.save();
      setAddOpen(false);
    },
    [dataProp, selectedDateKey, appData, persistApp, studies.length, editingStudy],
  );

  const onDeleteStudy = useCallback(() => {
    if (!editingStudy || dataProp || !appData) return;
    void persistApp(deleteStudyWithReviews(appData, editingStudy.id));
    haptics.delete();
    setAddOpen(false);
  }, [editingStudy, dataProp, appData, persistApp]);

  const onAddSubject = useCallback(
    (rawName: string, color: string): SubjectAddResult => {
      if (dataProp || !appData) return { ok: false, reason: 'empty' };
      const result = addSubject(appData, rawName, color);
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === 'missing' ? 'empty' : result.reason,
        };
      }
      void persistApp(result.data);
      return { ok: true };
    },
    [dataProp, appData, persistApp],
  );

  const onRemoveSubject = useCallback(
    (name: string) => {
      if (dataProp || !appData) return;
      const result = removeSubject(appData, name);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [dataProp, appData, persistApp],
  );

  const onReorderSubjects = useCallback(
    (orderedNames: string[]) => {
      if (dataProp || !appData) return;
      const result = reorderSubjects(appData, orderedNames);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [dataProp, appData, persistApp],
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

  const applySeededAppData = useCallback(
    async (next: AppData) => {
      await persistApp(next);
      setWeekAnchorKey(null);
      const screen = homeScreenDataFromAppData(next);
      setSelectedKey(screen.todayKey);
      setWeekIndex(screen.currentWeekIndex);
      setReviewOpen(null);
      setAddOpen(false);
      setEditingStudy(null);
      closeSettings();
    },
    [closeSettings, persistApp],
  );

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
      <StatusBar style="dark" />
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
            onAdd={goAdd}
            onEditStudy={goEditStudy}
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

      <BottomSheetModal
        visible={addOpen}
        onClose={closeAdd}
        onDismissed={onAddDismissed}>
        <AddStudyForm
          key={addKey}
          mode={editingStudy ? 'edit' : 'create'}
          initial={
            editingStudy
              ? {
                  subject: editingStudy.subjectName,
                  title: editingStudy.content,
                  ...(editingStudy.memo ? { memo: editingStudy.memo } : {}),
                  ...(editingStudy.subjectColor
                    ? { subjectColor: editingStudy.subjectColor }
                    : {}),
                }
              : undefined
          }
          subjects={subjectOptions}
          onSave={onSaveAdd}
          onDelete={editingStudy ? onDeleteStudy : undefined}
          onAddSubject={onAddSubject}
          onRemoveSubject={onRemoveSubject}
          onReorderSubjects={onReorderSubjects}
          maxSubjects={MAX_SUBJECTS}
        />
      </BottomSheetModal>

      <BottomSheetModal visible={settingsOpen} onClose={closeSettings}>
        <SettingsSheet
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
  const selectedProgress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    cancelAnimation(selectedProgress);
    selectedProgress.value = withTiming(selected ? 1 : 0, DATE_SHIFT);
  }, [selected, selectedProgress]);

  const dayNumStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [colors.muted, colors.black],
    ),
  }));

  const dowStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      selectedProgress.value,
      [0, 1],
      [colors.mutedLight, accentColor],
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
  onAdd,
  onEditStudy,
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
  onAdd: () => void;
  onEditStudy: (row: HomeStudyRow) => void;
  onToggle: (dateKey: string, card: HomeReviewCard) => void;
  onDetail: (card: HomeReviewCard) => void;
}) {
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
      const dayAtCap = day.studies.length >= MAX_STUDIES_PER_DAY;
      return (
        <View
          style={[
            styles.dayPage,
            { width },
            pageHeight > 0 ? { height: pageHeight } : null,
          ]}>
          <View style={[styles.sections, { maxWidth: contentWidth }]}>
            <StudySection
              studies={day.studies}
              allowAdd={!dayAtCap}
              atCap={dayAtCap}
              isToday={dayIsToday}
              colorByName={colorByName}
              onAdd={onAdd}
              onEditStudy={onEditStudy}
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
      onAdd,
      onDetail,
      onEditStudy,
      onToggle,
      pageHeight,
      reviewCardWidth,
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

function StudySection({
  studies,
  allowAdd,
  atCap,
  isToday,
  colorByName,
  onAdd,
  onEditStudy,
}: {
  studies: HomeStudyRow[];
  allowAdd: boolean;
  atCap: boolean;
  isToday: boolean;
  colorByName: Record<string, string>;
  onAdd: () => void;
  onEditStudy: (row: HomeStudyRow) => void;
}) {
  const [capHint, setCapHint] = useState<string | null>(null);
  const capMessage = `하루 ${MAX_STUDIES_PER_DAY}개까지`;

  const handleAdd = () => {
    if (atCap) {
      haptics.reject();
      setCapHint(capMessage);
      return;
    }
    setCapHint(null);
    onAdd();
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>
          {isToday ? '오늘 한 공부' : '이 날 한 공부'}
        </Text>
      </View>
      <Animated.View style={styles.studyList} layout={ROW_LAYOUT}>
        {studies.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="공부 기록 추가"
            accessibilityState={{ disabled: !allowAdd }}
            onPress={handleAdd}
            style={styles.addStudyBtn}>
            {allowAdd ? (
              <>
                <PlusIcon size={16} />
                <Text style={styles.addStudyText}>공부 기록 추가</Text>
              </>
            ) : (
              <Text style={styles.addStudyText}>{capMessage}</Text>
            )}
          </Pressable>
        ) : (
          <>
            {studies.map((row) => (
              <StudyRow
                key={row.id}
                row={row}
                colorByName={colorByName}
                onPress={() => onEditStudy(row)}
              />
            ))}
            {allowAdd ? (
              <Animated.View layout={ROW_LAYOUT}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="공부 기록 추가"
                  onPress={handleAdd}
                  style={styles.addStudyMoreBtn}>
                  <PlusIcon size={16} />
                  <Text style={styles.addStudyMoreText}>공부 기록 추가</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={capMessage}
                onPress={handleAdd}
                style={styles.addStudyMoreBtn}>
                <Text style={[styles.addStudyMoreText, { opacity: 0.7 }]}>
                  {capMessage}
                </Text>
              </Pressable>
            )}
          </>
        )}
      </Animated.View>
      {capHint || atCap ? (
        <Text style={styles.studyCapHint}>{capHint ?? capMessage}</Text>
      ) : null}
    </View>
  );
}

function StudyRow({
  row,
  colorByName,
  onPress,
}: {
  row: HomeStudyRow;
  colorByName: Record<string, string>;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={ROW_ENTER}
      exiting={ROW_EXIT}
      layout={ROW_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.subjectName} ${row.content} 수정`}
        accessibilityHint="탭하거나 길게 누르면 수정 시트가 열려요"
        onPress={onPress}
        // Same edit sheet as tap. delayLongPress stays above scroll cancel so
        // week/day swipes do not open the sheet mid-gesture.
        delayLongPress={380}
        onLongPress={() => {
          haptics.sheetOpen();
          onPress();
        }}
        style={styles.studyRow}>
        <View
          style={[
            styles.studyChip,
            { backgroundColor: subjectColor(row.subjectName, colorByName) },
          ]}>
          <Text style={styles.studyChipText} numberOfLines={1} ellipsizeMode="tail">
            {row.subjectName}
          </Text>
        </View>
        <View style={styles.studyBody}>
          <Text style={styles.studyBodyText} numberOfLines={1} ellipsizeMode="tail">
            {row.content}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
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
        [colors.mutedLight, accent],
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
        [colors.surface, accentSoft],
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ['#00000000', accent],
      ),
    }),
    [accent, accentSoft],
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
              {card.subjectNames.map((name) => (
                <View
                  key={name}
                  accessibilityLabel={name}
                  style={[
                    styles.reviewChip,
                    { backgroundColor: subjectColor(name, colorByName) },
                  ]}>
                  <Text style={styles.reviewChipText}>{name.charAt(0)}</Text>
                </View>
              ))}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.mainWhite,
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
  dayNumberDigits: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayDigitSlot: {
    width: DAY_DIGIT_WIDTH,
    height: DAY_NUMBER_TRAVEL,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontFamily: fonts.gothamBold,
    fontSize: sizes.dayNumber,
    color: colors.black,
    lineHeight: DAY_NUMBER_TRAVEL,
    letterSpacing: 0,
    flexShrink: 0,
    includeFontPadding: false,
  },
  dayDigit: {
    width: '100%',
    textAlign: 'center',
  },
  dayDigitOutgoing: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    textAlign: 'center',
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
    color: colors.muted,
    textAlign: 'right',
    width: '100%',
  },
  dateLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 20,
    color: colors.mutedLight,
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
    backgroundColor: colors.surface,
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
    color: colors.muted,
    textAlign: 'center',
    width: 26,
  },
  weekDow: {
    fontFamily: fonts.nexonBold,
    fontSize: 12,
    color: colors.mutedLight,
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
    color: colors.sectionLabel,
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
    color: colors.white,
    textAlign: 'center',
  },
  studyBody: {
    flex: 1,
    minWidth: 0,
    height: sizes.studyBodyHeight,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  studyBodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.body,
  },
  addStudyBtn: {
    height: sizes.addStudyHeight,
    borderRadius: radii.chip,
    // Empty / future shell fill (`colors.surface` = #F2F6FA).
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  addStudyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.accentText,
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
    color: colors.accentText,
  },
  studyCapHint: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: spacing.labelPad,
  },
  reviewGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.reviewGap,
  },
  reviewCard: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.white,
    borderWidth: 1,
    // One step lighter than mutedLight (#ced7e0).
    borderColor: '#e4eaef',
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
    backgroundColor: colors.mutedLight,
  },
  intervalText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.accentText,
    letterSpacing: -0.44,
    flexShrink: 1,
  },
  emptySlotLine: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    // Noticeably lighter than filled 「N일 전」 (accentText).
    color: colors.mutedLight,
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
    color: colors.white,
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
    color: colors.muted,
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
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#343D4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
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
