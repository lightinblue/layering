import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import ICloudKvs, {
  KVS_CHANGE_REASON,
  type ExternalChangePayload,
} from '@/modules/icloud-kvs';
import {
  loadAppData,
  registerAppDataICloudPush,
  saveAppData,
} from '@/storage/app-data';
import { loadCalendarPrefs, saveCalendarPrefs } from '@/storage/calendar-prefs';
import { getDeviceId } from '@/storage/device-id';
import {
  KVS_KEYS,
  STORAGE_KEYS,
  kvsMonthKey,
  yearMonthFromDateKey,
} from '@/storage/keys';
import {
  buildSyncedPrefsPayload,
  mergeSyncedPrefsPayload,
  parseSyncedPrefsPayload,
  type SyncedPrefsBody,
  type SyncedPrefsPayload,
} from '@/storage/synced-prefs';
import {
  loadThemeId,
  loadThemePrimary,
  saveThemeSelection,
} from '@/storage/theme';
import type { AppData, StudyRecord, SubjectChip } from '@/types/domain';
import { mergeAppData } from '@/utils/icloud-merge';

/** Apple KVS total value quota (bytes). */
export const KVS_QUOTA_BYTES = 1024 * 1024;
/** Stop cloud writes at this fraction of quota. */
export const KVS_WARN_RATIO = 0.8;
export const KVS_WARN_BYTES = Math.floor(KVS_QUOTA_BYTES * KVS_WARN_RATIO);

type SubjectsPayload = {
  deviceId: string;
  subjects: SubjectChip[];
};

type MonthPayload = {
  deviceId: string;
  records: StudyRecord[];
};

let applyingRemote = false;
let started = false;

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return unescape(encodeURIComponent(value)).length;
}

export function estimatePayloadBytes(values: readonly string[]): number {
  return values.reduce((sum, v) => sum + utf8ByteLength(v), 0);
}

function monthKeyForRecord(record: StudyRecord): string {
  return kvsMonthKey(yearMonthFromDateKey(record.studiedOn));
}

function groupRecordsByMonth(
  records: readonly StudyRecord[],
): Map<string, StudyRecord[]> {
  const map = new Map<string, StudyRecord[]>();
  for (const record of records) {
    const key = monthKeyForRecord(record);
    const list = map.get(key) ?? [];
    list.push(record);
    map.set(key, list);
  }
  return map;
}

async function readSubjectsPayload(): Promise<SubjectsPayload | null> {
  const raw = await ICloudKvs.get(KVS_KEYS.subjects);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SubjectsPayload;
  } catch {
    return null;
  }
}

async function readMonthPayload(key: string): Promise<MonthPayload | null> {
  const raw = await ICloudKvs.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MonthPayload;
  } catch {
    return null;
  }
}

async function measureExistingQuotaBytes(
  excludeKeys: ReadonlySet<string>,
): Promise<number> {
  const keys = await ICloudKvs.getAllKeys();
  let total = 0;
  for (const key of keys) {
    if (excludeKeys.has(key)) continue;
    if (
      key !== KVS_KEYS.subjects &&
      key !== KVS_KEYS.prefs &&
      !key.startsWith(KVS_KEYS.monthPrefix)
    ) {
      continue;
    }
    const value = await ICloudKvs.get(key);
    if (value) total += utf8ByteLength(value);
  }
  return total;
}

/**
 * Push local AppData to monthly KVS keys + subjects.
 * Silent no-op when iCloud unavailable / non-iOS / over 80% quota.
 */
export async function pushAppDataToICloud(data: AppData): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (applyingRemote) return;
  if (!ICloudKvs.isICloudAvailable()) return;

  const deviceId = await getDeviceId();
  const subjectsPayload: SubjectsPayload = {
    deviceId,
    subjects: data.subjects,
  };
  const subjectsJson = JSON.stringify(subjectsPayload);
  const monthMap = groupRecordsByMonth(data.records);
  const monthEntries = [...monthMap.entries()].map(([key, records]) => {
    const payload: MonthPayload = { deviceId, records };
    return { key, json: JSON.stringify(payload) };
  });

  const writingKeys = new Set<string>([
    KVS_KEYS.subjects,
    ...monthEntries.map((e) => e.key),
  ]);
  const existingOther = await measureExistingQuotaBytes(writingKeys);
  const writingBytes = estimatePayloadBytes([
    subjectsJson,
    ...monthEntries.map((e) => e.json),
  ]);
  const projected = existingOther + writingBytes;

  if (projected >= KVS_WARN_BYTES) {
    console.warn(
      `[icloud-kvs] quota ≥80% (${projected}/${KVS_QUOTA_BYTES} bytes), sync paused — local-only`,
    );
    return;
  }

  await ICloudKvs.set(KVS_KEYS.subjects, subjectsJson);
  for (const entry of monthEntries) {
    await ICloudKvs.set(entry.key, entry.json);
  }
  await ICloudKvs.synchronize();
}

