/** Launch / splash — native plugin + in-app overlay share these values. */
export const LAUNCH = {
  /** White splash plane (symbol sits on transparent/white art). */
  backgroundColor: '#FFFFFF',
  /**
   * Logical px for the centered mark.
   * Keep in sync with expo-splash-screen `imageWidth` in app.json.
   */
  markSize: 140,
  /** Brief hold on the centered symbol before fade-out (no copy). */
  holdMs: 900,
  fadeOutMs: 400,
} as const;

export function launchHoldBeforeFadeMs() {
  return LAUNCH.holdMs;
}
