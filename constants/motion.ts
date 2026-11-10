/**
 * Shared motion tokens — snappy with a bit of spring weight.
 * Tuned for Expo Go (Reanimated / RN Animated native driver).
 */

/** Reanimated `withSpring` / `.springify()` configs. */
export const springs = {
  /** Date number, chip select, checkbox — short bounce with weight. */
  snappy: {
    damping: 16,
    stiffness: 320,
    mass: 0.7,
  },
  /** Week cell / swatch settle — slightly softer. */
  soft: {
    damping: 18,
    stiffness: 260,
    mass: 0.85,
  },
  /** Sheet open settle — weighted, little overshoot. */
  sheet: {
    damping: 22,
    stiffness: 280,
    mass: 0.95,
  },
} as const;

/** RN `Animated.spring` configs (BottomSheetModal). */
export const rnSprings = {
  sheetOpen: {
    damping: 22,
    stiffness: 280,
    mass: 0.9,
    overshootClamping: false,
    useNativeDriver: true as const,
  },
  press: {
    damping: 18,
    stiffness: 400,
    mass: 0.6,
    useNativeDriver: true as const,
  },
} as const;

/** Timing durations (ms). */
export const durations = {
  fadeQuick: 90,
  fadeIn: 180,
  fadeOut: 140,
  sheetClose: 200,
  backdropOpen: 220,
  backdropClose: 180,
  monthChange: 220,
  chipShift: 200,
} as const;

/** Max day-pager index delta that still scrolls animated (슈루룩). */
export const JUMP_ANIMATE_MAX_DELTA = 14;
