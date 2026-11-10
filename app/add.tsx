import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  AddStudyForm,
  type AddStudyPayload,
  type SubjectAddResult,
} from '@/components/home/AddStudyForm';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import {
  addSubject,
  appendStudyWithReviews,
  countStudiesOn,
  DEFAULT_SUBJECTS,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  MAX_SUBJECTS,
  removeSubject,
  saveAppData,
} from '@/storage/app-data';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';

/**
 * Route fallback for 「공부 기록 추가」 (transparentModal + SheetPanel).
 * Home empty-state CTA uses an in-screen BottomSheetModal instead.
 */
export default function AddRecordSheet() {
  const router = useRouter();
  const [appData, setAppData] = useState<AppData | null>(null);
  const [subjects, setSubjects] = useState(
    DEFAULT_SUBJECTS.map((s) => s.name),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadAppData();
      if (cancelled) return;
      setAppData(data);
      setSubjects(
        data.subjects.length > 0
          ? data.subjects.map((s) => s.name)
          : DEFAULT_SUBJECTS.map((s) => s.name),
      );
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
    setSubjects(next.subjects.map((s) => s.name));
    await saveAppData(next);
  }, []);

  const onSave = useCallback(
    async (payload: AddStudyPayload) => {
      const content = payload.title.trim();
      const memo = payload.memo.trim();
      const studiedOn = todayKey();
      const data = appData ?? (await loadAppData());
      if (countStudiesOn(data, studiedOn) >= MAX_STUDIES_PER_DAY) {
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
      onClose();
    },
    [appData, persist, onClose],
  );

  const onAddSubject = useCallback(
    (rawName: string): SubjectAddResult => {
      if (!appData) return { ok: false, reason: 'empty' };
      const result = addSubject(appData, rawName);
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

  return (
    <SheetPanel onClose={onClose}>
      <AddStudyForm
        subjects={subjects}
        onSave={onSave}
        onAddSubject={onAddSubject}
        onRemoveSubject={onRemoveSubject}
        maxSubjects={MAX_SUBJECTS}
      />
    </SheetPanel>
  );
}
