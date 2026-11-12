import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SUBJECT_COLOR_OPTIONS,
  colors,
  subjectColor,
} from '@/constants/tokens';
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

/** Max user-managed subject chips (FR-A3). */
export const MAX_SUBJECTS = 10;

/** Max characters for a subject chip name (enforced on add). */
export const MAX_SUBJECT_NAME_LENGTH = 4;

/** Seed chip for first real-mode load (palette blue). */
export const DEFAULT_SUBJECTS: SubjectChip[] = [
  { id: 'sub-jeongong', name: '전공', color: colors.chipBlue },
];

/** Normalize / fill missing chip colors from the name map. */
export function withSubjectColor(chip: SubjectChip): SubjectChip {
  const color = chip.color?.trim() || subjectColor(chip.name);
  return color === chip.color ? chip : { ...chip, color };
}

export function subjectColorMap(
  subjects: readonly SubjectChip[] | readonly { name: string; color?: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of subjects) {
    map[s.name] = s.color?.trim() || subjectColor(s.name);
  }
  return map;
}

function normalizeSubjectColor(raw?: string): string {
  const hex = raw?.trim().toLowerCase();
  if (hex && /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) {
    if (hex.length === 4) {
      return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    return hex;
  }
  return SUBJECT_COLOR_OPTIONS[0] ?? colors.chipBlue;
}

export function countStudiesOn(data: AppData, dateKey: string): number {
  return data.records.filter((r) => r.studiedOn === dateKey).length;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type SubjectMutationResult =
  | { ok: true; data: AppData }
  | {
      ok: false;
      reason: 'empty' | 'duplicate' | 'limit' | 'missing' | 'tooLong';
    };

/** Normalize a chip label; empty → null. Does not truncate. */
export function normalizeSubjectName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length > 0 ? name : null;
}

/**
 * Append a subject chip. Does not touch records/schedules.
 * Caps at MAX_SUBJECTS; rejects empty / duplicate / overlong names.
 */
export function addSubject(
  data: AppData,
  rawName: string,
  rawColor?: string,
): SubjectMutationResult {
  const name = normalizeSubjectName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  if (name.length > MAX_SUBJECT_NAME_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  if (data.subjects.some((s) => s.name === name)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (data.subjects.length >= MAX_SUBJECTS) {
    return { ok: false, reason: 'limit' };
  }
  return {
    ok: true,
    data: {
      ...data,
      subjects: [
        ...data.subjects,
        { id: newId('sub'), name, color: normalizeSubjectColor(rawColor) },
      ],
    },
  };
}

/**
 * Remove a subject chip by name. Records/schedules that used it stay
 * (subjectName snapshot on StudyRecord keeps display).
 */
export function removeSubject(
  data: AppData,
  rawName: string,
): SubjectMutationResult {
  const name = normalizeSubjectName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  if (!data.subjects.some((s) => s.name === name)) {
    return { ok: false, reason: 'missing' };
  }
  return {
    ok: true,
    data: {
      ...data,
      subjects: data.subjects.filter((s) => s.name !== name),
    },
  };
}

/**
 * Reorder subject chips by name list. Unknown names are skipped; any chips
 * missing from orderedNames are appended in prior order.
 */
export function reorderSubjects(
  data: AppData,
  orderedNames: readonly string[],
): SubjectMutationResult {
  if (data.subjects.length === 0) return { ok: false, reason: 'missing' };
  const byName = new Map(data.subjects.map((s) => [s.name, s]));
  const next: SubjectChip[] = [];
  const seen = new Set<string>();
  for (const raw of orderedNames) {
    const name = normalizeSubjectName(raw);
    if (!name || seen.has(name)) continue;
    const chip = byName.get(name);
    if (!chip) continue;
    next.push(chip);
    seen.add(name);
  }
  for (const chip of data.subjects) {
    if (!seen.has(chip.name)) next.push(chip);
  }
  if (next.length !== data.subjects.length) {
    return { ok: false, reason: 'missing' };
  }
  const unchanged = next.every((chip, i) => chip.id === data.subjects[i]?.id);
  if (unchanged) return { ok: true, data };
  return { ok: true, data: { ...data, subjects: next } };
}

export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appData);
  if (!raw) {
    // First launch only — seed a starter chip. An explicit empty list is kept.
    return {
      subjects: [...DEFAULT_SUBJECTS],
      records: [],
      schedules: [],
    };
  }
  try {
    const parsed = JSON.parse(raw) as AppData;
    const subjects = Array.isArray(parsed.subjects)
      ? parsed.subjects.map(withSubjectColor)
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

  // Prefer chip list; if chip was deleted, still allow save via name snapshot
  // without re-adding the subject (FR-A3: delete chip ≠ delete history).
  const existing = data.subjects.find((s) => s.name === input.subjectName);
  const subjectId = existing?.id ?? newId('sub');
  const subjectName = input.subjectName;

  const memo = input.memo?.trim();
  const record: StudyRecord = {
    id: newId('study'),
    subjectId,
    subjectName,
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
    subjects: data.subjects,
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

/** Remove one study and every review schedule generated from it. */
export function deleteStudyWithReviews(
  data: AppData,
  studyId: string,
): AppData {
  if (!data.records.some((r) => r.id === studyId)) return data;
  return {
    ...data,
    records: data.records.filter((r) => r.id !== studyId),
    schedules: data.schedules.filter((s) => s.studyRecordId !== studyId),
  };
}

export type UpdateStudyInput = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
};

/**
 * Update a study record. Content/subject/memo edits keep due dates.
 * studiedOn change regenerates +1/3/7/15/30/60 schedules (completion
 * preserved per interval when possible). Honors daily max on the target day.
 */
export function updateStudyWithReviews(
  data: AppData,
  studyId: string,
  input: UpdateStudyInput,
): AppData {
  const existing = data.records.find((r) => r.id === studyId);
  if (!existing) return data;

  const studiedOnChanged = existing.studiedOn !== input.studiedOn;
  if (studiedOnChanged) {
    const othersOnTarget = data.records.filter(
      (r) => r.studiedOn === input.studiedOn && r.id !== studyId,
    ).length;
    if (othersOnTarget >= MAX_STUDIES_PER_DAY) return data;
  }

  const chip = data.subjects.find((s) => s.name === input.subjectName);
  const memo = input.memo?.trim();
  const nextRecord: StudyRecord = {
    id: existing.id,
    subjectId: chip?.id ?? existing.subjectId,
    subjectName: input.subjectName,
    content: input.content,
    studiedOn: input.studiedOn,
    createdAt: existing.createdAt,
    ...(memo ? { memo } : {}),
  };

  const records = data.records.map((r) =>
    r.id === studyId ? nextRecord : r,
  );

  if (!studiedOnChanged) {
    return { ...data, records };
  }

  const oldForStudy = data.schedules.filter((s) => s.studyRecordId === studyId);
  const completionByInterval = new Map(
    oldForStudy.map((s) => [
      s.intervalDays,
      { completed: s.completed, completedAt: s.completedAt },
    ]),
  );
  const otherSchedules = data.schedules.filter(
    (s) => s.studyRecordId !== studyId,
  );
  const regenerated: ReviewSchedule[] = buildReviewDueDates(
    input.studiedOn,
  ).map(({ intervalDays, dueOn }) => {
    const prev = completionByInterval.get(intervalDays);
    const reuseId = oldForStudy.find((s) => s.intervalDays === intervalDays)?.id;
    return {
      id: reuseId ?? newId(`rev${intervalDays}`),
      studyRecordId: studyId,
      intervalDays,
      dueOn,
      completed: prev?.completed ?? false,
      ...(prev?.completed && prev.completedAt
        ? { completedAt: prev.completedAt }
        : {}),
    };
  });

  return {
    ...data,
    records,
    schedules: [...otherSchedules, ...regenerated],
  };
}
