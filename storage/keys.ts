/** AsyncStorage 키 — 저장 로직을 한곳에 모으기 위한 상수. */
export const STORAGE_KEYS = {
  /** subjects · records · schedules (AppData JSON). */
  appData: '@bokbok/app-data/v1',
  /** 'real' | 'dummy' — Home data source mode. */
  dataMode: '@bokbok/data-mode/v1',
} as const;
