import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AddStudyForm,
  type AddStudyPayload,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { StudyDayTimeline } from '@/components/home/StudyDayTimeline';
import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import {
  TIMELINE_MAX_STUDIES_PER_DAY,
  type TimelineBandId,
} from '@/constants/study-timeline';
import {
  appendStudyWithReviews,
  applyDayStudyLayout,
  deferStudyToTomorrow,
  deleteStudyWithReviews,
  loadAppData,
  saveAppData,
  subjectColorMap,
  toggleStudyDayDone,
  updateStudyWithReviews,
  withSubjectColor,
} from '@/storage/app-data';
import { subscribeICloudMerged } from '@/storage/icloud-sync';
import { syncTodayReviewWidgetSnapshot } from '@/storage/today-review-widget';
import {
  useColorScheme,
  useThemeColors,
} from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { dayMeta, todayKey as deviceTodayKey } from '@/utils/date';
import { activeRecords, activeSubjects } from '@/utils/icloud-merge';
import { haptics } from '@/utils/haptics';
import {
  buildTimelineBands,
  layoutAfterBandReorder,
  layoutAfterCrossBandMove,
  layoutWithStudyAppendedToBand,
} from '@/utils/study-timeline';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toOptions(data: AppData): SubjectOption[] {
  return activeSubjects(data.subjects).map((s) => {
    const chip = withSubjectColor(s);
    return { name: chip.name, color: chip.color ?? '#62B3F6' };
  });
}

function studiesForDay(data: AppData, dateKey: string): HomeStudyRow[] {
  return activeRecords(data.records)
    .filter((r) => r.studiedOn === dateKey)
    .slice()
    .sort((a, b) => {
      const ao = typeof a.dayOrder === 'number' ? a.dayOrder : Number.MAX_SAFE_INTEGER;
      const bo = typeof b.dayOrder === 'number' ? b.dayOrder : Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    })
    .map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      content: r.content,
      ...(r.subjectColor ? { subjectColor: r.subjectColor } : {}),
      ...(r.dayBand ? { dayBand: r.dayBand } : {}),
      ...(typeof r.dayOrder === 'number' ? { dayOrder: r.dayOrder } : {}),
      ...(r.dayDone ? { dayDone: true } : {}),
      createdAt: r.createdAt,
    }));
}

function countActiveOnDay(data: AppData, dateKey: string): number {
  return activeRecords(data.records).filter((r) => r.studiedOn === dateKey)
    .length;
}

/**
 * Day study detail — opened from home summary or calendar day tap.
 * Band adds are inline; edit still uses the sheet.
 */
