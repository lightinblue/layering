import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SUBJECT_COLOR_OPTIONS,
  colors,
  subjectColor,
} from '@/constants/tokens';
import type { ReviewIntervalDay } from '@/constants/review';
import type {
  AppData,
  ReviewCheck,
  StudyRecord,
  SubjectChip,
} from '@/types/domain';
import { STORAGE_KEYS } from '@/storage/keys';
import {
  DEFAULT_CYCLE,
  migrateAppDataIfNeeded,
  normalizeAppData,
  rebuildSchedulesFromRecords,
} from '@/storage/migrate-app-data';
import {
  activeRecords,
  activeSubjects,
  dedupeStudyRecords,
} from '@/utils/icloud-merge';
import { buildReviewDueDates } from '@/utils/review-schedule';

export const EMPTY_APP_DATA: AppData = {
  subjects: [],
  records: [],
  schedules: [],
};

/** Max study records allowed for a single studiedOn date. */
export const MAX_STUDIES_PER_DAY = 14;

/** Max user-managed subject chips (FR-A3). */
export const MAX_SUBJECTS = 10;

/** Max characters for a subject chip name (enforced on add). */
export const MAX_SUBJECT_NAME_LENGTH = 4;

/** Max characters for study 「학습 내용」(title). */
export const MAX_STUDY_TITLE_LENGTH = 40;

/** Max characters for study memo. */
export const MAX_STUDY_MEMO_LENGTH = 120;

/**
 * Trim + clamp title/memo on persist (legacy over-long edits; seed/import).
 * Empty title → content ''. UI blocks save when trim is empty.
 */
export function clampStudyFields(content: string, memo?: string): {
  content: string;
  memo?: string;
} {
  const nextContent = content.trim().slice(0, MAX_STUDY_TITLE_LENGTH);
  const nextMemo = memo?.trim().slice(0, MAX_STUDY_MEMO_LENGTH);
  return {
    content: nextContent,
    ...(nextMemo ? { memo: nextMemo } : {}),
  };
}

