/**
 * Study-day timeline (trial UI) — faint clock marks, not 오전/오후/저녁 headers.
 * Easy to delete this module + day route to revert.
 */

/** Hard cap on filled study records per studiedOn date. */
export const TIMELINE_MAX_STUDIES_PER_DAY = 15;

/**
 * Visual empty-slot capacity per band (between clock marks).
 * Filled items may exceed a band’s empty count; empties pad up to these.
 */
export const TIMELINE_BANDS = [
  { id: 'morning', labelStart: '9', labelEnd: '12', emptySlots: 3 },
  { id: 'afternoon', labelStart: '12', labelEnd: '18', emptySlots: 4 },
  { id: 'evening', labelStart: '18', labelEnd: '24', emptySlots: 3 },
] as const;

export type TimelineBandId = (typeof TIMELINE_BANDS)[number]['id'];

/** Clock marks drawn as faint labels + hairline dividers. */
export const TIMELINE_MARKS = ['9', '12', '18', '24'] as const;
