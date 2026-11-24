/**
 * Web calendar → home day handoff.
 * Expo Router navigate/dismissTo often drops `?day=` on Safari SPA modals;
 * this in-memory queue is consumed when Home gains focus.
 */

let pendingDateKey: string | null = null;

export function queueHomeDay(dateKey: string): void {
  const trimmed = dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return;
  pendingDateKey = trimmed;
}

export function consumeHomeDay(): string | null {
  const next = pendingDateKey;
  pendingDateKey = null;
  return next;
}
