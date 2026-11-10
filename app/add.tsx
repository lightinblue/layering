import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  AddStudyForm,
  type AddStudyPayload,
} from '@/components/home/AddStudyForm';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import {
  appendStudyWithReviews,
  countStudiesOn,
  DEFAULT_SUBJECTS,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  saveAppData,
} from '@/storage/app-data';
import { todayKey } from '@/utils/date';

/**
 * Route fallback for 「공부 기록 추가」 (transparentModal + SheetPanel).
 * Home empty-state CTA uses an in-screen BottomSheetModal instead.
 */
export default function AddRecordSheet() {
  const router = useRouter();
  const [subjects, setSubjects] = useState(
    DEFAULT_SUBJECTS.map((s) => s.name),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadAppData();
      if (cancelled) return;
      if (data.subjects.length > 0) {
        setSubjects(data.subjects.map((s) => s.name));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const onSave = useCallback(
    async (payload: AddStudyPayload) => {
      const content = payload.title.trim();
      const memo = payload.memo.trim();
      const studiedOn = todayKey();
      const data = await loadAppData();
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
      await saveAppData(next);
      onClose();
    },
    [onClose],
  );

  return (
    <SheetPanel onClose={onClose}>
      <AddStudyForm subjects={subjects} onSave={onSave} />
    </SheetPanel>
  );
}
