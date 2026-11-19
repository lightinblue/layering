import { describe, expect, it } from 'vitest';

import { dowLabels, startOfWeek, toKey } from '@/utils/date';
import { buildMonthGrid } from '@/utils/month-grid';

describe('startOfWeek', () => {
  it('returns Sunday for Sunday-first', () => {
    // 2026-11-19 is Thursday
    const thu = new Date(2026, 10, 19);
    expect(toKey(startOfWeek(thu, 0))).toBe('2026-11-15');
  });

  it('returns Monday for Monday-first', () => {
    const thu = new Date(2026, 10, 19);
    expect(toKey(startOfWeek(thu, 1))).toBe('2026-11-16');
  });
});

describe('dowLabels', () => {
  it('rotates for Monday-first', () => {
    expect(dowLabels(1)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
  });
});

describe('buildMonthGrid', () => {
  it('aligns November 2026 Monday-first so 1일 is column index 6', () => {
    const cells = buildMonthGrid(2026, 10, 1);
    const first = cells.find((c) => c.inMonth && c.day === 1);
    expect(first?.dateKey).toBe('2026-11-01');
    // Nov 1 2026 is Sunday → last column when week starts Monday.
    expect(cells.indexOf(first!)).toBe(6);
  });
});
