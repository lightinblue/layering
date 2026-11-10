import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AddStudyForm,
  type AddStudyPayload,
} from '@/components/home/AddStudyForm';
import { ReviewDetailContent } from '@/components/home/ReviewDetailContent';
import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  EllipseIcon,
  PlusIcon,
} from '@/components/icons/HomeIcons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import {
  applyDummyStudy,
  cloneHomeData,
  DUMMY_SUBJECTS,
  flattenWeeks,
  HOME_DUMMY,
  intervalLabel,
  toggleDummyReview,
  type HomeReviewCard,
  type HomeReviewStudy,
  type HomeScreenData,
  type HomeStudyRow,
  type HomeWeekDay,
} from '@/constants/home-mock';
import { fonts } from '@/constants/fonts';
import {
  colors,
  radii,
  sizes,
  spacing,
  subjectColor,
} from '@/constants/tokens';
import {
  appendStudyWithReviews,
  DEFAULT_SUBJECTS,
  loadAppData,
  saveAppData,
  toggleReviewCompleted,
} from '@/storage/app-data';
import {
  DATA_MODE_LABEL,
  DATA_MODES,
  DEFAULT_DATA_MODE,
  loadDataMode,
  saveDataMode,
  type DataMode,
} from '@/storage/data-mode';
import type { AppData } from '@/types/domain';
import { homeScreenDataFromAppData } from '@/utils/home-from-app-data';

const REVIEW_COLS = 3;

type HomeScreenProps = {
  /** Override data (skips mode load). */
  data?: HomeScreenData;
  /** Initial mode before AsyncStorage resolves (`?mode=`). */
  initialMode?: DataMode;
};

