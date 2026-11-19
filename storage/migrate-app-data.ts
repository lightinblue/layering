import AsyncStorage from '@react-native-async-storage/async-storage';

import { REVIEW_INTERVAL_DAYS } from '@/constants/review';
import type { ReviewIntervalDay } from '@/constants/review';
import { STORAGE_KEYS } from '@/storage/keys';
import type {
  AppData,
  ReviewCheck,
  ReviewSchedule,
  StudyRecord,
  SubjectChip,
} from '@/types/domain';
import { buildReviewDueDates } from '@/utils/review-schedule';

export const DEFAULT_CYCLE: ReviewIntervalDay[] = [...REVIEW_INTERVAL_DAYS];

type LegacySubject = Partial<SubjectChip> & { id?: string; name?: string };
type LegacyRecord = Partial<StudyRecord> & {
  id?: string;
  studiedOn?: string;
  createdAt?: string;
};
type LegacySchedule = Partial<ReviewSchedule> & {
  studyRecordId?: string;
  intervalDays?: number;
  completed?: boolean;
  completedAt?: string;
};
type LegacyAppData = {
  subjects?: LegacySubject[];
  records?: LegacyRecord[];
  schedules?: LegacySchedule[];
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyChecks(cycle: readonly ReviewIntervalDay[], at: string): Record<string, ReviewCheck> {
  const checks: Record<string, ReviewCheck> = {};
  for (const interval of cycle) {
    checks[String(interval)] = { done: false, updatedAt: at };
  }
  return checks;
}

function checksFromSchedules(
  studyId: string,
  schedules: readonly LegacySchedule[],
  cycle: readonly ReviewIntervalDay[],
  fallbackAt: string,
): Record<string, ReviewCheck> {
  const checks = emptyChecks(cycle, fallbackAt);
  for (const s of schedules) {
    if (s.studyRecordId !== studyId) continue;
    const interval = s.intervalDays;
    if (interval == null) continue;
    const key = String(interval);
    checks[key] = {
      done: Boolean(s.completed),
      updatedAt: s.completedAt ?? fallbackAt,
    };
  }
  return checks;
}

function rebuildSchedules(records: readonly StudyRecord[]): ReviewSchedule[] {
  const schedules: ReviewSchedule[] = [];
  for (const record of records) {
    if (record.deleted) continue;
    const cycle = record.cycle?.length ? record.cycle : DEFAULT_CYCLE;
    for (const { intervalDays, dueOn } of buildReviewDueDates(record.studiedOn)) {
      if (!cycle.includes(intervalDays)) continue;
      const check = record.checks[String(intervalDays)];
      schedules.push({
        id: `rev-${record.id}-${intervalDays}`,
        studyRecordId: record.id,
        intervalDays,
        dueOn,
        completed: Boolean(check?.done),
        ...(check?.done && check.updatedAt
          ? { completedAt: check.updatedAt }
          : {}),
      });
    }
  }
  return schedules;
}

/**
 * Normalize a parsed AppData blob to the iCloud sync schema.
 * Idempotent — safe to run on already-migrated data.
 */
export function normalizeAppData(raw: unknown, now = new Date()): AppData {
  const at = now.toISOString();
  const parsed = (raw ?? {}) as LegacyAppData;
  const legacySchedules = Array.isArray(parsed.schedules) ? parsed.schedules : [];

  const subjects: SubjectChip[] = (Array.isArray(parsed.subjects)
    ? parsed.subjects
    : []
  ).map((s, index) => {
    const id = s.id?.trim() || newId('sub');
    const name = (s.name ?? '').trim() || '과목';
    return {
      id,
      name,
      ...(s.color?.trim() ? { color: s.color.trim() } : {}),
      order: typeof s.order === 'number' ? s.order : index,
      updatedAt: s.updatedAt ?? at,
      ...(s.deleted ? { deleted: true } : {}),
    };
  });

  const records: StudyRecord[] = (Array.isArray(parsed.records)
    ? parsed.records
    : []
  ).map((r) => {
    const id = r.id?.trim() || newId('study');
    const createdAt = r.createdAt ?? at;
    const updatedAt = r.updatedAt ?? createdAt;
    const cycle =
      Array.isArray(r.cycle) && r.cycle.length > 0
        ? (r.cycle as ReviewIntervalDay[])
        : DEFAULT_CYCLE;
    const checks =
      r.checks && typeof r.checks === 'object'
        ? { ...emptyChecks(cycle, updatedAt), ...r.checks }
        : checksFromSchedules(id, legacySchedules, cycle, updatedAt);

    return {
      id,
      subjectId: r.subjectId ?? '',
      subjectName: r.subjectName ?? '',
      ...(r.subjectColor ? { subjectColor: r.subjectColor } : {}),
      content: r.content ?? '',
      ...(r.memo ? { memo: r.memo } : {}),
      studiedOn: r.studiedOn ?? createdAt.slice(0, 10),
      ...(r.dayBand === 'morning' ||
      r.dayBand === 'afternoon' ||
      r.dayBand === 'evening'
        ? { dayBand: r.dayBand }
        : {}),
      cycle,
      checks,
      createdAt,
      updatedAt,
      ...(r.deleted ? { deleted: true } : {}),
    };
  });

  return {
    subjects,
    records,
    schedules: rebuildSchedules(records),
  };
}

export function rebuildSchedulesFromRecords(records: readonly StudyRecord[]): ReviewSchedule[] {
  return rebuildSchedules(records);
}

/**
 * One-shot: backup raw `@bokbok/app-data/v1`, normalize schema, set sentinel.
 * Returns normalized AppData (or null if no stored blob — caller seeds defaults).
 */
export async function migrateAppDataIfNeeded(now = new Date()): Promise<{
  migrated: boolean;
  data: AppData | null;
}> {
  const sentinel = await AsyncStorage.getItem(STORAGE_KEYS.appDataIcloudMigrated);
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appData);

  if (!raw) {
    if (sentinel !== '1') {
      await AsyncStorage.setItem(STORAGE_KEYS.appDataIcloudMigrated, '1');
    }
    return { migrated: false, data: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { migrated: false, data: null };
  }

  if (sentinel === '1') {
    return { migrated: false, data: normalizeAppData(parsed, now) };
  }

  const existingBackup = await AsyncStorage.getItem(
    STORAGE_KEYS.appDataPreIcloudBackup,
  );
  if (!existingBackup) {
    await AsyncStorage.setItem(STORAGE_KEYS.appDataPreIcloudBackup, raw);
  }

  const data = normalizeAppData(parsed, now);
  await AsyncStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(data));
  await AsyncStorage.setItem(STORAGE_KEYS.appDataIcloudMigrated, '1');
  return { migrated: true, data };
}
