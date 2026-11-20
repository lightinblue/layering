import type {
  AppData,
  ReviewCheck,
  StudyRecord,
  SubjectChip,
} from '@/types/domain';

export const SOFT_DELETE_PURGE_DAYS = 180;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIso(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Pick the winning side for the same id.
 * Newer `updatedAt` wins; ties → lexicographically greater `deviceId`.
 */
export function pickWinner<T extends { updatedAt: string }>(
  local: T,
  remote: T,
  localDeviceId: string,
  remoteDeviceId: string,
): T {
  const localTs = parseIso(local.updatedAt);
  const remoteTs = parseIso(remote.updatedAt);
  if (localTs > remoteTs) return local;
  if (remoteTs > localTs) return remote;
  return localDeviceId >= remoteDeviceId ? local : remote;
}

export function mergeChecks(
  local: Record<string, ReviewCheck> | undefined,
  remote: Record<string, ReviewCheck> | undefined,
): Record<string, ReviewCheck> {
  const keys = new Set([
    ...Object.keys(local ?? {}),
    ...Object.keys(remote ?? {}),
  ]);
  const out: Record<string, ReviewCheck> = {};
  for (const key of keys) {
    const a = local?.[key];
    const b = remote?.[key];
    if (a && b) {
      const aTs = parseIso(a.updatedAt);
      const bTs = parseIso(b.updatedAt);
      out[key] = aTs >= bTs ? a : b;
    } else if (a) {
      out[key] = a;
    } else if (b) {
      out[key] = b;
    }
  }
  return out;
}

function mergeStudy(
  local: StudyRecord,
  remote: StudyRecord,
  localDeviceId: string,
  remoteDeviceId: string,
): StudyRecord {
  const base = pickWinner(local, remote, localDeviceId, remoteDeviceId);
  const other = base === local ? remote : local;
  return {
    ...base,
    checks: mergeChecks(local.checks, remote.checks),
    // Prefer winner's scalar fields; keep cycle from winner (always present).
    cycle: base.cycle?.length ? base.cycle : other.cycle,
  };
}

function mergeSubject(
  local: SubjectChip,
  remote: SubjectChip,
  localDeviceId: string,
  remoteDeviceId: string,
): SubjectChip {
  return pickWinner(local, remote, localDeviceId, remoteDeviceId);
}

export function mergeById<T extends { id: string; updatedAt: string }>(
  local: readonly T[],
  remote: readonly T[],
  localDeviceId: string,
  remoteDeviceId: string,
  mergeOne: (a: T, b: T, ld: string, rd: string) => T,
): T[] {
  const map = new Map<string, T>();
  for (const item of local) {
    map.set(item.id, item);
  }
  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    map.set(item.id, mergeOne(existing, item, localDeviceId, remoteDeviceId));
  }
  return [...map.values()];
}

export function isTombstoneExpired(
  updatedAt: string,
  now: Date,
  purgeDays = SOFT_DELETE_PURGE_DAYS,
): boolean {
  const age = now.getTime() - parseIso(updatedAt);
  return age >= purgeDays * MS_PER_DAY;
}

/** Drop soft-deleted rows older than purge window. */
export function purgeExpiredTombstones(
  data: AppData,
  now = new Date(),
): AppData {
  return {
    subjects: data.subjects.filter(
      (s) => !(s.deleted && isTombstoneExpired(s.updatedAt, now)),
    ),
    records: data.records.filter(
      (r) => !(r.deleted && isTombstoneExpired(r.updatedAt, now)),
    ),
    schedules: data.schedules,
  };
}

export type MergeAppDataInput = {
  local: AppData;
  remoteSubjects: SubjectChip[];
  remoteRecords: StudyRecord[];
  localDeviceId: string;
  /** Device id stamped on remote payloads; falls back to empty (local wins ties). */
  remoteDeviceId: string;
  now?: Date;
};

/**
 * Pure merge: union by id, newer updatedAt wins, ties by deviceId,
 * per-interval checks, soft-delete if newest says deleted, then 180-day purge.
 */
export function mergeAppData(input: MergeAppDataInput): AppData {
  const {
    local,
    remoteSubjects,
    remoteRecords,
    localDeviceId,
    remoteDeviceId,
    now = new Date(),
  } = input;

  const subjects = mergeById(
    local.subjects,
    remoteSubjects,
    localDeviceId,
    remoteDeviceId,
    mergeSubject,
  ).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const records = mergeById(
    local.records,
    remoteRecords,
    localDeviceId,
    remoteDeviceId,
    mergeStudy,
  );

  const deduped = dedupeStudyRecords(records, now);

  return purgeExpiredTombstones(
    {
      subjects,
      records: deduped.records,
      schedules: local.schedules,
    },
    now,
  );
}

/** Active (non-deleted) subjects sorted by order. */
export function activeSubjects(subjects: readonly SubjectChip[]): SubjectChip[] {
  return subjects
    .filter((s) => !s.deleted)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

/** Active (non-deleted) study records. */
export function activeRecords(records: readonly StudyRecord[]): StudyRecord[] {
  return records.filter((r) => !r.deleted);
}

/** Fingerprint for content twins (different ids, same day/subject/title). */
export function studyContentKey(record: StudyRecord): string {
  const day = record.studiedOn.trim();
  const subject = record.subjectId.trim();
  const content = record.content.trim();
  return `${day}|${subject}|${content}`;
}

/**
 * Collapse same-id rows (LWW), then soft-delete active content twins.
 * Keeps the newest `updatedAt` (tie → greater id). Preserves existing tombstones.
 */
export function dedupeStudyRecords(
  records: readonly StudyRecord[],
  now = new Date(),
): { records: StudyRecord[]; didChange: boolean } {
  const byId = new Map<string, StudyRecord>();
  let idCollapsed = false;
  for (const record of records) {
    const existing = byId.get(record.id);
    if (existing) {
      idCollapsed = true;
      byId.set(
        record.id,
        pickWinner(existing, record, existing.id, record.id),
      );
    } else {
      byId.set(record.id, record);
    }
  }

  const stamp = now.toISOString();
  const keptActive = new Map<string, StudyRecord>();
  const out: StudyRecord[] = [];
  let tombstoned = false;

  const ordered = [...byId.values()].sort((a, b) => {
    const at = parseIso(a.updatedAt);
    const bt = parseIso(b.updatedAt);
    if (at !== bt) return bt - at;
    return a.id < b.id ? 1 : -1;
  });

  for (const record of ordered) {
    if (record.deleted) {
      out.push(record);
      continue;
    }
    const key = studyContentKey(record);
    if (keptActive.has(key)) {
      out.push({ ...record, deleted: true, updatedAt: stamp });
      tombstoned = true;
    } else {
      keptActive.set(key, record);
      out.push(record);
    }
  }

  return { records: out, didChange: idCollapsed || tombstoned };
}
