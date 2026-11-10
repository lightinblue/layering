import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

import { ReviewDetailContent } from '@/components/home/ReviewDetailContent';
import { SheetPanel } from '@/components/ui/BottomSheetModal';
import type { HomeReviewStudy } from '@/constants/home-types';

/**
 * Route fallback for review 「자세히」 (transparentModal + SheetPanel).
 */
export default function ReviewDetailSheet() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    subjects?: string;
    interval?: string;
    content?: string;
    studiedOn?: string;
  }>();

  const studies = useMemo((): HomeReviewStudy[] => {
    const names = (params.subjects ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return [];
    const content = params.content?.trim() || '학습 내용';
    const studiedOn = params.studiedOn?.trim() || '';
    return names.map((subjectName) => ({
      subjectName,
      content,
      studiedOn,
    }));
  }, [params.subjects, params.content, params.studiedOn]);

  const intervalLabel =
    params.interval && params.interval.length > 0
      ? `${params.interval}일 전`
      : '복습';

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, [router]);

  return (
    <SheetPanel onClose={onClose}>
      <ReviewDetailContent intervalLabel={intervalLabel} studies={studies} />
    </SheetPanel>
  );
}
