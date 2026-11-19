import type { ReviewIntervalDay } from '@/constants/review';

/** Per-interval review check state (synced on the study record). */
export type ReviewCheck = {
  done: boolean;
  updatedAt: string;
};

/** 과목 칩 (이용자가 추가·삭제; 삭제해도 기존 기록은 유지). Soft-delete via `deleted`. */
export type SubjectChip = {
  id: string;
  name: string;
  /** Chip fill hex; falls back to name map / gray when missing. */
  color?: string;
  /** Display order (ascending). */
  order: number;
  updatedAt: string;
  /** Soft-delete tombstone for iCloud merge. */
  deleted?: boolean;
};

/** 학습 기록 — 과목, 학습 내용, 학습일 + 복습 체크. */
export type StudyRecord = {
  id: string;
  subjectId: string;
  /** 저장 시점의 과목명 스냅샷 (칩 삭제 후에도 표시용). */
  subjectName: string;
  /** 저장 시점의 칩 색 (삭제 후에도 표시; 없으면 회색). */
  subjectColor?: string;
  content: string;
  /** Optional short memo (may be empty). */
  memo?: string;
  /**
   * YYYY-MM-DD (로컬 날짜). Product/sync “studyDate” — kept as `studiedOn`
   * for existing code paths.
   */
  studiedOn: string;
  /** Review intervals in days (always present; default fixed curve). */
  cycle: ReviewIntervalDay[];
  /** Check state keyed by interval days (string keys in JSON). */
  checks: Record<string, ReviewCheck>;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete tombstone for iCloud merge. */
  deleted?: boolean;
};

/**
 * Local derived review row (not synced). Kept for migration / seed helpers;
 * home UI derives due dates from `studiedOn` + `cycle` + `checks`.
 */
export type ReviewSchedule = {
  id: string;
  studyRecordId: string;
  /** 학습일로부터의 주기(일). */
  intervalDays: ReviewIntervalDay;
  /** YYYY-MM-DD (로컬 날짜). */
  dueOn: string;
  completed: boolean;
  completedAt?: string;
};

/** 기기 로컬에 저장하는 앱 상태. */
export type AppData = {
  subjects: SubjectChip[];
  records: StudyRecord[];
  /** Legacy / local cache — regenerated from records; not pushed to iCloud. */
  schedules: ReviewSchedule[];
};
