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
import { assignMissingDayBands } from '@/utils/study-timeline';

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
      ...(typeof r.dayOrder === 'number' && Number.isFinite(r.dayOrder)
        ? { dayOrder: r.dayOrder }
        : {}),
      ...(r.dayDone ? { dayDone: true } : {}),
      cycle,
      checks,
      createdAt,
      updatedAt,
      ...(r.deleted ? { deleted: true } : {}),
    };
  });

  const withOrder = ensureDayOrders(records);
  const withBands = ensureDayBands(withOrder);
  return {
    subjects,
    records: withBands,
    schedules: rebuildSchedules(withBands),
  };
}

/** Fill missing dayOrder by createdAt within each studiedOn (stable, ascending). */
export function ensureDayOrders(records: StudyRecord[]): StudyRecord[] {
  const byDay = new Map<string, StudyRecord[]>();
  for (const record of records) {
    const key = record.studiedOn || record.createdAt.slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(record);
    byDay.set(key, list);
  }

  const nextById = new Map<string, StudyRecord>();
  for (const [, list] of byDay) {
    const sorted = [...list].sort((a, b) => {
      const ao = typeof a.dayOrder === 'number' ? a.dayOrder : Number.POSITIVE_INFINITY;
      const bo = typeof b.dayOrder === 'number' ? b.dayOrder : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
    sorted.forEach((record, index) => {
      nextById.set(record.id, {
        ...record,
        dayOrder: typeof record.dayOrder === 'number' ? record.dayOrder : index,
      });
    });
    // Re-pack dense 0..n-1 when any were missing (keeps relative createdAt order).
    if (list.some((r) => typeof r.dayOrder !== 'number')) {
      sorted.forEach((record, index) => {
        nextById.set(record.id, { ...record, dayOrder: index });
      });
    }
  }

  return records.map((r) => nextById.get(r.id) ?? r);
}

/**
 * Persist `dayBand` for active records that lack one, using the legacy
 * capacity fill once. After this, UI partitioning never rebuckets on delete.
 */
export function ensureDayBands(records: StudyRecord[]): StudyRecord[] {
  const byDay = new Map<string, StudyRecord[]>();
  for (const record of records) {
    if (record.deleted) continue;
    const key = record.studiedOn || record.createdAt.slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(record);
    byDay.set(key, list);
  }

  const bandById = new Map<string, 'morning' | 'afternoon' | 'evening'>();
  for (const [, list] of byDay) {
    if (!list.some((r) => !r.dayBand)) continue;
    const rows = list.map((r) => ({
      id: r.id,
      subjectName: r.subjectName,
      content: r.content,
      ...(r.dayBand ? { dayBand: r.dayBand } : {}),
      ...(typeof r.dayOrder === 'number' ? { dayOrder: r.dayOrder } : {}),
      createdAt: r.createdAt,
    }));
    const assigned = assignMissingDayBands(rows);
    for (const [id, band] of assigned) {
      const existing = list.find((r) => r.id === id);
      if (existing && !existing.dayBand) {
        bandById.set(id, band);
      }
    }
  }

  if (bandById.size === 0) return records;
  return records.map((r) => {
    const band = bandById.get(r.id);
    return band ? { ...r, dayBand: band } : r;
  });
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
