import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import {
  buildTodayReviewWidgetSnapshot,
  type TodayReviewWidgetSnapshot,
} from '@/utils/today-review-widget-snapshot';

export type { TodayReviewWidgetSnapshot } from '@/utils/today-review-widget-snapshot';

/**
 * Planned App Group id for 포개 WidgetKit (not provisioned in this Expo Go
 * / managed step — no native ios/ + entitlements yet).
 */
export const POOGAE_WIDGET_APP_GROUP_ID = 'group.com.lightinblue.layering.poogae';

/** UserDefaults / shared-file key WidgetKit should read later. */
export const POOGAE_WIDGET_SNAPSHOT_KEY = 'todayReviewWidget.v1';

/**
 * TODO(포개 WidgetKit / App Group):
 * Write `JSON.stringify(snapshot)` into the App Group container, e.g.
 * `UserDefaults(suiteName: POOGAE_WIDGET_APP_GROUP_ID)` or a shared file under
 * `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`, then call
 * `WidgetCenter.shared.reloadTimelines(ofKind:)`.
 *
 * Managed Expo + Expo Go cannot reach App Group from JS without a custom
 * native module / expo-widgets — stub keeps the write API stable for step 3.
 */
async function writeTodayReviewWidgetSnapshotToAppGroupStub(
  _snapshot: TodayReviewWidgetSnapshot,
): Promise<void> {
  // no-op until App Group + WidgetKit target land
}

/**
 * Persist a today-review widget snapshot.
 * Current path: AsyncStorage mirror + App Group stub (see TODO above).
 */
export async function writeTodayReviewWidgetSnapshot(
  snapshot: TodayReviewWidgetSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.todayReviewWidget,
    JSON.stringify(snapshot),
  );
  await writeTodayReviewWidgetSnapshotToAppGroupStub(snapshot);
}

export async function readTodayReviewWidgetSnapshot(): Promise<TodayReviewWidgetSnapshot | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.todayReviewWidget);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TodayReviewWidgetSnapshot;
  } catch {
    return null;
  }
}

/**
 * Build from AppData and write. Rewrites when `todayKey` would mismatch the
 * device-local today (midnight rollover / stale snapshot).
 */
export async function syncTodayReviewWidgetSnapshot(
  data: AppData,
  now = new Date(),
): Promise<TodayReviewWidgetSnapshot> {
  const snapshot = buildTodayReviewWidgetSnapshot(data, now);
  const existing = await readTodayReviewWidgetSnapshot();
  if (existing && existing.todayKey !== todayKey(now)) {
    // Explicit rewrite path for day rollover (snapshot still rebuilt above).
  }
  await writeTodayReviewWidgetSnapshot(snapshot);
  return snapshot;
}
