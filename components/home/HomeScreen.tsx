import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  EllipseIcon,
  PlusIcon,
} from '@/components/icons/HomeIcons';
import {
  HOME_DEMO_STATES,
  HOME_MOCK,
  HOME_TODAY_DAY,
  intervalLabel,
  type HomeDemoState,
  type HomeReviewCard,
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

const REVIEW_COLS = 3;

type HomeScreenProps = {
  /** Override mock; when omitted, uses demo state data. */
  data?: HomeScreenData;
  /** Initial demo fixture (dev toggle cycles full → few → empty). */
  initialDemoState?: HomeDemoState;
};

export default function HomeScreen({
  data: dataProp,
  initialDemoState = 'full',
}: HomeScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [demoState, setDemoState] = useState<HomeDemoState>(initialDemoState);
  const [selectedDay, setSelectedDay] = useState(HOME_TODAY_DAY);
  const [completedOverrides, setCompletedOverrides] = useState<
    Record<string, boolean>
  >({});

  const base = dataProp ?? HOME_MOCK[demoState];
  const todayDay = base.todayDay;

  const selected = useMemo(() => {
    return (
      base.weekDays.find((d) => d.day === selectedDay) ??
      base.weekDays.find((d) => d.day === todayDay) ??
      base.weekDays[0]
    );
  }, [base.weekDays, selectedDay, todayDay]);

  const reviews = useMemo(
    () =>
      selected.reviews.map((item) => ({
        ...item,
        completed: completedOverrides[item.id] ?? item.completed,
      })),
    [selected.reviews, completedOverrides],
  );

  const isFutureDay = selected.day > todayDay;
  const weekDays = useMemo(
    () =>
      base.weekDays.map((d) => ({
        ...d,
        selected: d.day === selected.day,
      })),
    [base.weekDays, selected.day],
  );

  const frameWidth = Math.min(windowWidth - 16, spacing.frameWidth);
  const contentWidth = Math.min(frameWidth, spacing.contentWidth);
  const reviewCardWidth = useMemo(() => {
    const gaps = spacing.reviewGap * (REVIEW_COLS - 1);
    return (contentWidth - gaps) / REVIEW_COLS;
  }, [contentWidth]);

  const toggleReview = useCallback(
    (id: string) => {
      const current =
        completedOverrides[id] ??
        selected.reviews.find((item) => item.id === id)?.completed ??
        false;
      setCompletedOverrides((prev) => ({ ...prev, [id]: !current }));
    },
    [selected.reviews, completedOverrides],
  );

  const goAdd = useCallback(() => {
    if (isFutureDay) return;
    router.push('/add');
  }, [isFutureDay, router]);

  const goCalendar = useCallback(() => {
    router.push('/calendar');
  }, [router]);

  const onDetail = useCallback((_id: string) => {
    // Stub: detail flow not in MVP scope for this PR.
    router.push('/add');
  }, [router]);

  const selectDay = useCallback((day: number) => {
    setCompletedOverrides({});
    setSelectedDay(day);
  }, []);

  const selectDemo = useCallback(
    (next: HomeDemoState) => {
      if (dataProp) return;
      setCompletedOverrides({});
      setSelectedDay(HOME_TODAY_DAY);
      setDemoState(next);
    },
    [dataProp],
  );

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
                <EllipseIcon />
              </View>
              <View style={styles.dateMeta}>
                <Text style={styles.weekday}>{selected.weekdayLabel}</Text>
                <Text style={styles.dateLabel}>{selected.dateLabel}</Text>
              </View>
            </View>

            <WeekStrip days={weekDays} onSelectDay={selectDay} />
          </View>

          <View style={[styles.sections, { maxWidth: contentWidth }]}>
            <StudySection
              studies={selected.studies}
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

          {__DEV__ && !dataProp ? (
            <DemoStateControl active={demoState} onSelect={selectDemo} />
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
    </View>
  );
}

function DemoStateControl({
  active,
  onSelect,
}: {
  active: HomeDemoState;
  onSelect: (state: HomeDemoState) => void;
}) {
  return (
    <View style={styles.devControl} accessibilityRole="tablist">
      <Text style={styles.devHintLabel}>demo</Text>
      <View style={styles.devSegments}>
        {HOME_DEMO_STATES.map((state) => {
          const selected = state === active;
          return (
            <Pressable
              key={state}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`데모 ${state}`}
              onPress={() => onSelect(state)}
              style={[
                styles.devSegment,
                selected && styles.devSegmentSelected,
              ]}>
              <Text
                style={[
                  styles.devSegmentText,
                  selected && styles.devSegmentTextSelected,
                ]}>
                {state}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WeekStrip({
  days,
  onSelectDay,
}: {
  days: (HomeWeekDay & { selected: boolean })[];
  onSelectDay: (day: number) => void;
}) {
  return (
    <View style={styles.weekStrip}>
      {days.map((d) => (
        <Pressable
          key={`${d.day}-${d.dow}`}
          accessibilityRole="button"
          accessibilityState={{ selected: d.selected }}
          accessibilityLabel={`${d.weekdayLabel} ${d.dateLabel}`}
          onPress={() => onSelectDay(d.day)}
          style={[styles.weekCell, d.selected && styles.weekCellSelected]}>
          <Text style={[styles.weekDayNum, d.selected && styles.weekDayNumSelected]}>
            {d.day}
          </Text>
          <Text style={[styles.weekDow, d.selected && styles.weekDowSelected]}>
            {d.dow}
          </Text>
        </Pressable>
      ))}
    </View>
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
          allowAdd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="공부 기록 추가"
              onPress={onAdd}
              style={styles.addStudyBtn}>
              <PlusIcon />
              <Text style={styles.addStudyText}>공부 기록 추가</Text>
            </Pressable>
          ) : (
            <View style={styles.studyEmpty} />
          )
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
  onToggle: (id: string) => void;
  onDetail: (id: string) => void;
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
              onToggle={() => onToggle(card.id)}
              onDetail={() => onDetail(card.id)}
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
    paddingTop: 6,
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
    minWidth: 84,
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
  weekStrip: {
    width: '100%',
    maxWidth: spacing.frameWidth,
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
  studyEmpty: {
    height: sizes.addStudyHeight,
    width: '100%',
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
