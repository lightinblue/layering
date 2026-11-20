/** AsyncStorage 키 — 저장 로직을 한곳에 모으기 위한 상수. */
export const STORAGE_KEYS = {
  /** subjects · records · schedules (AppData JSON). */
  appData: '@bokbok/app-data/v1',
  /** One-shot backup before iCloud schema migration. */
  appDataPreIcloudBackup: '@bokbok/app-data/v1.pre-icloud-backup',
  /** Migration sentinel (`'1'` when iCloud schema migration applied). */
  appDataIcloudMigrated: '@bokbok/app-data/icloud-migrated/v1',
  /** Stable UUID for this install (merge tie-break). */
  deviceId: '@bokbok/device-id/v1',
  /** 'real' | 'dummy' — Home data source mode. */
  dataMode: '@bokbok/data-mode/v1',
  /** Accent primary hex (`#RRGGBB`). */
  themePrimary: '@bokbok/theme-primary/v1',
  /**
   * Calendar week start (`{ weekStartsOn }`) for home strip + month grid.
   * Local mirror; also synced via KVS `prefs` (see storage/synced-prefs.ts).
   */
  calendarPrefs: '@bokbok/calendar-prefs/v1',
  /** Last applied/pushed `SyncedPrefsPayload.updatedAt` (LWW stamp mirror). */
  syncedPrefsUpdatedAt: '@bokbok/synced-prefs-updated-at/v1',
  /** First-launch tutorial / forgetting-curve intro seen (`'1'`). */
  tutorialSeen: '@bokbok/tutorial-seen/v1',
  /**
   * 포개 today-review widget snapshot JSON (app-side mirror).
   * WidgetKit will read App Group instead — see storage/today-review-widget.ts.
   */
  todayReviewWidget: '@bokbok/today-review-widget/v1',
} as const;

/** iCloud KVS key prefixes (NSUbiquitousKeyValueStore). */
export const KVS_KEYS = {
  subjects: 'subjects',
  /** `rec/YYYY-MM` for studies whose studiedOn falls in that month. */
  monthPrefix: 'rec/',
  /**
   * Device settings JSON (`SyncedPrefsPayload`): weekStartsOn, themePrimary.
   * Subject chip colors stay on `subjects`.
   */
  prefs: 'prefs',
} as const;

export function kvsMonthKey(yearMonth: string): string {
  return `${KVS_KEYS.monthPrefix}${yearMonth}`;
}

/** `YYYY-MM` from a `YYYY-MM-DD` studiedOn. */
export function yearMonthFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}
