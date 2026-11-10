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
  Easing,
  FadeIn,
  FadeInUp,
  interpolateColor,
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
  applyDummyStudy,
  buildDummyHomeData,
  cloneHomeData,
  DUMMY_SUBJECTS,
  flattenWeeks,
  HOME_DUMMY,
  intervalLabel,
  removeDummyStudy,
  toggleDummyReview,
  updateDummyStudy,
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
  SUBJECT_COLORS,
  colors,
  radii,
  sizes,
  spacing,
  subjectColor,
} from '@/constants/tokens';
import {
  addSubject,
  appendStudyWithReviews,
  DEFAULT_SUBJECTS,
  deleteStudyWithReviews,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  MAX_SUBJECT_NAME_LENGTH,
  MAX_SUBJECTS,
  normalizeSubjectName,
  removeSubject,
  reorderSubjects,
  saveAppData,
  subjectColorMap,
  toggleReviewCompleted,
  updateStudyWithReviews,
  withSubjectColor,
} from '@/storage/app-data';
import {
  DATA_MODE_LABEL,
  DATA_MODES,
  DEFAULT_DATA_MODE,
  loadDataMode,
  saveDataMode,
  type DataMode,
} from '@/storage/data-mode';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { parseKey } from '@/utils/date';
import {
  homeScreenDataFromAppData,
  WEEKS_BEFORE,
} from '@/utils/home-from-app-data';
import { haptics } from '@/utils/haptics';

const REVIEW_COLS = 3;

type HomeScreenProps = {
  /** Override data (skips mode load). */
  data?: HomeScreenData;
  /** Initial mode before AsyncStorage resolves (`?mode=`). */
  initialMode?: DataMode;
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function seedSubjectOptions(): SubjectOption[] {
  return DUMMY_SUBJECTS.map((name) => ({
    name,
    color: SUBJECT_COLORS[name] ?? subjectColor(name),
  }));
}

/** Soft→sharp date enter — short travel so opacity fade reads on device. */
const dateNumberEnter = FadeInUp.duration(durations.fadeQuick)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, translateY: 10 });

const dateMetaEnter = FadeIn.duration(durations.fadeQuick).easing(
  Easing.out(Easing.cubic),
);

/** Day number — remount + soft→sharp fade/slide on date change. */
function AnimatedDayNumber({
  dateKey,
  dayNumber,
}: {
  dateKey: string;
  dayNumber: string;
}) {
  return (
    <Animated.Text
      key={dateKey}
      entering={dateNumberEnter}
      style={styles.dayNumber}
      numberOfLines={1}>
      {dayNumber}
    </Animated.Text>
  );
}

/** Weekday remounts on change; month/day label stays static chrome. */
function AnimatedDateMeta({
  dateKey,
  weekdayLabel,
  dateLabel,
}: {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
}) {
  return (
    <View style={styles.dateMeta}>
      <Animated.Text
        key={`wd-${dateKey}`}
        entering={dateMetaEnter}
        style={styles.weekday}>
        {weekdayLabel}
      </Animated.Text>
      <Text style={styles.dateLabel}>{dateLabel}</Text>
    </View>
  );
}

