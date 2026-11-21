import { describe, expect, it } from 'vitest';

import {
  appendStudyWithReviews,
  applyDayStudyLayout,
  removeSubject,
  reorderStudiesOnDay,
  subjectColorMap,
} from '@/storage/app-data';
import type { AppData } from '@/types/domain';
import { activeSubjects } from '@/utils/icloud-merge';

function baseData(): AppData {
  return {
    subjects: [
      {
        id: 'sub-a',
        name: '전공',
        color: '#62B3F6',
        order: 0,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'sub-b',
        name: '교육학',
        color: '#5DCB85',
        order: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    records: [],
    schedules: [],
  };
}

describe('removeSubject', () => {
  it('soft-deletes the chip so it leaves the active list', () => {
    const result = removeSubject(baseData(), '교육학');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(activeSubjects(result.data.subjects).map((s) => s.name)).toEqual([
      '전공',
    ]);
    expect(result.data.subjects.find((s) => s.id === 'sub-b')?.deleted).toBe(
      true,
    );
  });

  it('keeps records and backfills subjectColor when missing', () => {
    const withStudy = appendStudyWithReviews(baseData(), {
      subjectName: '교육학',
      content: '1단원',
      studiedOn: '2026-11-19',
    });
    // Simulate a legacy row without a color snapshot.
    const legacy: AppData = {
      ...withStudy,
      records: withStudy.records.map((r) => {
        const { subjectColor: _drop, ...rest } = r;
        return rest;
      }),
    };
    expect(legacy.records[0]?.subjectColor).toBeUndefined();

    const result = removeSubject(legacy, '교육학');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.records).toHaveLength(1);
    expect(result.data.records[0]?.deleted).toBeFalsy();
    expect(result.data.records[0]?.subjectName).toBe('교육학');
    expect(result.data.records[0]?.subjectColor).toBe('#5DCB85');

    const colors = subjectColorMap(result.data.subjects);
    expect(colors['교육학']).toBe('#5DCB85');
  });
});

describe('reorderStudiesOnDay', () => {
  it('rewrites dayOrder for a full-day permutation and keeps all records', () => {
    let data = baseData();
    data = appendStudyWithReviews(data, {
      subjectName: '전공',
      content: 'A',
      studiedOn: '2026-11-20',
      dayBand: 'morning',
    });
    data = appendStudyWithReviews(data, {
      subjectName: '교육학',
      content: 'B',
      studiedOn: '2026-11-20',
      dayBand: 'morning',
    });
    const ids = data.records.map((r) => r.id);
    expect(ids).toHaveLength(2);

    const reversed = [...ids].reverse();
    const next = reorderStudiesOnDay(data, '2026-11-20', reversed);
    expect(next.records).toHaveLength(2);
    expect(next.records.find((r) => r.id === reversed[0])?.dayOrder).toBe(0);
    expect(next.records.find((r) => r.id === reversed[1])?.dayOrder).toBe(1);
    expect(next.records.every((r) => !r.deleted)).toBe(true);
  });

  it('no-ops when the id list is incomplete (never drops rows)', () => {
    let data = baseData();
    data = appendStudyWithReviews(data, {
      subjectName: '전공',
      content: 'A',
      studiedOn: '2026-11-20',
    });
    data = appendStudyWithReviews(data, {
      subjectName: '교육학',
      content: 'B',
      studiedOn: '2026-11-20',
    });
    const onlyFirst = [data.records[0]!.id];
    const next = reorderStudiesOnDay(data, '2026-11-20', onlyFirst);
    expect(next).toBe(data);
    expect(next.records).toHaveLength(2);
  });
});

describe('applyDayStudyLayout', () => {
  it('writes dayBand + dayOrder for a cross-band move', () => {
    let data = baseData();
    data = appendStudyWithReviews(data, {
      subjectName: '전공',
      content: 'A',
      studiedOn: '2026-11-20',
      dayBand: 'morning',
    });
    data = appendStudyWithReviews(data, {
      subjectName: '교육학',
      content: 'B',
      studiedOn: '2026-11-20',
      dayBand: 'afternoon',
    });
    const [a, b] = data.records;
    const next = applyDayStudyLayout(data, '2026-11-20', [
      { id: b!.id, dayBand: 'afternoon' },
      { id: a!.id, dayBand: 'afternoon' },
    ]);
    expect(next.records.find((r) => r.id === a!.id)?.dayBand).toBe('afternoon');
    expect(next.records.find((r) => r.id === a!.id)?.dayOrder).toBe(1);
    expect(next.records.find((r) => r.id === b!.id)?.dayOrder).toBe(0);
  });

  it('defaults missing dayBand to evening on append', () => {
    let data = baseData();
    data = appendStudyWithReviews(data, {
      subjectName: '전공',
      content: 'A',
      studiedOn: '2026-11-20',
    });
    expect(data.records[0]?.dayBand).toBe('evening');
  });
});