function snapshotSubjectColor(
  data: AppData,
  subjectName: string,
  previous?: string,
): string | undefined {
  const chip = activeSubjects(data.subjects).find((s) => s.name === subjectName);
  if (chip) return withSubjectColor(chip).color;
  const prev = previous?.trim();
  return prev || undefined;
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function emptyChecks(
  cycle: readonly ReviewIntervalDay[],
  at: string,
): Record<string, ReviewCheck> {
  const checks: Record<string, ReviewCheck> = {};
  for (const interval of cycle) {
    checks[String(interval)] = { done: false, updatedAt: at };
  }
  return checks;
}

function withSchedules(data: Omit<AppData, 'schedules'> | AppData): AppData {
  return {
    subjects: data.subjects,
    records: data.records,
    schedules: rebuildSchedulesFromRecords(data.records),
  };
}

/** Seed chip for first real-mode load (palette blue). */
export const DEFAULT_SUBJECTS: SubjectChip[] = [
  {
    id: 'sub-jeongong',
    name: '전공',
    color: colors.chipBlue,
    order: 0,
    updatedAt: '1970-01-01T00:00:00.000Z',
  },
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
  return activeRecords(data.records).filter((r) => r.studiedOn === dateKey)
    .length;
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
  now = new Date(),
): SubjectMutationResult {
  const name = normalizeSubjectName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  if (name.length > MAX_SUBJECT_NAME_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  const live = activeSubjects(data.subjects);
  if (live.some((s) => s.name === name)) {
    return { ok: false, reason: 'duplicate' };
  }
  if (live.length >= MAX_SUBJECTS) {
    return { ok: false, reason: 'limit' };
  }
  const at = nowIso(now);
  const maxOrder = live.reduce((m, s) => Math.max(m, s.order), -1);
  return {
    ok: true,
    data: withSchedules({
      ...data,
      subjects: [
        ...data.subjects,
        {
          id: newId('sub'),
          name,
          color: normalizeSubjectColor(rawColor),
          order: maxOrder + 1,
          updatedAt: at,
        },
      ],
    }),
  };
}

/**
 * Soft-delete a subject chip by name. Records that used it stay
 * (subjectName + subjectColor snapshots keep display colors).
 * Backfills missing record.subjectColor from the chip before tombstoning
 * so home/day chips do not fall through to gray.
 */
export function removeSubject(
  data: AppData,
  rawName: string,
  now = new Date(),
): SubjectMutationResult {
  const name = normalizeSubjectName(rawName);
  if (!name) return { ok: false, reason: 'empty' };
  const live = activeSubjects(data.subjects).find((s) => s.name === name);
  if (!live) {
    return { ok: false, reason: 'missing' };
  }
  const at = nowIso(now);
  const snapColor = withSubjectColor(live).color;
  return {
    ok: true,
    data: withSchedules({
      ...data,
      subjects: data.subjects.map((s) =>
        !s.deleted && s.name === name
          ? { ...s, deleted: true, updatedAt: at }
          : s,
      ),
      records: data.records.map((r) => {
        if (r.deleted || r.subjectName !== name) return r;
        if (r.subjectColor?.trim()) return r;
        return {
          ...r,
          ...(snapColor ? { subjectColor: snapColor } : {}),
          updatedAt: at,
        };
      }),
    }),
  };
}

/**
 * Reorder subject chips by name list. Unknown names are skipped; any chips
 * missing from orderedNames are appended in prior order.
 */
export function reorderSubjects(
  data: AppData,
  orderedNames: readonly string[],
  now = new Date(),
): SubjectMutationResult {
  const live = activeSubjects(data.subjects);
  if (live.length === 0) return { ok: false, reason: 'missing' };
  const byName = new Map(live.map((s) => [s.name, s]));
  const nextLive: SubjectChip[] = [];
  const seen = new Set<string>();
  for (const raw of orderedNames) {
    const name = normalizeSubjectName(raw);
    if (!name || seen.has(name)) continue;
    const chip = byName.get(name);
    if (!chip) continue;
    nextLive.push(chip);
    seen.add(name);
  }
  for (const chip of live) {
    if (!seen.has(chip.name)) nextLive.push(chip);
  }
  if (nextLive.length !== live.length) {
    return { ok: false, reason: 'missing' };
  }
  const at = nowIso(now);
  const orderById = new Map(nextLive.map((chip, i) => [chip.id, i]));
  const unchanged = nextLive.every(
    (chip, i) => chip.id === live[i]?.id && chip.order === i,
  );
  if (unchanged) return { ok: true, data };
  return {
    ok: true,
    data: withSchedules({
      ...data,
      subjects: data.subjects.map((s) => {
        if (s.deleted) return s;
        const order = orderById.get(s.id);
        if (order == null) return s;
        if (s.order === order) return s;
        return { ...s, order, updatedAt: at };
      }),
    }),
  };
}

async function finalizeLoadedAppData(data: AppData): Promise<AppData> {
  const colored: AppData = {
    subjects: data.subjects.map(withSubjectColor),
    records: data.records,
    schedules: data.schedules,
  };
  const { records, didChange } = dedupeStudyRecords(colored.records);
  if (!didChange) return colored;
  const next: AppData = { ...colored, records };
  // Persist + push tombstones so Mac/KVS drop content twins (sync default).
  await saveAppData(next);
  return next;
}

export async function loadAppData(): Promise<AppData> {
  const { data: migrated } = await migrateAppDataIfNeeded();
  if (migrated) {
    return finalizeLoadedAppData({
      subjects: migrated.subjects,
      records: migrated.records,
      schedules: migrated.schedules,
    });
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appData);
  if (!raw) {
    const at = nowIso();
    return {
      subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s, updatedAt: at })),
      records: [],
      schedules: [],
    };
  }
  try {
    const normalized = normalizeAppData(JSON.parse(raw));
    return finalizeLoadedAppData(normalized);
  } catch {
    const at = nowIso();
    return {
      subjects: DEFAULT_SUBJECTS.map((s) => ({ ...s, updatedAt: at })),
      records: [],
      schedules: [],
    };
  }
}

