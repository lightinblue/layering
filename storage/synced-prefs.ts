import type { WeekdayStart } from '@/storage/calendar-prefs';
import {
  DEFAULT_CALENDAR_PREFS,
  normalizeCalendarPrefs,
} from '@/storage/calendar-prefs';
import {
  DEFAULT_PRIMARY,
  isPrimaryOption,
  type PrimaryOption,
} from '@/constants/tokens';

/**
 * Device settings synced via NSUbiquitousKeyValueStore key `prefs`.
 * Subject chip colors stay on `subjects` — not duplicated here.
 */
export type SyncedPrefsBody = {
  weekStartsOn: WeekdayStart;
  /** Accent primary hex when set. */
  themePrimary: PrimaryOption;
};

export type SyncedPrefsPayload = {
  deviceId: string;
  updatedAt: string;
  prefs: SyncedPrefsBody;
};

export const DEFAULT_SYNCED_PREFS: SyncedPrefsBody = {
  weekStartsOn: DEFAULT_CALENDAR_PREFS.weekStartsOn,
  themePrimary: DEFAULT_PRIMARY,
};

function parseIso(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function normalizeSyncedPrefsBody(raw: unknown): SyncedPrefsBody {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SYNCED_PREFS };
  const obj = raw as Record<string, unknown>;
  const cal = normalizeCalendarPrefs({
    weekStartsOn: obj.weekStartsOn,
    monthStartsOn: obj.monthStartsOn,
  });
  const themeRaw =
    typeof obj.themePrimary === 'string' ? obj.themePrimary : undefined;
  return {
    weekStartsOn: cal.weekStartsOn,
    themePrimary:
      themeRaw && isPrimaryOption(themeRaw) ? themeRaw : DEFAULT_PRIMARY,
  };
}

export function parseSyncedPrefsPayload(
  raw: string | null | undefined,
): SyncedPrefsPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SyncedPrefsPayload>;
    if (!parsed || typeof parsed !== 'object') return null;
    const deviceId =
      typeof parsed.deviceId === 'string' ? parsed.deviceId : '';
    const updatedAt =
      typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
    if (!deviceId || !updatedAt) return null;
    return {
      deviceId,
      updatedAt,
      prefs: normalizeSyncedPrefsBody(parsed.prefs),
    };
  } catch {
    return null;
  }
}

/**
 * LWW on `updatedAt`; ties → lexicographically greater `deviceId`
 * (same rule as study/subject merge).
 */
export function mergeSyncedPrefsPayload(
  local: SyncedPrefsPayload | null,
  remote: SyncedPrefsPayload | null,
): SyncedPrefsPayload | null {
  if (!local) return remote;
  if (!remote) return local;
  const localTs = parseIso(local.updatedAt);
  const remoteTs = parseIso(remote.updatedAt);
  if (localTs > remoteTs) return local;
  if (remoteTs > localTs) return remote;
  return local.deviceId >= remote.deviceId ? local : remote;
}

export function buildSyncedPrefsPayload(
  deviceId: string,
  prefs: SyncedPrefsBody,
  now = new Date(),
): SyncedPrefsPayload {
  return {
    deviceId,
    updatedAt: now.toISOString(),
    prefs: normalizeSyncedPrefsBody(prefs),
  };
}
