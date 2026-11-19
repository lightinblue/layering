import type { HomeStudyRow } from '@/constants/home-types';
import {
  TIMELINE_BANDS,
  type TimelineBandId,
} from '@/constants/study-timeline';

export type TimelineSlot =
  | { kind: 'study'; row: HomeStudyRow }
  | { kind: 'empty'; key: string };

export type TimelineBandView = {
  id: TimelineBandId;
  labelStart: string;
  labelEnd: string;
  slots: TimelineSlot[];
  /** One add control for this band (not per empty slot). */
  showAdd: boolean;
  /** Visual slot-heights the single add control should span. */
  addSpan: number;
  addLabel: string;
};

function isBandId(value: string | undefined): value is TimelineBandId {
  return (
    value === 'morning' || value === 'afternoon' || value === 'evening'
  );
}

/**
 * Partition studies into morning / afternoon / evening bands.
 * Prefer explicit `dayBand` (from which 투두 was tapped); legacy rows
 * without a band fill remaining capacity in createdAt order.
 */
export function buildTimelineBands(
  studies: readonly HomeStudyRow[],
): TimelineBandView[] {
  const ordered = [...studies];
  const assigned: Record<TimelineBandId, HomeStudyRow[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  const unassigned: HomeStudyRow[] = [];

  for (const row of ordered) {
    if (isBandId(row.dayBand)) {
      assigned[row.dayBand].push(row);
    } else {
      unassigned.push(row);
    }
  }

  const queue = [...unassigned];
  const buckets: HomeStudyRow[][] = TIMELINE_BANDS.map((band) => {
    const filled = [...assigned[band.id]];
    while (filled.length < band.emptySlots && queue.length > 0) {
      filled.push(queue.shift()!);
    }
    return filled;
  });
  // Leftover unassigned → evening.
  if (queue.length > 0) {
    buckets[buckets.length - 1] = [...buckets[buckets.length - 1], ...queue];
  }

  return TIMELINE_BANDS.map((band, index) => {
    const filled = buckets[index];
    const slots: TimelineSlot[] = filled.map((row) => ({
      kind: 'study',
      row,
    }));
    const spare = Math.max(0, band.emptySlots - filled.length);
    return {
      id: band.id,
      labelStart: band.labelStart,
      labelEnd: band.labelEnd,
      slots,
      showAdd: spare > 0 || band.id === 'evening',
      addSpan: Math.max(1, spare),
      addLabel: band.addLabel,
    };
  });
}