/** Light press spring for FABs. */
function SpringFab({
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
        scale.value = withSpring(0.92, springs.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, springs.soft);
      }}
      onPress={onPress}
      style={style}>
      <Animated.View style={[styles.fabInner, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Calendar ↔ today-arrow: opacity crossfade, no scale. */
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
      easing: Easing.inOut(Easing.cubic),
    };
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

export default function HomeScreen({
  data: dataProp,
  initialMode = DEFAULT_DATA_MODE,
}: HomeScreenProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ day?: string }>();
  const dayParam = firstParam(params.day);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useThemeColors();

  const [mode, setMode] = useState<DataMode>(initialMode);
  const [hydrated, setHydrated] = useState(dataProp != null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dummyData, setDummyData] = useState<HomeScreenData>(() =>
    cloneHomeData(HOME_DUMMY),
  );
  /** In-session subject chips for 더미 mode (not AsyncStorage). */
  const [dummySubjects, setDummySubjects] = useState<SubjectOption[]>(() =>
    seedSubjectOptions(),
  );
  /** When set, week strip is recentered on this date (calendar jump). */
  const [weekAnchorKey, setWeekAnchorKey] = useState<string | null>(null);
  const appliedDayRef = useRef<string | null>(null);

  const [selectedKey, setSelectedKey] = useState(HOME_DUMMY.todayKey);
  const [weekIndex, setWeekIndex] = useState(HOME_DUMMY.currentWeekIndex);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  /** When set, the add sheet opens in edit mode for this study. */
  const [editingStudy, setEditingStudy] = useState<HomeStudyRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<{
    intervalDays: number;
    studies: HomeReviewStudy[];
  } | null>(null);

  useEffect(() => {
    if (dataProp) return;
    let cancelled = false;
    (async () => {
      const [storedMode, storedApp] = await Promise.all([
        loadDataMode(),
        loadAppData(),
      ]);
      if (cancelled) return;
      const nextMode =
        initialMode === 'dummy' || initialMode === 'real'
          ? initialMode
          : storedMode;
      setMode(nextMode);
      setAppData(storedApp);
      setWeekAnchorKey(null);
      if (nextMode === 'real') {
        const screen = homeScreenDataFromAppData(storedApp);
        setSelectedKey(screen.todayKey);
        setWeekIndex(screen.currentWeekIndex);
      } else {
        setDummyData(cloneHomeData(HOME_DUMMY));
        setDummySubjects(seedSubjectOptions());
        setSelectedKey(HOME_DUMMY.todayKey);
        setWeekIndex(HOME_DUMMY.currentWeekIndex);
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [dataProp, initialMode]);

  const base: HomeScreenData = useMemo(() => {
    if (dataProp) return dataProp;
    if (mode === 'dummy') return dummyData;
    if (appData) {
      return homeScreenDataFromAppData(
        appData,
        new Date(),
        weekAnchorKey
          ? { weekAnchor: parseKey(weekAnchorKey) }
          : undefined,
      );
    }
    return HOME_DUMMY;
  }, [dataProp, mode, dummyData, appData, weekAnchorKey]);

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

  const isFutureDay = selected != null && selected.dateKey > todayKey;
  const isToday = selected != null && selected.dateKey === todayKey;
  const atStudyCap = studies.length >= MAX_STUDIES_PER_DAY;
  const allowAdd = !isFutureDay && !atStudyCap;

  const frameWidth = Math.min(windowWidth - 16, spacing.frameWidth);
  const contentWidth = Math.min(frameWidth, spacing.contentWidth);
  const reviewCardWidth = useMemo(() => {
    const gaps = spacing.reviewGap * (REVIEW_COLS - 1);
    return (contentWidth - gaps) / REVIEW_COLS;
  }, [contentWidth]);

  const subjectOptions = useMemo((): SubjectOption[] => {
    if (mode === 'real' && appData) {
      return appData.subjects.map((s) => {
        const chip = withSubjectColor(s);
        return { name: chip.name, color: chip.color ?? subjectColor(chip.name) };
      });
    }
    return dummySubjects;
  }, [mode, appData, dummySubjects]);

  const colorByName = useMemo(
    () => subjectColorMap(subjectOptions),
    [subjectOptions],
  );

  const persistApp = useCallback(async (next: AppData) => {
    setAppData(next);
    await saveAppData(next);
  }, []);

  const selectedDateKey = selected?.dateKey ?? todayKey;

  const toggleReview = useCallback(
    (dateKey: string, card: HomeReviewCard) => {
      if (card.completed) haptics.checkOff();
      else haptics.checkOn();
      if (mode === 'dummy' || dataProp) {
        setDummyData((prev) => toggleDummyReview(prev, dateKey, card.id));
        return;
      }
      if (!appData) return;
      let next = appData;
      for (const id of card.scheduleIds) {
        next = toggleReviewCompleted(next, id);
      }
      void persistApp(next);
    },
    [mode, dataProp, appData, persistApp],
  );

  const goAdd = useCallback(() => {
    if (!allowAdd) return;
    setEditingStudy(null);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }, [allowAdd]);

  const goEditStudy = useCallback(
    (row: HomeStudyRow) => {
      let next = row;
      if (mode === 'real' && appData) {
        const record = appData.records.find((r) => r.id === row.id);
        if (record) {
          const memo = record.memo?.trim();
          next = {
            id: record.id,
            subjectName: record.subjectName,
            content: record.content,
            ...(memo ? { memo } : {}),
          };
        }
      }
      setEditingStudy(next);
      setAddKey((k) => k + 1);
      setAddOpen(true);
    },
    [mode, appData],
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

      if (editingStudy) {
        if (mode === 'dummy' || dataProp) {
          setDummyData((prev) =>
            updateDummyStudy(
              prev,
              editingStudy.id,
              {
                subjectName: payload.subject,
                content,
                studiedOn,
                ...(memo ? { memo } : {}),
              },
              MAX_STUDIES_PER_DAY,
            ),
          );
          haptics.save();
          setAddOpen(false);
          return;
        }
        if (!appData) return;
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

      if (studies.length >= MAX_STUDIES_PER_DAY) {
        haptics.reject();
        setAddOpen(false);
        return;
      }

      if (mode === 'dummy' || dataProp) {
        setDummyData((prev) =>
          applyDummyStudy(
            prev,
            {
              subjectName: payload.subject,
              content,
              studiedOn,
              ...(memo ? { memo } : {}),
            },
            MAX_STUDIES_PER_DAY,
          ),
        );
        haptics.save();
        setAddOpen(false);
        return;
      }

      if (!appData) return;
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
    [
      mode,
      dataProp,
      selectedDateKey,
      appData,
      persistApp,
      studies.length,
      editingStudy,
    ],
  );

  const onDeleteStudy = useCallback(() => {
    if (!editingStudy) return;
    const studyId = editingStudy.id;
    if (mode === 'dummy' || dataProp) {
      setDummyData((prev) => removeDummyStudy(prev, studyId));
      haptics.delete();
      setAddOpen(false);
      return;
    }
    if (!appData) return;
    void persistApp(deleteStudyWithReviews(appData, studyId));
    haptics.delete();
    setAddOpen(false);
  }, [editingStudy, mode, dataProp, appData, persistApp]);

  const onAddSubject = useCallback(
    (rawName: string, color: string): SubjectAddResult => {
      if (mode === 'dummy' || dataProp) {
        const name = normalizeSubjectName(rawName);
        if (!name) return { ok: false, reason: 'empty' };
        if (name.length > MAX_SUBJECT_NAME_LENGTH) {
          return { ok: false, reason: 'tooLong' };
        }
        if (dummySubjects.some((s) => s.name === name)) {
          return { ok: false, reason: 'duplicate' };
        }
        if (dummySubjects.length >= MAX_SUBJECTS) {
          return { ok: false, reason: 'limit' };
        }
        setDummySubjects((prev) => [...prev, { name, color }]);
        return { ok: true };
      }
      if (!appData) return { ok: false, reason: 'empty' };
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
    [mode, dataProp, dummySubjects, appData, persistApp],
  );

  const onRemoveSubject = useCallback(
    (name: string) => {
      if (mode === 'dummy' || dataProp) {
        setDummySubjects((prev) => prev.filter((s) => s.name !== name));
        return;
      }
      if (!appData) return;
      const result = removeSubject(appData, name);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [mode, dataProp, appData, persistApp],
  );

  const onReorderSubjects = useCallback(
    (orderedNames: string[]) => {
      if (mode === 'dummy' || dataProp) {
        setDummySubjects((prev) => {
          const byName = new Map(prev.map((s) => [s.name, s]));
          const next: SubjectOption[] = [];
          const seen = new Set<string>();
          for (const name of orderedNames) {
            const chip = byName.get(name);
            if (!chip || seen.has(name)) continue;
            next.push(chip);
            seen.add(name);
          }
          for (const chip of prev) {
            if (!seen.has(chip.name)) next.push(chip);
          }
          return next;
        });
        return;
      }
      if (!appData) return;
      const result = reorderSubjects(appData, orderedNames);
      if (!result.ok) return;
      void persistApp(result.data);
    },
    [mode, dataProp, appData, persistApp],
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
      if (mode === 'dummy' && !dataProp) {
        setDummyData(buildDummyHomeData(parseKey(dateKey)));
      }
    },
    [base, mode, dataProp],
  );

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

  const selectMode = useCallback(
    async (next: DataMode) => {
      if (dataProp) return;
      haptics.select();
      setMode(next);
      await saveDataMode(next);
      setWeekAnchorKey(null);
      appliedDayRef.current = null;
      if (next === 'dummy') {
        const fresh = cloneHomeData(HOME_DUMMY);
        setDummyData(fresh);
        setDummySubjects(seedSubjectOptions());
        setSelectedKey(fresh.todayKey);
        setWeekIndex(fresh.currentWeekIndex);
        return;
      }
      const stored = appData ?? (await loadAppData());
      if (!appData) setAppData(stored);
      const screen = homeScreenDataFromAppData(stored);
      setSelectedKey(screen.todayKey);
      setWeekIndex(screen.currentWeekIndex);
    },
    [dataProp, appData],
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
              key={`${mode}:${base.todayKey}:${weekAnchorKey ?? 'home'}:${base.weeks[0]?.[0]?.dateKey ?? ''}`}
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

          {!dataProp ? (
            <ModeControl
              active={mode}
              accent={theme.primary}
              accentSoft={theme.primarySoft}
              onSelect={selectMode}
            />
          ) : null}
        </View>
      </View>

      <SpringFab
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
      </SpringFab>

      <SpringFab
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
      </SpringFab>

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
                }
              : undefined
          }
          subjects={
            subjectOptions.length > 0
              ? subjectOptions
              : DEFAULT_SUBJECTS.map((s) => ({
                  name: s.name,
                  color: s.color ?? subjectColor(s.name),
                }))
          }
          onSave={onSaveAdd}
          onDelete={editingStudy ? onDeleteStudy : undefined}
          onAddSubject={onAddSubject}
          onRemoveSubject={onRemoveSubject}
          onReorderSubjects={onReorderSubjects}
          maxSubjects={MAX_SUBJECTS}
        />
      </BottomSheetModal>

      <BottomSheetModal visible={settingsOpen} onClose={closeSettings}>
        <SettingsSheet />
      </BottomSheetModal>

      <BottomSheetModal visible={reviewOpen != null} onClose={closeReview}>
        {reviewOpen ? (
          <ReviewDetailContent
            studies={reviewOpen.studies}
            colorByName={colorByName}
          />
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

function ModeControl({
  active,
  accent,
  accentSoft,
  onSelect,
}: {
  active: DataMode;
  accent: string;
  accentSoft: string;
  onSelect: (mode: DataMode) => void;
}) {
  return (
    <View style={styles.devControl} accessibilityRole="tablist">
      <Text style={styles.devHintLabel}>데이터</Text>
      <View style={styles.devSegments}>
        {DATA_MODES.map((mode) => {
          const selected = mode === active;
          return (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${DATA_MODE_LABEL[mode]} 모드`}
              onPress={() => onSelect(mode)}
              style={[
                styles.devSegment,
                selected && { backgroundColor: accentSoft },
              ]}>
              <Text
                style={[
                  styles.devSegmentText,
                  selected && { color: accent },
                ]}>
                {DATA_MODE_LABEL[mode]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {active === 'dummy' ? (
        <Text style={styles.dummyBadge}>미리보기</Text>
      ) : null}
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

  useEffect(() => {
    if (width <= 0) return;
    if (settledIndexRef.current === weekIndex) return;
    const delta = Math.abs(weekIndex - settledIndexRef.current);
    const animate = delta > 0 && delta <= JUMP_ANIMATE_MAX_DELTA;
    settledIndexRef.current = weekIndex;
    listRef.current?.scrollToIndex({ index: weekIndex, animated: animate });
  }, [weekIndex, width]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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

  const renderWeek = useCallback(
    ({ item: days }: { item: HomeWeekDay[] }) => (
      <View style={[styles.weekPage, { width }]}>
        {days.map((d) => (
          <WeekDayCell
            key={d.dateKey}
            day={d}
            selected={d.dateKey === selectedKey}
            accentColor={accentColor}
            onSelectDay={onSelectDay}
          />
        ))}
      </View>
    ),
    [accentColor, onSelectDay, selectedKey, width],
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

function WeekDayCell({
  day,
  selected,
  accentColor,
  onSelectDay,
}: {
  day: HomeWeekDay;
  selected: boolean;
  accentColor: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const scale = useSharedValue(selected ? 1 : 0.96);

  useEffect(() => {
    scale.value = withSpring(selected ? 1 : 0.96, springs.soft);
  }, [selected, scale]);

  const cellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${day.weekdayLabel} ${day.dateLabel}`}
      onPress={() => onSelectDay(day.dateKey)}>
      <Animated.View
        style={[
          styles.weekCell,
          selected && styles.weekCellSelected,
          cellStyle,
        ]}>
        <Text
          style={[
            styles.weekDayNum,
            selected && styles.weekDayNumSelected,
          ]}>
          {day.day}
        </Text>
        <Text
          style={[styles.weekDow, selected && { color: accentColor }]}>
          {day.dow}
        </Text>
      </Animated.View>
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

  useEffect(() => {
    if (width <= 0) return;
    if (settledIndexRef.current === dayIndex) return;
    const delta = Math.abs(dayIndex - settledIndexRef.current);
    // Near jumps (incl. FAB 「오늘」) animate — 슈루룩; far jumps snap.
    const animate = delta > 0 && delta <= JUMP_ANIMATE_MAX_DELTA;
    settledIndexRef.current = dayIndex;
    listRef.current?.scrollToIndex({ index: dayIndex, animated: animate });
  }, [dayIndex, width]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
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
      const dayIsFuture = day.dateKey > todayKey;
      const dayAllowAdd =
        !dayIsFuture && day.studies.length < MAX_STUDIES_PER_DAY;
      return (
        <View style={[styles.dayPage, { width }]}>
          <View style={[styles.sections, { maxWidth: contentWidth }]}>
            <StudySection
              studies={day.studies}
              allowAdd={dayAllowAdd}
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
      onMomentumScrollEnd={onMomentumScrollEnd}
      onScrollToIndexFailed={({ index }) => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToIndex({ index, animated: false });
        });
      }}
      style={[styles.dayPager, { width }]}
      extraData={days}
    />
  );
}

function StudySection({
  studies,
  allowAdd,
  isToday,
  colorByName,
  onAdd,
  onEditStudy,
}: {
  studies: HomeStudyRow[];
  allowAdd: boolean;
  isToday: boolean;
  colorByName: Record<string, string>;
  onAdd: () => void;
  onEditStudy: (row: HomeStudyRow) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>
          {isToday ? '오늘 한 공부' : '이 날 한 공부'}
        </Text>
      </View>
      <View style={styles.studyList}>
        {studies.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="공부 기록 추가"
            accessibilityState={{ disabled: !allowAdd }}
            disabled={!allowAdd}
            onPress={onAdd}
            style={styles.addStudyBtn}>
            {allowAdd ? (
              <>
                <PlusIcon />
                <Text style={styles.addStudyText}>공부 기록 추가</Text>
              </>
            ) : null}
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="공부 기록 추가"
                onPress={onAdd}
                style={styles.addStudyMoreBtn}>
                <PlusIcon />
                <Text style={styles.addStudyMoreText}>공부 기록 추가</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.subjectName} ${row.content} 수정`}
      onPress={onPress}
      style={styles.studyRow}>
      <View
        style={[
          styles.studyChip,
          { backgroundColor: subjectColor(row.subjectName, colorByName) },
        ]}>
        <Text style={styles.studyChipText}>{row.subjectName}</Text>
      </View>
      <View style={styles.studyBody}>
        <Text style={styles.studyBodyText} numberOfLines={1}>
          {row.content}
        </Text>
      </View>
    </Pressable>
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
  const empty = reviews.length === 0;
  return (
    <View style={[styles.section, styles.reviewSection]}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>
          {isToday ? '오늘 할 복습' : '이 날 할 복습'}
        </Text>
      </View>
      {empty ? (
        <View style={styles.reviewEmpty}>
          <Text style={styles.reviewEmptyText}>아직 복습할 내용이 없어요</Text>
        </View>
      ) : (
        <View
          style={[
            styles.reviewGrid,
            reviews.length <= 3 && styles.reviewGridSingleRow,
          ]}>
          {reviews.map((card) => (
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
          ))}
        </View>
      )}
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
    progress.value = withTiming(completed ? 1 : 0, {
      duration: durations.fill,
      easing: completed
        ? Easing.in(Easing.cubic)
        : Easing.out(Easing.cubic),
    });
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
      onPress={onToggle}>
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
    progress.value = withTiming(card.completed ? 1 : 0, {
      duration: durations.fill,
      easing: card.completed
        ? Easing.in(Easing.cubic)
        : Easing.out(Easing.cubic),
    });
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
              <Text style={styles.intervalText}>
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
  dayNumber: {
    fontFamily: fonts.gothamBold,
    fontSize: sizes.dayNumber,
    color: colors.black,
    lineHeight: 86,
    letterSpacing: -2,
    flexShrink: 0,
    includeFontPadding: false,
  },
  dateMeta: {
    minWidth: 85,
    alignItems: 'flex-end',
    gap: 6,
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
  },
  dayPager: {
    maxWidth: spacing.frameWidth,
    flexGrow: 0,
    alignSelf: 'stretch',
  },
  dayPage: {
    alignItems: 'center',
  },
  weekCell: {
    width: sizes.weekCell.width,
    height: sizes.weekCell.height,
    borderRadius: radii.weekDay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellSelected: {
    backgroundColor: colors.surface,
  },
  weekDayNum: {
    fontFamily: fonts.gothamBold,
    fontSize: 22,
    color: colors.muted,
    textAlign: 'center',
    width: 26,
  },
  weekDayNumSelected: {
    color: colors.black,
  },
  weekDow: {
    fontFamily: fonts.gothamMedium,
    fontSize: 12,
    color: colors.mutedLight,
    textAlign: 'center',
    width: 26,
  },
  sections: {
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
    gap: 8,
    width: '100%',
  },
  studyChip: {
    width: sizes.studyChip.width,
    height: sizes.studyChip.height,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: colors.white,
  },
  studyBody: {
    flex: 1,
    height: sizes.studyBodyHeight,
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  studyBodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: colors.body,
  },
  addStudyBtn: {
    height: sizes.addStudyHeight,
    borderRadius: radii.chip,
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
    backgroundColor: colors.surface,
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
  reviewGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.reviewGap,
  },
  reviewGridSingleRow: {
    minHeight: 120,
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
  reviewCardInner: {
    flex: 1,
    gap: 12,
    justifyContent: 'space-between',
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
  reviewEmpty: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  reviewEmptyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.muted,
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
    shadowRadius: 8,
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
  devControl: {
    marginTop: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devHintLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
  dummyBadge: {
    fontFamily: fonts.nexonMedium,
    fontSize: 10,
    color: colors.accentText,
  },
  devSegments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  devSegment: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  devSegmentText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
});
