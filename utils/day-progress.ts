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
 * Dot fill from theme primary.
 * no reviews / 0% checked → null (hide); low progress → lighter tint; 100% → solid primary.
 */
export function progressDotColor(
  primary: string,
  progress: DayProgress,
): string | null {
  if (progress.ratio == null) return null;
  const ratio = Math.min(1, Math.max(0, progress.ratio));
  if (ratio <= 0) return null;
  if (ratio >= 0.999) return primary;
  const whiteMix = 0.72 * (1 - ratio);
  return softFromPrimary(primary, whiteMix);
}
