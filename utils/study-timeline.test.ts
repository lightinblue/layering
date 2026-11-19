import { describe, expect, it } from 'vitest';

import type { HomeStudyRow } from '@/constants/home-types';
import { buildTimelineBands } from '@/utils/study-timeline';

function row(id: string): HomeStudyRow {
  return { id, subjectName: '전공', content: `c-${id}` };
}

describe('buildTimelineBands', () => {
  it('pads empty slots to band capacities when few studies', () => {
    const bands = buildTimelineBands([row('a')]);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(1);
    expect(bands[0].slots.filter((s) => s.kind === 'empty')).toHaveLength(2);
    expect(bands[1].slots.every((s) => s.kind === 'empty')).toBe(true);
    expect(bands[1].slots).toHaveLength(4);
    expect(bands[2].slots).toHaveLength(3);
  });

  it('places overflow studies into the evening band', () => {
    const many = Array.from({ length: 12 }, (_, i) => row(String(i)));
    const bands = buildTimelineBands(many);
    expect(bands[0].slots.filter((s) => s.kind === 'study')).toHaveLength(3);
    expect(bands[1].slots.filter((s) => s.kind === 'study')).toHaveLength(4);
    expect(bands[2].slots.filter((s) => s.kind === 'study')).toHaveLength(5);
    expect(bands[2].slots.some((s) => s.kind === 'empty')).toBe(false);
  });
});