async function collectRemoteRecords(
  keysHint?: readonly string[],
): Promise<{ records: StudyRecord[]; remoteDeviceId: string }> {
  const allKeys =
    keysHint && keysHint.length > 0
      ? keysHint.filter(
          (k) => k === KVS_KEYS.subjects || k.startsWith(KVS_KEYS.monthPrefix),
        )
      : (await ICloudKvs.getAllKeys()).filter(
          (k) => k === KVS_KEYS.subjects || k.startsWith(KVS_KEYS.monthPrefix),
        );

  const monthKeys = allKeys.filter((k) => k.startsWith(KVS_KEYS.monthPrefix));
  // If hint only had subjects, still need all months for a full merge.
  const keysToRead =
    monthKeys.length > 0
      ? monthKeys
      : (await ICloudKvs.getAllKeys()).filter((k) =>
          k.startsWith(KVS_KEYS.monthPrefix),
        );

  const records: StudyRecord[] = [];
  let remoteDeviceId = '';
  for (const key of keysToRead) {
    const payload = await readMonthPayload(key);
    if (!payload?.records) continue;
    if (payload.deviceId) remoteDeviceId = payload.deviceId;
    records.push(...payload.records);
  }
  return { records, remoteDeviceId };
}

/**
 * Pull KVS subjects + month records, merge into local AppData, save without re-entrant push loop.
 * Returns merged data, or null when iCloud unavailable / nothing to do.
 */
export async function pullAndMergeFromICloud(
  changedKeys?: readonly string[],
): Promise<AppData | null> {
  if (Platform.OS !== 'ios') return null;
  if (!ICloudKvs.isICloudAvailable()) return null;

  const local = await loadAppData();
  const localDeviceId = await getDeviceId();
  const subjectsPayload = await readSubjectsPayload();
  const { records: remoteRecords, remoteDeviceId: monthDeviceId } =
    await collectRemoteRecords(changedKeys);

  const remoteSubjects = subjectsPayload?.subjects ?? [];
  const remoteDeviceId =
    subjectsPayload?.deviceId || monthDeviceId || '';

  if (remoteSubjects.length === 0 && remoteRecords.length === 0) {
    return null;
  }

  const merged = mergeAppData({
    local,
    remoteSubjects,
    remoteRecords,
    localDeviceId,
    remoteDeviceId,
  });

  applyingRemote = true;
  try {
    await saveAppData(merged, { sync: false });
    // Push reconciled union so local-winning fields propagate.
    await pushAppDataToICloud(merged);
  } finally {
    applyingRemote = false;
  }

  return merged;
}

export type ICloudSyncListener = (data: AppData) => void;
export type SyncedPrefsListener = (prefs: SyncedPrefsBody) => void;

const mergedListeners = new Set<ICloudSyncListener>();
const prefsListeners = new Set<SyncedPrefsListener>();
let applyingPrefsRemote = false;

function emitMerged(data: AppData): void {
  for (const listener of mergedListeners) {
    try {
      listener(data);
    } catch (err) {
      console.warn('[icloud-kvs] merge listener error', err);
    }
  }
}

function emitSyncedPrefs(prefs: SyncedPrefsBody): void {
  for (const listener of prefsListeners) {
    try {
      listener(prefs);
    } catch (err) {
      console.warn('[icloud-kvs] prefs listener error', err);
    }
  }
}

/** UI screens subscribe to apply remote merges into React state. */
export function subscribeICloudMerged(listener: ICloudSyncListener): () => void {
  mergedListeners.add(listener);
  return () => {
    mergedListeners.delete(listener);
  };
}

/** Calendar / theme providers subscribe for cross-device prefs. */
export function subscribeSyncedPrefs(
  listener: SyncedPrefsListener,
): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

async function readLocalSyncedPrefsBody(): Promise<SyncedPrefsBody> {
  const [cal, themePrimary, themeId] = await Promise.all([
    loadCalendarPrefs(),
    loadThemePrimary(),
    loadThemeId(),
  ]);
  return {
    weekStartsOn: cal.weekStartsOn,
    themePrimary,
    themeId,
  };
}

async function applySyncedPrefsLocally(
  payload: SyncedPrefsPayload,
): Promise<void> {
  applyingPrefsRemote = true;
  try {
    await saveCalendarPrefs({ weekStartsOn: payload.prefs.weekStartsOn });
    await saveThemeSelection(payload.prefs.themeId);
    await AsyncStorage.setItem(
      STORAGE_KEYS.syncedPrefsUpdatedAt,
      payload.updatedAt,
    );
    emitSyncedPrefs(payload.prefs);
  } finally {
    applyingPrefsRemote = false;
  }
}

async function readRemotePrefsPayload(): Promise<SyncedPrefsPayload | null> {
  const raw = await ICloudKvs.get(KVS_KEYS.prefs);
  return parseSyncedPrefsPayload(raw);
}

async function readLocalPrefsPayload(
  deviceId: string,
): Promise<SyncedPrefsPayload> {
  const body = await readLocalSyncedPrefsBody();
  const stamp =
    (await AsyncStorage.getItem(STORAGE_KEYS.syncedPrefsUpdatedAt)) ||
    '1970-01-01T00:00:00.000Z';
  return {
    deviceId,
    updatedAt: stamp,
    prefs: body,
  };
}

