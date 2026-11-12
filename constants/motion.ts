/**
 * Shared motion tokens — soft ease-out settle (~300–450ms).
 * Matches date header / week selection pill language.
 * Tuned for Expo Go (Reanimated / RN Animated native driver).
 */

/** Canonical ease-out settle duration (date header / week pill). */
export const EASE_OUT_MS = 380;

/** Reanimated `withSpring` / `.springify()` configs (legacy; prefer easeOutTiming). */
export const springs = {
  /** FAB press, swatch select, calendar focus — quick pulse, barely bouncy. */
  snappy: {
    damping: 24,
    stiffness: 520,
    mass: 0.5,
  },
  /** Week cell / swatch settle — slightly softer, still short. */
  soft: {
    damping: 26,
    stiffness: 420,
    mass: 0.6,
  },
  /** Sheet open settle — weighted but short; no floaty overshoot. */
  sheet: {
    damping: 30,
    stiffness: 460,
    mass: 0.65,
  },
} as const;

/** RN `Animated.spring` configs (legacy press feedback). */
export const rnSprings = {
  press: {
    damping: 22,
    stiffness: 520,
    mass: 0.5,
    useNativeDriver: true as const,
  },
} as const;

/** Timing durations (ms). Primary UI settles use EASE_OUT_MS (~380). */
export const durations = {
  fadeQuick: 140,
  fadeIn: 180,
  fadeOut: 140,
  /** Review checkbox / card accent fill. */
  fill: EASE_OUT_MS,
  /** Calendar FAB ↔ today-arrow icon crossfade. */
  crossfade: EASE_OUT_MS,
  /** Date header + week selection pill (ease-out slide). */
  dateShift: EASE_OUT_MS,
  /** FAB press scale (ease-out, no spring). */
  press: 300,
  /** Bottom sheet slide open. */
  sheetOpen: EASE_OUT_MS,
  /** Bottom sheet slide close. */
  sheetClose: 340,
  backdropOpen: EASE_OUT_MS,
  backdropClose: 300,
  monthChange: EASE_OUT_MS,
  chipShift: EASE_OUT_MS,
  /** Study row appear / remove height. */
  listRow: 340,
} as const;

/** Max day-pager index delta that still scrolls animated (슈루룩). */
export const JUMP_ANIMATE_MAX_DELTA = 7;

/**
 * FlatList paging deceleration — softer settle to echo ease-out
 * (1 = default iOS; lower = snappier stop).
 */
export const PAGER_DECELERATION = 0.992;
