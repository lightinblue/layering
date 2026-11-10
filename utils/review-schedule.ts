import { REVIEW_INTERVAL_DAYS } from '@/constants/review';
import type { ReviewIntervalDay } from '@/constants/review';

/** YYYY-MM-DD에 days를 더한다 (로컬 달력 기준, UTC 드리프트 방지). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** 학습일 기준 +1/3/7/15/30/60 복습 예정일 목록. */
export function buildReviewDueDates(studiedOn: string): {
  intervalDays: ReviewIntervalDay;
  dueOn: string;
}[] {
  return REVIEW_INTERVAL_DAYS.map((intervalDays) => ({
    intervalDays,
    dueOn: addDays(studiedOn, intervalDays),
  }));
}