export default function HomeScreen({
  data: dataProp,
  initialMode = DEFAULT_DATA_MODE,
}: HomeScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [mode, setMode] = useState<DataMode>(initialMode);
  const [hydrated, setHydrated] = useState(dataProp != null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [dummyData, setDummyData] = useState<HomeScreenData>(() =>
    cloneHomeData(HOME_DUMMY),
  );

  const [selectedKey, setSelectedKey] = useState(HOME_DUMMY.todayKey);
  const [weekIndex, setWeekIndex] = useState(HOME_DUMMY.currentWeekIndex);
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
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
      if (nextMode === 'real') {
        const screen = homeScreenDataFromAppData(storedApp);
        setSelectedKey(screen.todayKey);
        setWeekIndex(screen.currentWeekIndex);
      } else {
        setDummyData(cloneHomeData(HOME_DUMMY));
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
    if (appData) return homeScreenDataFromAppData(appData);
    return HOME_DUMMY;
  }, [dataProp, mode, dummyData, appData]);

  const todayKey = base.todayKey;
  const allDays = useMemo(() => flattenWeeks(base.weeks), [base.weeks]);

  const selected = useMemo(() => {
    return (
      allDays.find((d) => d.dateKey === selectedKey) ??
      allDays.find((d) => d.dateKey === todayKey) ??
      allDays[0]
    );
  }, [allDays, selectedKey, todayKey]);

  const reviews = selected?.reviews ?? [];
  const studies = selected?.studies ?? [];

  const isFutureDay = selected != null && selected.dateKey > todayKey;
  const isToday = selected != null && selected.dateKey === todayKey;

  const frameWidth = Math.min(windowWidth - 16, spacing.frameWidth);
  const contentWidth = Math.min(frameWidth, spacing.contentWidth);
  const reviewCardWidth = useMemo(() => {
    const gaps = spacing.reviewGap * (REVIEW_COLS - 1);
    return (contentWidth - gaps) / REVIEW_COLS;
  }, [contentWidth]);

  const subjectNames = useMemo(() => {
    if (mode === 'real' && appData) {
      return appData.subjects.map((s) => s.name);
    }
    return [...DUMMY_SUBJECTS];
  }, [mode, appData]);

  const persistApp = useCallback(async (next: AppData) => {
    setAppData(next);
    await saveAppData(next);
  }, []);

  const selectedDateKey = selected?.dateKey ?? todayKey;

  const toggleReview = useCallback(
    (card: HomeReviewCard) => {
      if (mode === 'dummy' || dataProp) {
        setDummyData((prev) =>
          toggleDummyReview(prev, selectedDateKey, card.id),
        );
        return;
      }
      if (!appData) return;
      let next = appData;
      for (const id of card.scheduleIds) {
        next = toggleReviewCompleted(next, id);
      }
      void persistApp(next);
    },
    [mode, dataProp, selectedDateKey, appData, persistApp],
  );

  const goAdd = useCallback(() => {
    if (isFutureDay) return;
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }, [isFutureDay]);

  const closeAdd = useCallback(() => {
    setAddOpen(false);
  }, []);

  const onSaveAdd = useCallback(
    (payload: AddStudyPayload) => {
      const content = payload.title.trim();
      const memo = payload.memo.trim();
      const studiedOn = selectedDateKey;

      if (mode === 'dummy' || dataProp) {
        setDummyData((prev) =>
          applyDummyStudy(prev, {
            subjectName: payload.subject,
            content,
            studiedOn,
            ...(memo ? { memo } : {}),
          }),
        );
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
      setAddOpen(false);
    },
    [mode, dataProp, selectedDateKey, appData, persistApp],
  );

  const goCalendar = useCallback(() => {
    router.push('/calendar');
  }, [router]);

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

  const selectDay = useCallback((dateKey: string) => {
    setSelectedKey(dateKey);
  }, []);

  const onWeekChange = useCallback(
    (nextIndex: number, weekdayIndex: number) => {
      const week = base.weeks[nextIndex];
      if (!week) return;
      const nextDay = week[weekdayIndex] ?? week[0];
      setWeekIndex(nextIndex);
      setSelectedKey(nextDay.dateKey);
    },
    [base.weeks],
  );

  const selectMode = useCallback(
    async (next: DataMode) => {
      if (dataProp) return;
      setMode(next);
      await saveDataMode(next);
      if (next === 'dummy') {
        const fresh = cloneHomeData(HOME_DUMMY);
        setDummyData(fresh);
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

  if (!hydrated || !selected) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator color={colors.primary} />
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
                <Text style={styles.dayNumber} numberOfLines={1}>
                  {selected.dayNumber}
                </Text>
                {isToday ? <EllipseIcon /> : null}
              </View>
              <View style={styles.dateMeta}>
                <Text style={styles.weekday}>{selected.weekdayLabel}</Text>
                <Text style={styles.dateLabel}>{selected.dateLabel}</Text>
              </View>
            </View>

            <WeekStripPager
              key={`${mode}:${base.todayKey}:${base.currentWeekIndex}`}
              weeks={base.weeks}
              weekIndex={weekIndex}
              selectedKey={selected.dateKey}
              weekdayIndex={selectedWeekdayIndex}
              width={frameWidth}
              onSelectDay={selectDay}
              onWeekChange={onWeekChange}
            />
          </View>

          <View style={[styles.sections, { maxWidth: contentWidth }]}>
            <StudySection
              studies={studies}
              allowAdd={!isFutureDay}
              onAdd={goAdd}
            />
            <ReviewSection
              reviews={reviews}
              cardWidth={reviewCardWidth}
              onToggle={toggleReview}
              onDetail={onDetail}
            />
          </View>

          {!dataProp ? (
            <ModeControl active={mode} onSelect={selectMode} />
          ) : null}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="캘린더"
        onPress={goCalendar}
        style={[
          styles.fab,
          {
            right: Math.max(16, (windowWidth - contentWidth) / 2),
            bottom: 24 + insets.bottom,
          },
        ]}>
        <CalendarIcon />
      </Pressable>

      <BottomSheetModal visible={addOpen} onClose={closeAdd}>
        <AddStudyForm
          key={addKey}
          subjects={
            subjectNames.length > 0
              ? subjectNames
              : DEFAULT_SUBJECTS.map((s) => s.name)
          }
          onSave={onSaveAdd}
        />
      </BottomSheetModal>

      <BottomSheetModal visible={reviewOpen != null} onClose={closeReview}>
        {reviewOpen ? (
          <ReviewDetailContent
            intervalLabel={`${reviewOpen.intervalDays}일 전`}
            studies={reviewOpen.studies}
          />
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

function ModeControl({
  active,
  onSelect,
}: {
  active: DataMode;
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
                selected && styles.devSegmentSelected,
              ]}>
              <Text
                style={[
                  styles.devSegmentText,
                  selected && styles.devSegmentTextSelected,
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
  onSelectDay,
  onWeekChange,
}: {
  weeks: HomeWeekDay[][];
  weekIndex: number;
  selectedKey: string;
  weekdayIndex: number;
  width: number;
  onSelectDay: (dateKey: string) => void;
  onWeekChange: (weekIndex: number, weekdayIndex: number) => void;
}) {
  const listRef = useRef<FlatList<HomeWeekDay[]>>(null);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      const clamped = Math.max(0, Math.min(weeks.length - 1, next));
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
        {days.map((d) => {
          const selected = d.dateKey === selectedKey;
          return (
            <Pressable
              key={d.dateKey}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${d.weekdayLabel} ${d.dateLabel}`}
              onPress={() => onSelectDay(d.dateKey)}
              style={[styles.weekCell, selected && styles.weekCellSelected]}>
              <Text
                style={[
                  styles.weekDayNum,
                  selected && styles.weekDayNumSelected,
                ]}>
                {d.day}
              </Text>
              <Text
                style={[styles.weekDow, selected && styles.weekDowSelected]}>
                {d.dow}
              </Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [onSelectDay, selectedKey, width],
  );

  return (
    <FlatList
      ref={listRef}
      data={weeks}
      horizontal
      pagingEnabled
      bounces={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
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

function StudySection({
  studies,
  allowAdd,
  onAdd,
}: {
  studies: HomeStudyRow[];
  allowAdd: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>오늘 한 공부</Text>
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
          studies.map((row) => <StudyRow key={row.id} row={row} />)
        )}
      </View>
    </View>
  );
}

function StudyRow({ row }: { row: HomeStudyRow }) {
  return (
    <View style={styles.studyRow}>
      <View
        style={[
          styles.studyChip,
          { backgroundColor: subjectColor(row.subjectName) },
        ]}>
        <Text style={styles.studyChipText}>{row.subjectName}</Text>
      </View>
      <View style={styles.studyBody}>
        <Text style={styles.studyBodyText} numberOfLines={1}>
          {row.content}
        </Text>
      </View>
    </View>
  );
}

function ReviewSection({
  reviews,
  cardWidth,
  onToggle,
  onDetail,
}: {
  reviews: HomeReviewCard[];
  cardWidth: number;
  onToggle: (card: HomeReviewCard) => void;
  onDetail: (card: HomeReviewCard) => void;
}) {
  const empty = reviews.length === 0;
  return (
    <View style={[styles.section, styles.reviewSection]}>
      <View style={styles.sectionLabelWrap}>
        <Text style={styles.sectionLabel}>오늘 할 복습</Text>
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
              onToggle={() => onToggle(card)}
              onDetail={() => onDetail(card)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ReviewCard({
  card,
  width,
  onToggle,
  onDetail,
}: {
  card: HomeReviewCard;
  width: number;
  onToggle: () => void;
  onDetail: () => void;
}) {
  return (
    <View
      style={[
        styles.reviewCard,
        { width },
        card.completed && styles.reviewCardSelected,
      ]}>
      <View style={styles.reviewCardInner}>
        <View style={styles.reviewTopBlock}>
          <View style={styles.reviewTop}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: card.completed }}
              onPress={onToggle}
              style={[
                styles.checkbox,
                card.completed ? styles.checkboxOn : styles.checkboxOff,
              ]}>
              <CheckIcon />
            </Pressable>
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
                  { backgroundColor: subjectColor(name) },
                ]}>
                <Text style={styles.reviewChipText}>{name.charAt(0)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="자세히"
          onPress={onDetail}
          style={styles.detailRow}>
          <Text style={styles.detailText}>자세히</Text>
          <ArrowRightIcon />
        </Pressable>
      </View>
    </View>
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
  weekDowSelected: {
    color: colors.primary,
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
    fontSize: 17,
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
  reviewCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
  checkboxOn: {
    backgroundColor: colors.primary,
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
  devSegmentSelected: {
    backgroundColor: colors.primarySoft,
  },
  devSegmentText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.mutedLight,
  },
  devSegmentTextSelected: {
    color: colors.primary,
  },
});
