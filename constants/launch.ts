/** Launch / splash screen — native plugin and in-app overlay share these values. */
export const LAUNCH = {
  /** White splash plane (logo mark is blue on transparent). */
  backgroundColor: '#FFFFFF',
  /** Logical px; keep close to expo-splash-screen image size. */
  markSize: 140,
  /** Space between the centered mark and the first copy line. */
  textGap: 8,
  /** Logo alone before copy animates in. */
  textRevealDelayMs: 600,
  textRevealDurationMs: 520,
  /** Second line follows the first slightly. */
  taglineStaggerMs: 160,
  /** Hold after the second line finishes entering, before fade-out. */
  holdAfterTextMs: 1100,
  fadeOutMs: 500,
} as const;

export function launchHoldBeforeFadeMs() {
  return (
    LAUNCH.textRevealDelayMs +
    LAUNCH.textRevealDurationMs +
    LAUNCH.taglineStaggerMs +
    LAUNCH.holdAfterTextMs
  );
}
