/** AsyncStorage 키 — 저장 로직을 한곳에 모으기 위한 상수. */
export const STORAGE_KEYS = {
  /** subjects · records · schedules (AppData JSON). */
  appData: '@bokbok/app-data/v1',
  /** 'real' | 'dummy' — Home data source mode. */
  dataMode: '@bokbok/data-mode/v1',
  /** Accent primary hex (`#RRGGBB`). */
  themePrimary: '@bokbok/theme-primary/v1',
  /** First-launch tutorial / forgetting-curve intro seen (`'1'`). */
  tutorialSeen: '@bokbok/tutorial-seen/v1',
  /**
   * 포개 today-review widget snapshot JSON (app-side mirror).
   * WidgetKit will read App Group instead — see storage/today-review-widget.ts.
   */
  todayReviewWidget: '@bokbok/today-review-widget/v1',
} as const;
