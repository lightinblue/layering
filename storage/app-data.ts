import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData, ReviewSchedule, StudyRecord, SubjectChip } from '@/types/domain';
import { STORAGE_KEYS } from '@/storage/keys';
import { buildReviewDueDates } from '@/utils/review-schedule';

export const EMPTY_APP_DATA: AppData = {
  subjects: [],
  records: [],
  schedules: [],
};

/** Max study records allowed for a single studiedOn date. */
export const MAX_STUDIES_PER_DAY = 3;

/** Seed chips so add sheet works before user-managed subjects land. */
export const DEFAULT_SUBJECTS: SubjectChip[] = [
  { id: 'sub-bunryu', name: '분류' },
  { id: 'sub-kyoyuk', name: '교육학' },
  { id: 'sub-junggeom', name: '정검' },
];

export function countStudiesOn(data: AppData, dateKey: string): number {
  return data.records.filter((r) => r.studiedOn === dateKey).length;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appData);
  if (!raw) {
    return {
      subjects: [...DEFAULT_SUBJECTS],
      records: [],
      schedules: [],
    };
  }
  try {
    const parsed = JSON.parse(raw) as AppData;
    const subjects =
      parsed.subjects && parsed.subjects.length > 0
        ? parsed.subjects
        : [...DEFAULT_SUBJECTS];
    return {
      subjects,
      records: parsed.records ?? [],
      schedules: parsed.schedules ?? [],
    };
  } catch {
    return {
      subjects: [...DEFAULT_SUBJECTS],
      records: [],
      schedules: [],
    };
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(data));
}

export type CreateStudyInput = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
};

/** Append one study + +1/3/7/15/30/60 review schedules. No-op at daily max. */
export function appendStudyWithReviews(
  data: AppData,
  input: CreateStudyInput,
): AppData {
  if (countStudiesOn(data, input.studiedOn) >= MAX_STUDIES_PER_DAY) {
    return data;
  }

  const existing = data.subjects.find((s) => s.name === input.subjectName);
  const subject: SubjectChip =
    existing ??
    ({
      id: newId('sub'),
      name: input.subjectName,
    } satisfies SubjectChip);

  const memo = input.memo?.trim();
  const record: StudyRecord = {
    id: newId('study'),
    subjectId: subject.id,
    subjectName: subject.name,
    content: input.content,
    ...(memo ? { memo } : {}),
    studiedOn: input.studiedOn,
    createdAt: new Date().toISOString(),
  };

  const schedules: ReviewSchedule[] = buildReviewDueDates(input.studiedOn).map(
    ({ intervalDays, dueOn }) => ({
      id: newId(`rev${intervalDays}`),
      studyRecordId: record.id,
      intervalDays,
      dueOn,
      completed: false,
    }),
  );

  return {
    subjects: existing ? data.subjects : [...data.subjects, subject],
    records: [...data.records, record],
    schedules: [...data.schedules, ...schedules],
  };
}

export function toggleReviewCompleted(
  data: AppData,
  scheduleId: string,
): AppData {
  const now = new Date().toISOString();
  return {
    ...data,
    schedules: data.schedules.map((s) => {
      if (s.id !== scheduleId) return s;
      const completed = !s.completed;
      return {
        ...s,
        completed,
        completedAt: completed ? now : undefined,
      };
    }),
  };
}
