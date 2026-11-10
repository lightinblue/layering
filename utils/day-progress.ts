/** Per-day review completion for calendar dots. */

import type { HomeReviewCard } from '@/constants/home-types';
import { softFromPrimary } from '@/constants/tokens';
import type { AppData, ReviewSchedule } from '@/types/domain';

export type DayProgress = {
  total: number;
  completed: number;
  /** 0–1 when total > 0; null when no reviews that day. */
  ratio: number | null;
};

export function emptyDayProgress(): DayProgress {
  return { total: 0, completed: 0, ratio: null };
}

export function progressFromSchedules(
  schedules: ReviewSchedule[],
  dateKey: string,
): DayProgress {
  const due = schedules.filter((s) => s.dueOn === dateKey);
  if (due.length === 0) return emptyDayProgress();
  const completed = due.filter((s) => s.completed).length;
  return {
    total: due.length,
    completed,
    ratio: completed / due.length,
  };
}

export function progressFromAppData(
  data: AppData,
  dateKey: string,
): DayProgress {
  return progressFromSchedules(data.schedules, dateKey);
}

/** Count underlying schedule slots from home review cards (grouped cards). */
export function progressFromReviewCards(
  reviews: HomeReviewCard[],
): DayProgress {
  if (reviews.length === 0) return emptyDayProgress();
  let total = 0;
  let completed = 0;
  for (const card of reviews) {
    const slots = Math.max(1, card.scheduleIds.length);
    total += slots;
    if (card.completed) completed += slots;
  }
  return {
    total,
    completed,
    ratio: completed / total,
  };
}

/**
 * Discrete white→primary tint steps for partial completion.
 * Index 0 = lightest (just started); last = near-solid before 100%.
 * Higher whiteMix = lighter tint.
 */
const DOT_WHITE_MIX_STEPS = [0.8, 0.64, 0.48, 0.32, 0.16] as const;

/**
 * Dot fill from theme primary — stepped by completion %.
 * no reviews / 0% checked → null (hide);
 * (0–20%] … (80–<100%] → light→dark primary tints;
 * 100% → solid primary.
 */
export function progressDotColor(
  primary: string,
  progress: DayProgress,
): string | null {
  if (progress.ratio == null) return null;
  const ratio = Math.min(1, Math.max(0, progress.ratio));
  if (ratio <= 0) return null;
  if (ratio >= 0.999) return primary;

  const steps = DOT_WHITE_MIX_STEPS.length;
  const step = Math.min(steps - 1, Math.ceil(ratio * steps) - 1);
  return softFromPrimary(primary, DOT_WHITE_MIX_STEPS[step]);
}
