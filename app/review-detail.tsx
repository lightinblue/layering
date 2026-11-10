import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { ReviewDetailContent } from '@/components/home/ReviewDetailContent';
import { SheetPanel } from '@/components/ui/BottomSheetModal';

/**
 * Route fallback for review 「자세히」 (transparentModal + SheetPanel).
 */
export default function ReviewDetailSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    subjects?: string;
    interval?: string;
  }>();

  const subjectNames = useMemo(
    () =>
      (params.subjects ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [params.subjects],
  );

  const intervalLabel =
    params.interval && params.interval.length > 0
      ? `${params.interval}일 전`
      : '복습';

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  return (
    <SheetPanel onClose={onClose}>
      <ReviewDetailContent
        subjectNames={subjectNames}
        intervalLabel={intervalLabel}
      />
    </SheetPanel>
  );
}
