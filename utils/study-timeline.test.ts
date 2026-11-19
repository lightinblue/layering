import { describe, expect, it } from 'vitest';

import type { HomeStudyRow } from '@/constants/home-types';
import {
  TIMELINE_BANDS,
  TIMELINE_MARKS,
  TIMELINE_MAX_STUDIES_PER_DAY,
} from '@/constants/study-timeline';
import { buildTimelineBands } from '@/utils/study-timeline';

function row(
  id: string,
  dayBand?: HomeStudyRow['dayBand'],
): HomeStudyRow {
  return {
    id,
    subjectName: '전공',
    content: `c-${id}`,
    ...(dayBand ? { dayBand } : {}),
  };
}

describe('buildTimelineBands', () => {
  it('uses 8/12/18/24 marks and 4/6/4 band caps (max 14)', () => {
    expect(TIMELINE_MARKS).toEqual(['8', '12', '18', '24']);
    expect(TIMELINE_BANDS.map((b) => b.emptySlots)).toEqual([4, 6, 4]);
    expect(TIMELINE_MAX_STUDIES_PER_DAY).toBe(14);
    const bands = buildTimelineBands([]);
    expect(bands.map((b) => b.labelStart)).toEqual(['8', '12', '18']);
    expect(bands.map((b) => b.addSpan)).toEqual([4, 6, 4]);
  });

  it('exposes one add span + 투두 label per band', () => {
    const bands = buildTimelineBands([row('a')]);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(1);
    expect(bands[0].showAdd).toBe(true);
    expect(bands[0].addSpan).toBe(3);
    expect(bands.map((b) => b.addLabel)).toEqual([
      '오전 투두',
      '오후 투두',
      '밤 투두',
    ]);
    expect(bands[1].addSpan).toBe(6);
    expect(bands[2].addSpan).toBe(4);
  });

  it('places overflow unassigned studies into the evening band', () => {
    const many = Array.from({ length: 14 }, (_, i) => row(String(i)));
    const bands = buildTimelineBands(many);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(4);
    expect(bands[0].showAdd).toBe(false);
    expect(bands[1].slots.filter((s) => s.kind === 'study')).toHaveLength(6);
    expect(bands[1].showAdd).toBe(false);
    expect(bands[2].slots.filter((s) => s.kind === 'study')).toHaveLength(4);
    expect(bands[2].showAdd).toBe(true);
    expect(bands[2].addSpan).toBe(1);
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
    expect(bands[0].addSpan).toBe(3);
    expect(bands[1].addSpan).toBe(5);
  });
});
