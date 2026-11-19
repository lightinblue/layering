import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  type SubjectAddResult,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { StudyDayTimeline } from '@/components/home/StudyDayTimeline';
import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { TIMELINE_MAX_STUDIES_PER_DAY } from '@/constants/study-timeline';
import {
  addSubject,
  appendStudyWithReviews,
  deleteStudyWithReviews,
  loadAppData,
  MAX_SUBJECTS,
  removeSubject,
  reorderSubjects,
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
    }));
}

/**
 * Day study detail — opened from home summary or calendar day tap.
 * Isolated route so the trial UI is easy to revert.
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
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
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

  const openAdd = useCallback(() => {
    if (atCap) {
      haptics.reject();
      return;
    }
    setEditingStudy(null);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }, [atCap]);

  const openEdit = useCallback((row: HomeStudyRow) => {
    setEditingStudy(row);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }, []);

  const onSave = useCallback(
    (payload: AddStudyPayload) => {
      if (!appData) return;
      const content = payload.title.trim();
      if (!content) {
        haptics.reject();
        return;
      }
      if (editingStudy) {
        const next = updateStudyWithReviews(appData, editingStudy.id, {
          subjectName: payload.subject,
          content,
          studiedOn: dateKey,
        });
        void persist(next);
        haptics.save();
        setAddOpen(false);
        return;
      }
      if (studies.length >= TIMELINE_MAX_STUDIES_PER_DAY) {
        haptics.reject();
        setAddOpen(false);
        return;
      }
      const next = appendStudyWithReviews(appData, {
        subjectName: payload.subject,
        content,
        studiedOn: dateKey,
      });
      void persist(next);
      haptics.save();
      setAddOpen(false);
    },
    [appData, dateKey, editingStudy, persist, studies.length],
  );

  const onDelete = useCallback(() => {
    if (!editingStudy || !appData) return;
    void persist(deleteStudyWithReviews(appData, editingStudy.id));
    haptics.delete();
    setAddOpen(false);
  }, [editingStudy, appData, persist]);

  const onAddSubject = useCallback(
    (rawName: string, color: string): SubjectAddResult => {
      if (!appData) return { ok: false, reason: 'empty' };
      const result = addSubject(appData, rawName, color);
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === 'missing' ? 'empty' : result.reason,
        };
      }
      void persist(result.data);
      return { ok: true };
    },
    [appData, persist],
  );

  const onRemoveSubject = useCallback(
    (name: string) => {
      if (!appData) return;
      const result = removeSubject(appData, name);
      if (!result.ok) return;
      void persist(result.data);
    },
    [appData, persist],
  );

  const onReorderSubjects = useCallback(
    (orderedNames: string[]) => {
      if (!appData) return;
      const result = reorderSubjects(appData, orderedNames);
      if (!result.ok) return;
      void persist(result.data);
    },
    [appData, persist],
  );

  if (!hydrated) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: colors.mainWhite }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.mainWhite,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}>
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
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {isToday ? '오늘' : '이 날'}
          </Text>
          <Text style={[styles.title, { color: colors.black }]}>
            {meta.dateLabel} {meta.weekdayLabel}
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Animated.View
          entering={FadeIn.delay(40)
            .duration(durations.fadeIn)
            .easing(Easing.out(Easing.cubic))}
          exiting={FadeOut.duration(durations.fadeOut)}>
          <StudyDayTimeline
            studies={studies}
            colorByName={colorByName}
            allowAdd={allowAdd}
            onAdd={openAdd}
            onEditStudy={openEdit}
          />
        </Animated.View>
      </ScrollView>

      <BottomSheetModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onDismissed={() => setEditingStudy(null)}>
        <AddStudyForm
          key={addKey}
          mode={editingStudy ? 'edit' : 'create'}
          subjects={subjects}
          initial={
            editingStudy
              ? {
                  subject: editingStudy.subjectName,
                  title: editingStudy.content,
                }
              : undefined
          }
          onSave={onSave}
          onDelete={editingStudy ? onDelete : undefined}
          onAddSubject={onAddSubject}
          onRemoveSubject={onRemoveSubject}
          onReorderSubjects={onReorderSubjects}
          maxSubjects={MAX_SUBJECTS}
        />
      </BottomSheetModal>
    </View>
  );
}

function parseLoose(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
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
  titleBlock: {
    gap: 4,
  },
  eyebrow: {
    fontFamily: fonts.nexonBold,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.nexonBold,
    fontSize: 22,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
});
