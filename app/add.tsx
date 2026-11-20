import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  AddStudyForm,
  type AddStudyPayload,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import { subjectColor } from '@/constants/tokens';
import {
  appendStudyWithReviews,
  countStudiesOn,
  loadAppData,
  MAX_STUDIES_PER_DAY,
  saveAppData,
  withSubjectColor,
} from '@/storage/app-data';
import { syncTodayReviewWidgetSnapshot } from '@/storage/today-review-widget';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import { activeSubjects } from '@/utils/icloud-merge';
import { haptics } from '@/utils/haptics';

function toOptions(data: AppData): SubjectOption[] {
  return activeSubjects(data.subjects).map((s) => {
    const chip = withSubjectColor(s);
    return { name: chip.name, color: chip.color ?? subjectColor(chip.name) };
  });
}

/**
 * Route fallback for 「공부 기록 추가」 (transparentModal + SheetPanel).
 * Subject add/delete lives in Settings only — chips here are select-only.
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
    await syncTodayReviewWidgetSnapshot(next);
  }, []);

  const onSave = useCallback(
    async (payload: AddStudyPayload) => {
      const content = payload.title.trim();
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
      });
      await persist(next);
      haptics.save();
      onClose();
    },
    [appData, persist, onClose],
  );

  return (
    <SheetPanel onClose={onClose}>
      <AddStudyForm subjects={subjects} onSave={onSave} />
    </SheetPanel>
  );
}
