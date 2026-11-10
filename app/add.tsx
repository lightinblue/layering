import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import {
  AddStudyForm,
  type AddStudyPayload,
} from '@/components/home/AddStudyForm';
import { SheetPanel } from '@/components/ui/BottomSheetModal';

/**
 * Route fallback for 「공부 기록 추가」 (transparentModal + SheetPanel).
 * Home empty-state CTA uses an in-screen BottomSheetModal instead.
 */
export default function AddRecordSheet() {
  const router = useRouter();

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  const onSave = useCallback(
    (payload: AddStudyPayload) => {
      console.log('[bokbok] save study (stub)', payload);
      onClose();
      setTimeout(() => {
        Alert.alert('저장됨', `${payload.subject} · ${payload.title}`);
      }, 250);
    },
    [onClose],
  );

  return (
    <SheetPanel onClose={onClose}>
      <AddStudyForm onSave={onSave} />
    </SheetPanel>
  );
}