export type SaveAppDataOptions = {
  /** When false, skip iCloud push (used after remote merge). Default true. */
  sync?: boolean;
};

let pushToICloud:
  | ((data: AppData) => Promise<void>)
  | null = null;

/** Wired from storage/icloud-sync to avoid a circular import at module load. */
export function registerAppDataICloudPush(
  fn: (data: AppData) => Promise<void>,
): void {
  pushToICloud = fn;
}

export async function saveAppData(
  data: AppData,
  options?: SaveAppDataOptions,
): Promise<void> {
  const normalized = withSchedules(data);
  await AsyncStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(normalized));
  if (options?.sync === false) return;
  if (pushToICloud) {
    try {
      await pushToICloud(normalized);
    } catch (err) {
      console.warn('[icloud-kvs] push after save failed', err);
    }
  }
}

export type CreateStudyInput = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
  /** Optional study-day band (morning / afternoon / evening). */
  dayBand?: 'morning' | 'afternoon' | 'evening';
};

/** Append one study + checks for cycle intervals. No-op at daily max. */
export function appendStudyWithReviews(
  data: AppData,
  input: CreateStudyInput,
  now = new Date(),
): AppData {
  if (countStudiesOn(data, input.studiedOn) >= MAX_STUDIES_PER_DAY) {
    return data;
  }

  const fields = clampStudyFields(input.content, input.memo);
  if (!fields.content) return data;

  const existing = activeSubjects(data.subjects).find(
    (s) => s.name === input.subjectName,
  );
  if (!existing) return data;

  const at = nowIso(now);
  const cycle = DEFAULT_CYCLE;
  const sameDay = activeRecords(data.records).filter(
    (r) => r.studiedOn === input.studiedOn,
  );
  const maxOrder = sameDay.reduce(
    (max, r) => Math.max(max, typeof r.dayOrder === 'number' ? r.dayOrder : -1),
    -1,
  );
  const record: StudyRecord = {
    id: newId('study'),
    subjectId: existing.id,
    subjectName: input.subjectName,
    ...(snapshotSubjectColor(data, input.subjectName)
      ? { subjectColor: snapshotSubjectColor(data, input.subjectName) }
      : {}),
    content: fields.content,
    ...(fields.memo ? { memo: fields.memo } : {}),
    studiedOn: input.studiedOn,
    ...(input.dayBand ? { dayBand: input.dayBand } : {}),
    dayOrder: maxOrder + 1,
    cycle,
    checks: emptyChecks(cycle, at),
    createdAt: at,
    updatedAt: at,
  };

  return withSchedules({
    subjects: data.subjects,
    records: [...data.records, record],
  });
}

/**
 * Persist a new display order for studies on one day (ascending dayOrder).
 * `orderedIds` should list every active study id for that day in visual order.
 */
export function reorderStudiesOnDay(
  data: AppData,
  studiedOn: string,
  orderedIds: readonly string[],
  now = new Date(),
): AppData {
  const at = nowIso(now);
  const activeIds = new Set(
    activeRecords(data.records)
      .filter((r) => r.studiedOn === studiedOn)
      .map((r) => r.id),
  );
  if (orderedIds.length === 0 || orderedIds.some((id) => !activeIds.has(id))) {
    return data;
  }
  if (orderedIds.length !== activeIds.size) {
    return data;
  }
  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  return withSchedules({
    subjects: data.subjects,
    records: data.records.map((r) => {
      const nextOrder = orderById.get(r.id);
      if (nextOrder === undefined) return r;
      if (r.dayOrder === nextOrder) return r;
      return { ...r, dayOrder: nextOrder, updatedAt: at };
    }),
  });
}

/** Toggle a single study's check for an interval (source of truth). */
export function toggleReviewCheck(
  data: AppData,
  studyId: string,
  intervalDays: number,
  now = new Date(),
): AppData {
  const at = nowIso(now);
  let changed = false;
  const records = data.records.map((r) => {
    if (r.id !== studyId || r.deleted) return r;
    const key = String(intervalDays);
    const prev = r.checks[key];
    const done = !prev?.done;
    changed = true;
    return {
      ...r,
      updatedAt: at,
      checks: {
        ...r.checks,
        [key]: { done, updatedAt: at },
      },
    };
  });
  if (!changed) return data;
  return withSchedules({ ...data, records });
}

