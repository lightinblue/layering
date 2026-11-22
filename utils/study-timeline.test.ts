import { describe, expect, it } from 'vitest';

import type { HomeStudyRow } from '@/constants/home-types';
import {
  TIMELINE_BANDS,
  TIMELINE_MARKS,
  TIMELINE_MAX_STUDIES_PER_DAY,
} from '@/constants/study-timeline';
import {
  assignMissingDayBands,
  buildTimelineBands,
  layoutAfterCrossBandMove,
  layoutWithStudyAppendedToBand,
} from '@/utils/study-timeline';

function row(
  id: string,
  dayBand?: HomeStudyRow['dayBand'],
  dayOrder?: number,
): HomeStudyRow {
  return {
    id,
    subjectName: '전공',
    content: `c-${id}`,
    ...(dayBand ? { dayBand } : {}),
    ...(typeof dayOrder === 'number' ? { dayOrder } : {}),
  };
}

describe('buildTimelineBands', () => {
  it('keeps hard caps 4/6/4 and visual pad 3/4/3', () => {
    expect(TIMELINE_MARKS).toEqual(['8', '12', '18', '24']);
    expect(TIMELINE_BANDS.map((b) => b.emptySlots)).toEqual([4, 6, 4]);
    expect(TIMELINE_BANDS.map((b) => b.visualPad)).toEqual([3, 4, 3]);
    expect(TIMELINE_MAX_STUDIES_PER_DAY).toBe(14);
    const empty = buildTimelineBands([]);
    expect(empty.map((b) => b.addSpan)).toEqual([3, 4, 3]);
  });

  it('exposes one add span + 공부 label per band', () => {
    const bands = buildTimelineBands([row('a', 'morning')]);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(1);
    expect(bands[0].showAdd).toBe(true);
    expect(bands[0].addSpan).toBe(2);
    expect(bands.map((b) => b.addLabel)).toEqual([
      '오전 공부',
      '오후 공부',
      '밤 공부',
    ]);
    expect(bands[1].addSpan).toBe(4);
    expect(bands[2].addSpan).toBe(3);
  });

  it('puts legacy unassigned rows in evening (no capacity steal)', () => {
    const bands = buildTimelineBands([row('x'), row('y')]);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(0);
    expect(bands[1].slots.filter((s) => s.kind === 'study')).toHaveLength(0);
    expect(bands[2].slots.filter((s) => s.kind === 'study')).toHaveLength(2);
  });

  it('does not rebucket evening unassigned into morning after a morning delete', () => {
    // Morning had capacity; legacy unassigned must stay in evening.
    const bands = buildTimelineBands([
      row('m1', 'morning', 0),
      row('legacy-a', undefined, 1),
      row('legacy-b', undefined, 2),
    ]);
    expect(
      bands[0].slots.map((s) => (s.kind === 'study' ? s.row.id : '')),
    ).toEqual(['m1']);
    expect(
      bands[2].slots.map((s) => (s.kind === 'study' ? s.row.id : '')),
    ).toEqual(['legacy-a', 'legacy-b']);

    const afterDelete = buildTimelineBands([
      row('legacy-a', undefined, 1),
      row('legacy-b', undefined, 2),
    ]);
    expect(afterDelete[0].slots.filter((s) => s.kind === 'study')).toHaveLength(
      0,
    );
    expect(
      afterDelete[2].slots.map((s) => (s.kind === 'study' ? s.row.id : '')),
    ).toEqual(['legacy-a', 'legacy-b']);
  });

  it('honors explicit dayBand from the tapped 투두', () => {
    const bands = buildTimelineBands([
      row('m', 'morning'),
      row('a', 'afternoon'),
    ]);
    expect(
      bands[0].slots.some((s) => s.kind === 'study' && s.row.id === 'm'),
    ).toBe(true);
    expect(
      bands[1].slots.some((s) => s.kind === 'study' && s.row.id === 'a'),
    ).toBe(true);
    expect(bands[0].addSpan).toBe(2);
    expect(bands[1].addSpan).toBe(3);
  });

  it('appends higher dayOrder at the bottom of a band', () => {
    const bands = buildTimelineBands([
      row('a', 'afternoon', 0),
      row('b', 'afternoon', 1),
      row('c', 'afternoon', 5),
    ]);
    expect(
      bands[1].slots.map((s) => (s.kind === 'study' ? s.row.id : '')),
    ).toEqual(['a', 'b', 'c']);
  });

  it('allows more than emptySlots in one band (no hard per-band max)', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      row(`m${i}`, 'morning', i),
    );
    const bands = buildTimelineBands(many);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(8);
    expect(bands[0].showAdd).toBe(false); // soft: hide 오전 add when ≥4
    expect(bands[2].showAdd).toBe(true); // 밤 always offers add until day cap
  });
});

describe('layout helpers', () => {
  it('layoutWithStudyAppendedToBand puts the new id last in that band', () => {
    const bands = buildTimelineBands([
      row('a', 'morning', 0),
      row('b', 'morning', 1),
      row('c', 'afternoon', 2),
      row('new', 'morning', 3),
    ]);
    const layout = layoutWithStudyAppendedToBand({
      bands,
      studyId: 'new',
      bandId: 'morning',
    });
    expect(layout.filter((i) => i.dayBand === 'morning').map((i) => i.id)).toEqual([
      'a',
      'b',
      'new',
    ]);
    expect(layout.filter((i) => i.dayBand === 'afternoon').map((i) => i.id)).toEqual([
      'c',
    ]);
  });

  it('layoutAfterCrossBandMove moves morning → afternoon', () => {
    const bands = buildTimelineBands([
      row('m1', 'morning', 0),
      row('m2', 'morning', 1),
      row('a1', 'afternoon', 2),
    ]);
    const layout = layoutAfterCrossBandMove({
      bands,
      studyId: 'm1',
      toBandId: 'afternoon',
      toIndex: 1,
    });
    expect(layout?.map((i) => `${i.dayBand}:${i.id}`)).toEqual([
      'morning:m2',
      'afternoon:a1',
      'afternoon:m1',
    ]);
  });

  it('assignMissingDayBands uses legacy capacity fill once', () => {
    const many = Array.from({ length: 14 }, (_, i) => row(String(i)));
    const assigned = assignMissingDayBands(many);
    expect([...assigned.values()].filter((b) => b === 'morning')).toHaveLength(
      4,
    );
    expect(
      [...assigned.values()].filter((b) => b === 'afternoon'),
    ).toHaveLength(6);
    expect([...assigned.values()].filter((b) => b === 'evening')).toHaveLength(
      4,
    );
  });
});
