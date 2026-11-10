/** Launch / splash screen — native plugin and in-app overlay share these values. */
export const LAUNCH = {
  /** White splash plane (logo mark is blue on transparent). */
  backgroundColor: '#FFFFFF',
  /** Logical px; keep close to expo-splash-screen image size. */
  markSize: 140,
  /** Space between the centered mark and the first copy line. */
  textGap: 8,
  /** Lift logo + copy above true center (px). */
  contentLift: 28,
  /** Logo alone before copy animates in. */
  textRevealDelayMs: 600,
  textRevealDurationMs: 520,
  /** Title → line1 → line2 stagger. */
  taglineStaggerMs: 160,
  /** Hold after the last line finishes entering, before fade-out. */
  holdAfterTextMs: 1500,
  fadeOutMs: 500,
} as const;

export function launchHoldBeforeFadeMs() {
  return (
    LAUNCH.textRevealDelayMs +
    LAUNCH.textRevealDurationMs +
    /** Two stagger steps: title → line1 → line2 */
    LAUNCH.taglineStaggerMs * 2 +
    LAUNCH.holdAfterTextMs
  );
}
