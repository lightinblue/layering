/**
 * 에빙하우스 망각곡선 기반 기본 복습 주기 (학습일 기준 일수).
 */
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 15, 30, 60] as const;

export type ReviewIntervalDay = (typeof REVIEW_INTERVAL_DAYS)[number];
