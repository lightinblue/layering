/**
 * Study-day timeline (trial UI) — faint clock marks, not 오전/오후/저녁 headers.
 * Easy to delete this module + day route to revert.
 */

/** Hard cap on filled study records per studiedOn date (4+6+4). */
export const TIMELINE_MAX_STUDIES_PER_DAY = 14;

/**
 * Per-band limits:
 * - emptySlots = hard fill cap (4 / 6 / 4)
 * - visualPad = display height padding (~3 / 4 / 3) for empty add control
 */
export const TIMELINE_BANDS = [
  {
    id: 'morning',
    labelStart: '8',
    labelEnd: '12',
    emptySlots: 4,
    visualPad: 3,
    addLabel: '오전 투두',
  },
  {
    id: 'afternoon',
    labelStart: '12',
    labelEnd: '18',
    emptySlots: 6,
    visualPad: 4,
    addLabel: '오후 투두',
  },
  {
    id: 'evening',
    labelStart: '18',
    labelEnd: '24',
    emptySlots: 4,
    visualPad: 3,
    addLabel: '밤 투두',
  },
] as const;

/** Inline add title placeholder. */
export const INLINE_STUDY_PLACEHOLDER = '전공 1, 2주차';

export type TimelineBandId = (typeof TIMELINE_BANDS)[number]['id'];

/** Clock marks drawn as faint labels + hairline dividers. */
export const TIMELINE_MARKS = ['8', '12', '18', '24'] as const;
