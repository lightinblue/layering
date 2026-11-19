import { describe, expect, it } from 'vitest';

import {
  appendStudyWithReviews,
  removeSubject,
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
