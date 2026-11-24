/**
 * Web: haptics are out of scope. Keep the same API surface as native so
 * call sites stay identical; Vibration / Taptic are not used.
 */

function noop(): void {}

export function hapticLight(): void {
  noop();
}

export function hapticMedium(): void {
  noop();
}

export function hapticHeavy(): void {
  noop();
}

export function hapticSoft(): void {
  noop();
}

export function hapticRigid(): void {
  noop();
}

export function hapticSelection(): void {
  noop();
}

export function hapticSuccess(): void {
  noop();
}

export function hapticWarning(): void {
  noop();
}

export function hapticError(): void {
  noop();
}

export const haptics = {
  daySwipe: hapticSoft,
  weekPage: hapticLight,
  todayJump: hapticMedium,
  sheetOpen: hapticLight,
  save: hapticSuccess,
  delete: hapticWarning,
  checkOn: hapticSuccess,
  checkOff: hapticSoft,
  select: hapticSelection,
  subjectAdd: hapticSuccess,
  subjectReorderStart: hapticMedium,
  subjectReorderTick: hapticSelection,
  calendarOpen: hapticMedium,
  monthChange: hapticLight,
  themePick: hapticSelection,
  settings: hapticLight,
  fab: hapticLight,
  reject: hapticWarning,
} as const;
