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

export type DayStudyLayoutItem = {
  id: string;
  dayBand: TimelineBandId;
};

export function isBandId(value: string | undefined): value is TimelineBandId {
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
 *
 * Only explicit `dayBand` membership is used for placement. Rows without a
 * band fall through to **evening** as a legacy safety net — they are never
 * gap-filled into earlier bands when capacity opens (that rebucketed on
 * delete). Prefer persisting `dayBand` via migrate `ensureDayBands`.
 *
 * Within each band, rows sort ascending by dayOrder (new studies append).
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

  for (const row of ordered) {
    if (isBandId(row.dayBand)) {
      assigned[row.dayBand].push(row);
    } else {
      // Legacy / missing band — stable evening bucket (no capacity steal).
      assigned.evening.push(row);
    }
  }

  return TIMELINE_BANDS.map((band) => {
    const filled = sortRows(assigned[band.id]);
    const slots: TimelineSlot[] = filled.map((row) => ({
      kind: 'study',
      row,
    }));
    const hardSpare = Math.max(0, band.emptySlots - filled.length);
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

/** Full-day layout with band membership (visual order). */
export function layoutFromBands(
  bands: readonly TimelineBandView[],
): DayStudyLayoutItem[] {
  const layout: DayStudyLayoutItem[] = [];
  for (const band of bands) {
    for (const slot of band.slots) {
      if (slot.kind === 'study') {
        layout.push({ id: slot.row.id, dayBand: band.id });
      }
    }
  }
  return layout;
}

/**
 * Rebuild layout after within-band reorder or cross-band move.
 * `orderedBandIds` must be a permutation of the studies currently in `bandId`
 * when `toBandId === bandId`; for cross-band moves pass the full target
 * band order including the moved id.
 */
export function layoutAfterBandReorder(input: {
  bands: readonly TimelineBandView[];
  bandId: TimelineBandId;
  orderedBandIds: readonly string[];
}): DayStudyLayoutItem[] | null {
  const { bands, bandId, orderedBandIds } = input;
  const band = bands.find((b) => b.id === bandId);
  if (!band) return null;

  const prevIds = band.slots
    .filter((s) => s.kind === 'study')
    .map((s) => s.row.id);

  // Same-band permutation — require identical membership.
  if (
    orderedBandIds.length === prevIds.length &&
    orderedBandIds.every((id) => prevIds.includes(id)) &&
    prevIds.every((id) => orderedBandIds.includes(id))
  ) {
    return bands.flatMap((b) =>
      b.id === bandId
        ? orderedBandIds.map((id) => ({ id, dayBand: bandId }))
        : b.slots
            .filter((s) => s.kind === 'study')
            .map((s) => ({ id: s.row.id, dayBand: b.id })),
    );
  }

  return null;
}

/**
 * Move one study into `toBandId` at `toIndex` (0 = top of that band).
 * Returns a full-day layout or null if the id is unknown.
 */
export function layoutAfterCrossBandMove(input: {
  bands: readonly TimelineBandView[];
  studyId: string;
  toBandId: TimelineBandId;
  toIndex: number;
}): DayStudyLayoutItem[] | null {
  const { bands, studyId, toBandId, toIndex } = input;
  const current = layoutFromBands(bands);
  if (!current.some((item) => item.id === studyId)) return null;

  const without = current.filter((item) => item.id !== studyId);
  const targetIds = without
    .filter((item) => item.dayBand === toBandId)
    .map((item) => item.id);
  const clamped = Math.max(0, Math.min(targetIds.length, toIndex));
  targetIds.splice(clamped, 0, studyId);

  const next: DayStudyLayoutItem[] = [];
  for (const band of TIMELINE_BANDS) {
    if (band.id === toBandId) {
      for (const id of targetIds) {
        next.push({ id, dayBand: toBandId });
      }
    } else {
      for (const item of without) {
        if (item.dayBand === band.id) next.push(item);
      }
    }
  }
  return next;
}

/**
 * Ensure `studyId` is the last row in `bandId` (append after add).
 */
export function layoutWithStudyAppendedToBand(input: {
  bands: readonly TimelineBandView[];
  studyId: string;
  bandId: TimelineBandId;
}): DayStudyLayoutItem[] {
  const { bands, studyId, bandId } = input;
  const base = layoutFromBands(bands).filter((item) => item.id !== studyId);
  const next: DayStudyLayoutItem[] = [];
  for (const band of TIMELINE_BANDS) {
    for (const item of base) {
      if (item.dayBand === band.id) next.push(item);
    }
    if (band.id === bandId) {
      next.push({ id: studyId, dayBand: bandId });
    }
  }
  // If study was missing from bands (brand-new), still append.
  if (!next.some((item) => item.id === studyId)) {
    next.push({ id: studyId, dayBand: bandId });
  }
  return next;
}

/**
 * One-shot capacity placement for records missing `dayBand` (migrate only).
 * Matches the legacy gap-fill order so existing screenshots keep their bands,
 * then membership is persisted and never rebucketed on delete.
 */
export function assignMissingDayBands(
  rows: readonly HomeStudyRow[],
): Map<string, TimelineBandId> {
  const ordered = sortRows(rows);
  const assigned: Record<TimelineBandId, string[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };
  const unassigned: HomeStudyRow[] = [];

  for (const row of ordered) {
    if (isBandId(row.dayBand)) {
      assigned[row.dayBand].push(row.id);
    } else {
      unassigned.push(row);
    }
  }

  const queue = [...unassigned];
  for (const band of TIMELINE_BANDS) {
    while (
      assigned[band.id].length < band.emptySlots &&
      queue.length > 0
    ) {
      assigned[band.id].push(queue.shift()!.id);
    }
  }
  while (queue.length > 0) {
    assigned.evening.push(queue.shift()!.id);
  }

  const out = new Map<string, TimelineBandId>();
  for (const band of TIMELINE_BANDS) {
    for (const id of assigned[band.id]) {
      out.set(id, band.id);
    }
  }
  return out;
}
