/**
 * Shared motion tokens — short, snappy settle; little overshoot.
 * Tuned for Expo Go (Reanimated / RN Animated native driver).
 */

/** Reanimated `withSpring` / `.springify()` configs. */
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

/** RN `Animated.spring` configs (BottomSheetModal). */
export const rnSprings = {
  sheetOpen: {
    damping: 30,
    stiffness: 460,
    mass: 0.65,
    overshootClamping: true,
    useNativeDriver: true as const,
  },
  press: {
    damping: 22,
    stiffness: 520,
    mass: 0.5,
    useNativeDriver: true as const,
  },
} as const;

/** Timing durations (ms). Keep fades ≥~120ms so opacity-only motion reads on device. */
export const durations = {
  fadeQuick: 140,
  fadeIn: 180,
  fadeOut: 140,
  sheetClose: 180,
  backdropOpen: 180,
  backdropClose: 140,
  monthChange: 180,
  chipShift: 180,
} as const;

/** Max day-pager index delta that still scrolls animated (슈루룩). */
export const JUMP_ANIMATE_MAX_DELTA = 7;

/** FlatList paging deceleration — lower = snappier stop. */
export const PAGER_DECELERATION = 0.985;
