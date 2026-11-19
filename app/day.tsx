import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  ArrowRightIcon,
  EllipseIcon,
} from '@/components/icons/HomeIcons';
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
  deleteStudyWithReviews,
  loadAppData,
  saveAppData,
  subjectColorMap,
  updateStudyWithReviews,
  withSubjectColor,
} from '@/storage/app-data';
import { syncTodayReviewWidgetSnapshot } from '@/storage/today-review-widget';
import {
  useColorScheme,
  useThemeColors,
} from '@/theme/ThemeProvider';
import type { AppData } from '@/types/domain';
import { dayMeta, todayKey as deviceTodayKey } from '@/utils/date';
import { activeRecords, activeSubjects } from '@/utils/icloud-merge';
import { haptics } from '@/utils/haptics';

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
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      content: r.content,
      ...(r.subjectColor ? { subjectColor: r.subjectColor } : {}),
      ...(r.dayBand ? { dayBand: r.dayBand } : {}),
    }));
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
  const dateKey =
    firstParam(params.date) && /^\d{4}-\d{2}-\d{2}$/.test(firstParam(params.date)!)
      ? firstParam(params.date)!
      : deviceTodayKey();

  const [appData, setAppData] = useState<AppData | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [editingStudy, setEditingStudy] = useState<HomeStudyRow | null>(null);

  const meta = useMemo(() => dayMeta(parseLoose(dateKey)), [dateKey]);
  const isToday = dateKey === deviceTodayKey();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await loadAppData();
      if (cancelled) return;
      setAppData(data);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
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
      if (!appData) return;
      const content = input.title.trim();
      if (!content || !input.subject) {
        haptics.reject();
        return;
      }
      if (studies.length >= TIMELINE_MAX_STUDIES_PER_DAY) {
        haptics.reject();
        return;
      }
      const next = appendStudyWithReviews(appData, {
        subjectName: input.subject,
        content,
        studiedOn: dateKey,
        dayBand: input.bandId,
      });
      void persist(next);
    },
    [appData, dateKey, persist, studies.length],
  );

  const onSaveEdit = useCallback(
    (payload: AddStudyPayload) => {
      if (!appData || !editingStudy) return;
      const content = payload.title.trim();
      if (!content) {
        haptics.reject();
        return;
      }
      const next = updateStudyWithReviews(appData, editingStudy.id, {
        subjectName: payload.subject,
        content,
        studiedOn: dateKey,
      });
      void persist(next);
      haptics.save();
      setEditOpen(false);
    },
    [appData, dateKey, editingStudy, persist],
  );

  const onDelete = useCallback(() => {
    if (!editingStudy || !appData) return;
    void persist(deleteStudyWithReviews(appData, editingStudy.id));
    haptics.delete();
    setEditOpen(false);
  }, [editingStudy, appData, persist]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={12}
          onPress={onClose}
          style={styles.backBtn}>
          <View style={styles.backArrow}>
            <ArrowRightIcon color={colors.muted} />
          </View>
          <Text style={[styles.backText, { color: colors.muted }]}>홈</Text>
        </Pressable>
        <DayTitleDate meta={meta} isToday={isToday} />
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

/** `11/19 (목)` — Gotham digits (home date face) + Nexon weekday; today → small ellipse. */
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
    <View
      style={styles.titleRow}
      accessibilityRole="header"
      accessibilityLabel={`${month}월 ${day}일 ${meta.weekdayLabel}${isToday ? ', 오늘' : ''}`}>
      <Text style={[styles.titleNums, { color: colors.black }]}>
        {month}/{day}
      </Text>
      <Text style={[styles.titleDow, { color: colors.black }]}>
        {' '}
        ({meta.dow})
      </Text>
      {isToday ? (
        <View style={styles.todayDot}>
          <EllipseIcon size={10} />
        </View>
      ) : null}
    </View>
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
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backArrow: {
    transform: [{ scaleX: -1 }],
  },
  backText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleNums: {
    fontFamily: fonts.gothamBold,
    fontSize: 28,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  titleDow: {
    fontFamily: fonts.nexonMedium,
    fontSize: 20,
  },
  todayDot: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});