/**
 * @deprecated Prefer `toggleReviewCheck(studyId, intervalDays)`.
 * Parses synthetic `${studyId}#${interval}` ids used by home cards.
 */
export function toggleReviewCompleted(
  data: AppData,
  scheduleId: string,
  now = new Date(),
): AppData {
  const hash = scheduleId.indexOf('#');
  if (hash > 0) {
    const studyId = scheduleId.slice(0, hash);
    const interval = Number(scheduleId.slice(hash + 1));
    if (studyId && Number.isFinite(interval)) {
      return toggleReviewCheck(data, studyId, interval, now);
    }
  }
  // Legacy schedule id path — update matching local schedule + checks.
  const schedule = data.schedules.find((s) => s.id === scheduleId);
  if (!schedule) return data;
  return toggleReviewCheck(
    data,
    schedule.studyRecordId,
    schedule.intervalDays,
    now,
  );
}

/** Soft-delete one study (keeps tombstone for iCloud merge). */
export function deleteStudyWithReviews(
  data: AppData,
  studyId: string,
  now = new Date(),
): AppData {
  if (!data.records.some((r) => r.id === studyId && !r.deleted)) return data;
  const at = nowIso(now);
  return withSchedules({
    ...data,
    records: data.records.map((r) =>
      r.id === studyId ? { ...r, deleted: true, updatedAt: at } : r,
    ),
  });
}

export type UpdateStudyInput = {
  subjectName: string;
  content: string;
  studiedOn: string;
  memo?: string;
};

/**
 * Update a study record. Content/subject/memo edits keep checks.
 * studiedOn change regenerates due dates via cycle (completion preserved).
 */
export function updateStudyWithReviews(
  data: AppData,
  studyId: string,
  input: UpdateStudyInput,
  now = new Date(),
): AppData {
  const existing = data.records.find((r) => r.id === studyId && !r.deleted);
  if (!existing) return data;

  const studiedOnChanged = existing.studiedOn !== input.studiedOn;
  if (studiedOnChanged) {
    const othersOnTarget = activeRecords(data.records).filter(
      (r) => r.studiedOn === input.studiedOn && r.id !== studyId,
    ).length;
    if (othersOnTarget >= MAX_STUDIES_PER_DAY) return data;
  }

  const fields = clampStudyFields(input.content, input.memo);
  if (!fields.content) return data;

  const chip = activeSubjects(data.subjects).find(
    (s) => s.name === input.subjectName,
  );
  const subjectColorSnap = snapshotSubjectColor(
    data,
    input.subjectName,
    existing.subjectColor,
  );
  const at = nowIso(now);
  const cycle = existing.cycle?.length ? existing.cycle : DEFAULT_CYCLE;

  // Ensure checks cover cycle intervals.
  const checks = { ...emptyChecks(cycle, at), ...existing.checks };

  // Memo UX removed — preserve existing when callers omit memo (ignore-OK migrate).
  const nextMemo =
    input.memo !== undefined ? fields.memo : existing.memo?.trim();

  const nextRecord: StudyRecord = {
    id: existing.id,
    subjectId: chip?.id ?? existing.subjectId,
    subjectName: input.subjectName,
    ...(subjectColorSnap ? { subjectColor: subjectColorSnap } : {}),
    content: fields.content,
    studiedOn: input.studiedOn,
    cycle,
    checks,
    createdAt: existing.createdAt,
    updatedAt: at,
    ...(nextMemo ? { memo: nextMemo } : {}),
  };

  return withSchedules({
    ...data,
    records: data.records.map((r) => (r.id === studyId ? nextRecord : r)),
  });
}

/** @internal test helper — expose due-date builder usage */
export function dueDatesForStudy(studiedOn: string) {
  return buildReviewDueDates(studiedOn);
}
