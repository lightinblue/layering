import type { ReviewIntervalDay } from '@/constants/review';

/** 과목 칩 (이용자가 추가·삭제; 삭제해도 기존 기록은 유지). */
export type SubjectChip = {
  id: string;
  name: string;
  /** Chip fill hex; falls back to name map / gray when missing. */
  color?: string;
};

/** 학습 기록 — 과목, 학습 내용, 학습일. */
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
  /** YYYY-MM-DD (로컬 날짜). */
  studiedOn: string;
  createdAt: string;
};

/** 복습 일정 — 예정일 + 완료 여부. 미완료는 원래 날짜에 고정. */
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
  schedules: ReviewSchedule[];
};