export default function DayTimelineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const paramDate = firstParam(params.date);
  // Always call todayKey() — never pass the function as a value. Param must be YMD.
  const dateKey =
    paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)
      ? paramDate
      : deviceTodayKey();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [editingStudy, setEditingStudy] = useState<HomeStudyRow | null>(null);
  /** Avoid stale closures on rapid inline adds (iPad double-commit). */
  const appDataRef = useRef<AppData | null>(null);

  const meta = useMemo(() => dayMeta(parseLoose(dateKey)), [dateKey]);
  const isToday = dateKey === deviceTodayKey();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await loadAppData();
      if (cancelled) return;
      appDataRef.current = data;
      setAppData(data);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep Day in sync with KVS merges so persist cannot clobber remote/home writes.
  useEffect(() => {
    return subscribeICloudMerged((merged) => {
      appDataRef.current = merged;
      setAppData(merged);
      void syncTodayReviewWidgetSnapshot(merged);
    });
  }, []);

  const studies = useMemo(
    () => (appData ? studiesForDay(appData, dateKey) : []),
    [appData, dateKey],
  );
  const colorByName = useMemo(
    () => (appData ? subjectColorMap(appData.subjects) : {}),
    [appData],
  );
  const subjects = useMemo(
    () => (appData ? toOptions(appData) : []),
    [appData],
  );
  const atCap = studies.length >= TIMELINE_MAX_STUDIES_PER_DAY;
  const allowAdd = !atCap;

  const persist = useCallback(async (next: AppData) => {
    appDataRef.current = next;
    setAppData(next);
    await saveAppData(next);
    await syncTodayReviewWidgetSnapshot(next);
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const openEdit = useCallback((row: HomeStudyRow) => {
    setEditingStudy(row);
    setEditKey((k) => k + 1);
    setEditOpen(true);
  }, []);

  const onAddStudy = useCallback(
    (input: { bandId: TimelineBandId; subject: string; title: string }) => {
      const data = appDataRef.current;
      if (!data) return;
      const content = input.title.trim();
      if (!content || !input.subject) {
        haptics.reject();
        return;
      }
      const currentStudies = studiesForDay(data, dateKey);
      if (currentStudies.length >= TIMELINE_MAX_STUDIES_PER_DAY) {
        haptics.reject();
        return;
      }
      const next = appendStudyWithReviews(data, {
        subjectName: input.subject,
        content,
        studiedOn: dateKey,
        dayBand: input.bandId,
      });
      // New record is always appended to `records`.
      const created = next.records[next.records.length - 1];
      if (!created || created.deleted) {
        void persist(next);
        return;
      }
      // Force visual append at bottom of the target band (dayOrder alone can
      // interleave oddly after cross-band remaps / stale max).
      const bands = buildTimelineBands(studiesForDay(next, dateKey));
      const layout = layoutWithStudyAppendedToBand({
        bands,
        studyId: created.id,
        bandId: input.bandId,
      });
      void persist(applyDayStudyLayout(next, dateKey, layout));
    },
    [dateKey, persist],
  );

  const onReorderBand = useCallback(
    (bandId: TimelineBandId, orderedBandIds: string[]) => {
      const data = appDataRef.current;
      if (!data) return;
      if (orderedBandIds.length === 0) return;

      const bands = buildTimelineBands(studiesForDay(data, dateKey));
      const layout = layoutAfterBandReorder({
        bands,
        bandId,
        orderedBandIds,
      });
      if (!layout) return;

      const next = applyDayStudyLayout(data, dateKey, layout);
      if (next === data) return;
      haptics.select();
      void persist(next);
    },
    [dateKey, persist],
  );

  const onMoveStudyToBand = useCallback(
    (input: {
      studyId: string;
      toBandId: TimelineBandId;
      toIndex: number;
    }): boolean => {
      const data = appDataRef.current;
      if (!data) return false;
      const bands = buildTimelineBands(studiesForDay(data, dateKey));
      const layout = layoutAfterCrossBandMove({
        bands,
        studyId: input.studyId,
        toBandId: input.toBandId,
        toIndex: input.toIndex,
      });
      if (!layout) return false;
      const next = applyDayStudyLayout(data, dateKey, layout);
      if (next === data) return false;
      haptics.select();
      void persist(next);
      return true;
    },
    [dateKey, persist],
  );

  const onSaveEdit = useCallback(
    (payload: AddStudyPayload) => {
      const data = appDataRef.current;
      if (!data || !editingStudy) return;
      const content = payload.title.trim();
      if (!content) {
        haptics.reject();
        return;
      }
      const next = updateStudyWithReviews(data, editingStudy.id, {
        subjectName: payload.subject,
        content,
        studiedOn: dateKey,
      });
      void persist(next);
      haptics.save();
      setEditOpen(false);
    },
    [dateKey, editingStudy, persist],
  );

  const onDelete = useCallback(() => {
    const data = appDataRef.current;
    if (!editingStudy || !data) return;
    void persist(deleteStudyWithReviews(data, editingStudy.id));
    haptics.delete();
    setEditOpen(false);
  }, [editingStudy, persist]);

  const onToggleDayDone = useCallback(
    (studyId: string) => {
      const data = appDataRef.current;
      if (!data) return;
      const existing = data.records.find((r) => r.id === studyId && !r.deleted);
      if (!existing) return;
      const next = toggleStudyDayDone(data, studyId);
      if (next === data) return;
      if (existing.dayDone) haptics.checkOff();
      else haptics.checkOn();
      void persist(next);
    },
    [persist],
  );

  const onDeferTomorrow = useCallback(
    (studyId: string) => {
      const data = appDataRef.current;
      if (!data) return;
      const before = countActiveOnDay(data, dateKey);
      const next = deferStudyToTomorrow(data, studyId);
      const after = countActiveOnDay(next, dateKey);
      if (after >= before) {
        // Cap or missing — soft reject.
        haptics.reject();
        return;
      }
      haptics.save();
      void persist(next);
    },
    [dateKey, persist],
  );

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.mainWhite }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          backgroundColor: colors.mainWhite,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />

      <Animated.View
        entering={FadeIn.duration(durations.fadeIn).easing(
          Easing.out(Easing.cubic),
        )}
        style={styles.header}>
        <View style={styles.headerBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={14}
            onPress={onClose}
            style={styles.backBtn}>
            <View style={styles.backArrow}>
              <ArrowRightIcon size={18} color={colors.muted} />
            </View>
          </Pressable>
          <DayTitleDate meta={meta} isToday={isToday} />
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Animated.View
          entering={FadeIn.delay(40)
            .duration(durations.fadeIn)
            .easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(durations.fadeOut)}>
          <StudyDayTimeline
            studies={studies}
            subjects={subjects}
            colorByName={colorByName}
            allowAdd={allowAdd}
            onAddStudy={onAddStudy}
            onEditStudy={openEdit}
            onToggleDayDone={onToggleDayDone}
            onDeferTomorrow={onDeferTomorrow}
            onReorderBand={onReorderBand}
            onMoveStudyToBand={onMoveStudyToBand}
          />
        </Animated.View>
      </ScrollView>

      <BottomSheetModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onDismissed={() => setEditingStudy(null)}>
        {editingStudy ? (
          <AddStudyForm
            key={editKey}
            mode="edit"
            subjects={subjects}
            initial={{
              subject: editingStudy.subjectName,
              title: editingStudy.content,
              ...(editingStudy.subjectColor
                ? { subjectColor: editingStudy.subjectColor }
                : {}),
            }}
            onSave={onSaveEdit}
            onDelete={onDelete}
          />
        ) : null}
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

function parseLoose(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Far-right light gray `11.19 (목)` — Gotham digits + Nexon weekday. */
function DayTitleDate({
  meta,
  isToday,
}: {
  meta: ReturnType<typeof dayMeta>;
  isToday: boolean;
}) {
  const colors = useThemeColors();
  const month = meta.dateKey.slice(5, 7).replace(/^0/, '');
  const day = String(meta.day);
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={`${month}월 ${day}일 ${meta.weekdayLabel}${isToday ? ', 오늘' : ''}`}
      style={styles.titleDate}>
      <Text style={[styles.titleNums, { color: colors.mutedLight }]}>
        {month}.{day}
      </Text>
      <Text style={[styles.titleDow, { color: colors.mutedLight }]}>
        {' '}
        ({meta.dow})
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingRight: 8,
  },
  backArrow: {
    transform: [{ scaleX: -1 }],
  },
  titleDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleNums: {
    fontFamily: fonts.gothamMedium,
    fontSize: 16,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  titleDow: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});
