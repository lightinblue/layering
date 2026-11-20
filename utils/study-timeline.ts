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
  /** Display height in slot units (~3/4/3 pad, not hard cap). */
  addSpan: number;
  addLabel: string;
};

function isBandId(value: string | undefined): value is TimelineBandId {
  return (
    value === 'morning' || value === 'afternoon' || value === 'evening'
  );
}

function rowSortKey(row: HomeStudyRow): string {
  const order =
    typeof row.dayOrder === 'number' ? row.dayOrder : Number.MAX_SAFE_INTEGER;
  return `${String(order).padStart(8, '0')}|${row.createdAt ?? ''}|${row.id}`;
}

function sortRows(rows: readonly HomeStudyRow[]): HomeStudyRow[] {
  return [...rows].sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));
}

/**
 * Partition studies into morning / afternoon / evening bands.
 * Prefer explicit `dayBand` (from which 투두 was tapped); legacy rows
 * without a band fill remaining capacity in dayOrder / createdAt order.
 * Within each band, rows stay sorted ascending (new studies append at bottom).
 */
export function buildTimelineBands(
  studies: readonly HomeStudyRow[],
): TimelineBandView[] {
  const ordered = sortRows(studies);
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
    return sortRows(filled);
  });
  // Leftover unassigned → evening.
  if (queue.length > 0) {
    buckets[buckets.length - 1] = sortRows([
      ...buckets[buckets.length - 1],
      ...queue,
    ]);
  }

  return TIMELINE_BANDS.map((band, index) => {
    const filled = buckets[index];
    const slots: TimelineSlot[] = filled.map((row) => ({
      kind: 'study',
      row,
    }));
    const hardSpare = Math.max(0, band.emptySlots - filled.length);
    // Display pad uses ~3/4/3 visual heights, independent of hard 4/6/4 caps.
    const visualSpare = Math.max(0, band.visualPad - filled.length);
    return {
      id: band.id,
      labelStart: band.labelStart,
      labelEnd: band.labelEnd,
      slots,
      showAdd: hardSpare > 0 || band.id === 'evening',
      addSpan: Math.max(1, visualSpare),
      addLabel: band.addLabel,
    };
  });
}

/** Flatten band visual order into a full-day id list for persistence. */
export function flattenBandStudyIds(
  bands: readonly TimelineBandView[],
): string[] {
  const ids: string[] = [];
  for (const band of bands) {
    for (const slot of band.slots) {
      if (slot.kind === 'study') ids.push(slot.row.id);
    }
  }
  return ids;
}
