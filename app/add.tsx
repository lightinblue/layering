import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  AddStudyForm,
  type AddStudyPayload,
  type SubjectAddResult,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import { subjectColor } from '@/constants/tokens';
import {
  addSubject,
  appendStudyWithReviews,
  countStudiesOn,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  MAX_SUBJECTS,
  removeSubject,
  reorderSubjects,
  saveAppData,
  withSubjectColor,
} from '@/storage/app-data';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import { haptics } from '@/utils/haptics';

function toOptions(data: AppData): SubjectOption[] {
  return data.subjects.map((s) => {
    const chip = withSubjectColor(s);
    return { name: chip.name, color: chip.color ?? subjectColor(chip.name) };
  });
}

/**
 * Route fallback for 「공부 기록 추가」 (transparentModal + SheetPanel).
 * Home empty-state CTA uses an in-screen BottomSheetModal instead.
 */
export default function AddRecordSheet() {
  const router = useRouter();
  const [appData, setAppData] = useState<AppData | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadAppData();
      if (cancelled) return;
      setAppData(data);
      setSubjects(toOptions(data));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const persist = useCallback(async (next: AppData) => {
    setAppData(next);
    setSubjects(toOptions(next));
    await saveAppData(next);
  }, []);

  const onSave = useCallback(
    async (payload: AddStudyPayload) => {
      const content = payload.title.trim();
      const memo = payload.memo.trim();
      const studiedOn = todayKey();
      const data = appData ?? (await loadAppData());
      if (countStudiesOn(data, studiedOn) >= MAX_STUDIES_PER_DAY) {
        haptics.reject();
        onClose();
        return;
      }
      const next = appendStudyWithReviews(data, {
        subjectName: payload.subject,
        content,
        studiedOn,
        ...(memo ? { memo } : {}),
      });
      await persist(next);
      haptics.save();
      onClose();
    },
    [appData, persist, onClose],
  );

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

  return (
    <SheetPanel onClose={onClose}>
      <AddStudyForm
        subjects={subjects}
        onSave={onSave}
        onAddSubject={onAddSubject}
        onRemoveSubject={onRemoveSubject}
        onReorderSubjects={onReorderSubjects}
        maxSubjects={MAX_SUBJECTS}
      />
    </SheetPanel>
  );
}