/**
 * Push current local calendar/theme prefs to KVS `prefs` (LWW stamp = now).
 */
export async function pushSyncedPrefsToICloud(
  partial?: Partial<SyncedPrefsBody>,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (applyingPrefsRemote) return;
  if (!ICloudKvs.isICloudAvailable()) return;

  const deviceId = await getDeviceId();
  const current = await readLocalSyncedPrefsBody();
  const nextBody: SyncedPrefsBody = {
    weekStartsOn: partial?.weekStartsOn ?? current.weekStartsOn,
    themePrimary: partial?.themePrimary ?? current.themePrimary,
    themeId: partial?.themeId ?? current.themeId,
  };
  // Persist mirrors first so local stamp + body stay consistent.
  await saveCalendarPrefs({ weekStartsOn: nextBody.weekStartsOn });
  await saveThemeSelection(nextBody.themeId);

  const payload = buildSyncedPrefsPayload(deviceId, nextBody);
  const json = JSON.stringify(payload);

  const existingOther = await measureExistingQuotaBytes(
    new Set([KVS_KEYS.prefs]),
  );
  if (existingOther + utf8ByteLength(json) >= KVS_WARN_BYTES) {
    console.warn('[icloud-kvs] prefs push skipped — quota ≥80%');
    return;
  }

  await ICloudKvs.set(KVS_KEYS.prefs, json);
  await ICloudKvs.synchronize();
  await AsyncStorage.setItem(
    STORAGE_KEYS.syncedPrefsUpdatedAt,
    payload.updatedAt,
  );
}

/**
 * Pull KVS `prefs`, LWW-merge with local mirrors, apply winner, push if needed.
 * First empty-cloud run uploads local AsyncStorage calendar/theme once.
 */
export async function pullAndMergeSyncedPrefs(): Promise<SyncedPrefsBody | null> {
  if (Platform.OS !== 'ios') return null;
  if (!ICloudKvs.isICloudAvailable()) return null;

  const deviceId = await getDeviceId();
  const local = await readLocalPrefsPayload(deviceId);
  const remote = await readRemotePrefsPayload();

  if (!remote) {
    // Migrate local-only prefs into KVS.
    const seed = buildSyncedPrefsPayload(deviceId, local.prefs);
    await ICloudKvs.set(KVS_KEYS.prefs, JSON.stringify(seed));
    await ICloudKvs.synchronize();
    await applySyncedPrefsLocally(seed);
    return seed.prefs;
  }

  // First contact with an existing remote: if local stamp is epoch, treat
  // current AsyncStorage as a "now" candidate so pre-sync user choices can win.
  const localStampIsEpoch = local.updatedAt.startsWith('1970-');
  const localForMerge = localStampIsEpoch
    ? buildSyncedPrefsPayload(deviceId, local.prefs)
    : local;

  const winner = mergeSyncedPrefsPayload(localForMerge, remote) ?? remote;
  await applySyncedPrefsLocally(winner);

  if (
    winner.deviceId !== remote.deviceId ||
    winner.updatedAt !== remote.updatedAt ||
    JSON.stringify(winner.prefs) !== JSON.stringify(remote.prefs)
  ) {
    applyingPrefsRemote = true;
    try {
      await ICloudKvs.set(KVS_KEYS.prefs, JSON.stringify(winner));
      await ICloudKvs.synchronize();
    } finally {
      applyingPrefsRemote = false;
    }
  }

  return winner.prefs;
}

/**
 * Register push hook, synchronize, initial pull, and external-change listener.
 * Safe to call once from root layout. No-ops on non-iOS / missing native module.
 */
export function startICloudSync(): () => void {
  registerAppDataICloudPush(pushAppDataToICloud);

  if (Platform.OS !== 'ios' || started) {
    return () => {};
  }
  started = true;

  void (async () => {
    try {
      await ICloudKvs.synchronize();
      const merged = await pullAndMergeFromICloud();
      if (merged) emitMerged(merged);
      await pullAndMergeSyncedPrefs();
    } catch (err) {
      console.warn('[icloud-kvs] initial sync failed', err);
    }
  })();

  const subscription = ICloudKvs.addListener(
    'onExternalChange',
    (event: ExternalChangePayload) => {
      if (event.reason === KVS_CHANGE_REASON.quotaViolation) {
        console.warn('[icloud-kvs] quota violation from system');
        return;
      }
      void (async () => {
        try {
          const keys = event.keys ?? [];
          const prefsTouched =
            keys.length === 0 || keys.includes(KVS_KEYS.prefs);
          const dataTouched =
            keys.length === 0 ||
            keys.some(
              (k) =>
                k === KVS_KEYS.subjects || k.startsWith(KVS_KEYS.monthPrefix),
            );
          if (dataTouched) {
            const merged = await pullAndMergeFromICloud(event.keys);
            if (merged) emitMerged(merged);
          }
          if (prefsTouched) {
            await pullAndMergeSyncedPrefs();
          }
        } catch (err) {
          console.warn('[icloud-kvs] external merge failed', err);
        }
      })();
    },
  );

  return () => {
    subscription.remove();
    started = false;
  };
}
