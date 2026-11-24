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
 * Constants kept for parity with the native module. Widget / App Group
 * writes are iOS-only — web persists the AsyncStorage mirror only.
 */
export const POGAE_WIDGET_APP_GROUP_ID =
  'group.com.lightinblue.layering.poogae';

export const POGAE_WIDGET_SNAPSHOT_KEY = 'todayReviewWidget.v1';

export const POGAE_WIDGET_KIND = 'TodayReviewWidget';

/**
 * Persist a today-review widget snapshot (AsyncStorage only on web).
 * Home Screen widgets / App Groups are out of scope for the browser.
 */
export async function writeTodayReviewWidgetSnapshot(
  snapshot: TodayReviewWidgetSnapshot,
): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.todayReviewWidget,
    JSON.stringify(snapshot),
  );
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

export async function syncTodayReviewWidgetSnapshot(
  data: AppData,
  now = new Date(),
): Promise<TodayReviewWidgetSnapshot> {
  const snapshot = buildTodayReviewWidgetSnapshot(data, now);
  const existing = await readTodayReviewWidgetSnapshot();
  if (existing && existing.todayKey !== todayKey(now)) {
    // Day rollover — snapshot still rebuilt above.
  }
  await writeTodayReviewWidgetSnapshot(snapshot);
  return snapshot;
}
