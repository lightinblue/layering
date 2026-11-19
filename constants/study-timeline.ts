/**
 * Study-day timeline (trial UI) — faint clock marks, not 오전/오후/저녁 headers.
 * Easy to delete this module + day route to revert.
 */

/** Hard cap on filled study records per studiedOn date (4+6+4). */
export const TIMELINE_MAX_STUDIES_PER_DAY = 14;

/**
 * Visual empty-slot capacity per band (between clock marks).
 * Filled items may exceed a band’s empty count; empties pad up to these.
 */
export const TIMELINE_BANDS = [
  {
    id: 'morning',
    labelStart: '8',
    labelEnd: '12',
    emptySlots: 4,
    addLabel: '오전 투두',
  },
  {
    id: 'afternoon',
    labelStart: '12',
    labelEnd: '18',
    emptySlots: 6,
    addLabel: '오후 투두',
  },
  {
    id: 'evening',
    labelStart: '18',
    labelEnd: '24',
    emptySlots: 4,
    addLabel: '밤 투두',
  },
] as const;

/** Inline add title placeholder. */
export const INLINE_STUDY_PLACEHOLDER = '전공 1, 2주차';

export type TimelineBandId = (typeof TIMELINE_BANDS)[number]['id'];

/** Clock marks drawn as faint labels + hairline dividers. */
export const TIMELINE_MARKS = ['8', '12', '18', '24'] as const;
