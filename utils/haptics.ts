/**
 * App-wide haptic vocabulary — playful, intentional patterns per action.
 * Silently no-ops when the engine is missing (web without vibrate, simulator, etc.).
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const CAN_HAPTIC =
  Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web';

function run(task: () => Promise<void>): void {
  if (!CAN_HAPTIC) return;
  void task().catch(() => {
    // Missing Taptic / Vibrator / Vibration API — ignore.
  });
}

/** Primitives */
export function hapticLight(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticMedium(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticHeavy(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
}

export function hapticSoft(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}

export function hapticRigid(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

export function hapticSelection(): void {
  run(() => Haptics.selectionAsync());
}

export function hapticSuccess(): void {
  run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function hapticWarning(): void {
  run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}

export function hapticError(): void {
  run(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}

/** Semantic actions — prefer these at call sites. */
export const haptics = {
  /** Day pager swipe settle. */
  daySwipe: hapticSoft,
  /** Week strip page change. */
  weekPage: hapticLight,
  /** Jump back to today. */
  todayJump: hapticMedium,
  /** Open a sheet / form. */
  sheetOpen: hapticLight,
  /** Close a sheet (backdrop / dismiss). */
  sheetClose: hapticSoft,
  /** Persist study / subject. */
  save: hapticSuccess,
  /** Confirm destructive delete. */
  delete: hapticWarning,
  /** Review check → done. */
  checkOn: hapticSuccess,
  /** Review check → undo. */
  checkOff: hapticSoft,
  /** Pick a day / subject / mode. */
  select: hapticSelection,
  /** Confirm adding a subject chip. */
  subjectAdd: hapticSuccess,
  /** Long-press starts subject reorder. */
  subjectReorderStart: hapticMedium,
  /** Chip shifts while dragging. */
  subjectReorderTick: hapticSelection,
  /** Arm / confirm subject delete X. */
  subjectDelete: hapticWarning,
  /** Open month calendar. */
  calendarOpen: hapticMedium,
  /** Prev / next month. */
  monthChange: hapticLight,
  /** Theme accent swatch. */
  themePick: hapticSelection,
  /** Settings FAB. */
  settings: hapticLight,
  /** Generic FAB / primary tap. */
  fab: hapticLight,
  /** Soft reject (limit, disabled path). */
  reject: hapticWarning,
} as const;
