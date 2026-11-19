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
};

/**
 * Partition ordered studies into morning / afternoon / evening bands
 * (first 3 / next 4 / next 3 by order), then overflow into evening.
 * Pads with inert empty slots for visual capacity; UI shows one add per band.
 */
export function buildTimelineBands(
  studies: readonly HomeStudyRow[],
): TimelineBandView[] {
  const ordered = [...studies];
  const capacities = TIMELINE_BANDS.map((b) => b.emptySlots);
  const buckets: HomeStudyRow[][] = TIMELINE_BANDS.map(() => []);

  let cursor = 0;
  for (let i = 0; i < capacities.length; i += 1) {
    const take = capacities[i];
    buckets[i] = ordered.slice(cursor, cursor + take);
    cursor += take;
  }
  // Overflow beyond 3+4+3 → evening band (still capped globally at 15).
  if (cursor < ordered.length) {
    buckets[buckets.length - 1] = [
      ...buckets[buckets.length - 1],
      ...ordered.slice(cursor),
    ];
  }

  return TIMELINE_BANDS.map((band, index) => {
    const filled = buckets[index];
    const slots: TimelineSlot[] = filled.map((row) => ({
      kind: 'study',
      row,
    }));
    // Remaining visual capacity → one add control sized to fit the band (not per-slot adds).
    const spare = Math.max(0, band.emptySlots - filled.length);
    return {
      id: band.id,
      labelStart: band.labelStart,
      labelEnd: band.labelEnd,
      slots,
      showAdd: spare > 0 || band.id === 'evening',
      addSpan: Math.max(1, spare),
    };
  });
}
