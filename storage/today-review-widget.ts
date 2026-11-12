import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';

import { STORAGE_KEYS } from '@/storage/keys';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import {
  buildTodayReviewWidgetSnapshot,
  type TodayReviewWidgetSnapshot,
} from '@/utils/today-review-widget-snapshot';

export type { TodayReviewWidgetSnapshot } from '@/utils/today-review-widget-snapshot';

/**
 * App Group id for 포개 WidgetKit (entitlement in app.json; create the group
 * in Apple Developer before production / TestFlight builds that need it).
 */
export const POOGAE_WIDGET_APP_GROUP_ID = 'group.com.lightinblue.layering.poogae';

/** UserDefaults suite key WidgetKit should read. */
export const POOGAE_WIDGET_SNAPSHOT_KEY = 'todayReviewWidget.v1';

const appGroupStorage = new ExtensionStorage(POOGAE_WIDGET_APP_GROUP_ID);

/**
 * Write snapshot JSON into the App Group UserDefaults suite.
 *
 * Uses `@bacons/apple-targets` ExtensionStorage →
 * `UserDefaults(suiteName: POOGAE_WIDGET_APP_GROUP_ID)`.
 * No-ops on non-iOS and when the native module is missing (Expo Go).
 *
 * WidgetKit step still needs:
 * - Widget extension target with the same App Group entitlement
 * - Swift read: `UserDefaults(suiteName:)?.string(forKey: todayReviewWidget.v1)`
 * - TimelineProvider + UI (reloadTimelines is already called here)
 */
async function writeTodayReviewWidgetSnapshotToAppGroup(
  snapshot: TodayReviewWidgetSnapshot,
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    appGroupStorage.set(
      POOGAE_WIDGET_SNAPSHOT_KEY,
      JSON.stringify(snapshot),
    );
    ExtensionStorage.reloadWidget();
  } catch {
    // Expo Go / missing native module / suite not provisioned — AsyncStorage
    // mirror remains the source of truth for the app process.
  }
}

/**
 * Persist a today-review widget snapshot.
 * AsyncStorage mirror (app) + App Group UserDefaults (widget).
 */
export async function writeTodayReviewWidgetSnapshot(
  snapshot: TodayReviewWidgetSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.todayReviewWidget,
    JSON.stringify(snapshot),
  );
  await writeTodayReviewWidgetSnapshotToAppGroup(snapshot);
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
