import { describe, expect, it } from 'vitest';

import { normalizeAppData } from '@/storage/migrate-app-data';

describe('normalizeAppData', () => {
  it('fills ids, updatedAt, cycle, checks from legacy schedules', () => {
    const normalized = normalizeAppData(
      {
        subjects: [{ id: 'sub-1', name: '전공', color: '#62B3F6' }],
        records: [
          {
            id: 'study-1',
            subjectId: 'sub-1',
            subjectName: '전공',
            content: '기출',
            studiedOn: '2026-01-01',
            createdAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        schedules: [
          {
            id: 'rev1',
            studyRecordId: 'study-1',
            intervalDays: 1,
            dueOn: '2026-01-02',
            completed: true,
            completedAt: '2026-01-02T12:00:00.000Z',
          },
          {
            id: 'rev3',
            studyRecordId: 'study-1',
            intervalDays: 3,
            dueOn: '2026-01-04',
            completed: false,
          },
        ],
      },
      new Date('2026-11-19T00:00:00.000Z'),
    );

    expect(normalized.subjects[0]?.order).toBe(0);
    expect(normalized.subjects[0]?.updatedAt).toBeTruthy();
    const record = normalized.records[0];
    expect(record?.cycle).toEqual([1, 3, 7, 15, 30, 60]);
    expect(record?.updatedAt).toBe('2026-01-01T10:00:00.000Z');
    expect(record?.checks['1']).toEqual({
      done: true,
      updatedAt: '2026-01-02T12:00:00.000Z',
    });
    expect(record?.checks['3']?.done).toBe(false);
    expect(record?.checks['7']?.done).toBe(false);
    expect(normalized.schedules.some((s) => s.intervalDays === 1 && s.completed)).toBe(
      true,
    );
  });

  it('is idempotent on already-normalized data', () => {
    const once = normalizeAppData({
      subjects: [
        {
          id: 'sub-1',
          name: '전공',
          color: '#62B3F6',
          order: 2,
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      records: [
        {
          id: 'study-1',
          subjectId: 'sub-1',
          subjectName: '전공',
          content: '기출',
          studiedOn: '2026-01-01',
          cycle: [1, 3, 7, 15, 30, 60],
          checks: {
            '1': { done: true, updatedAt: '2026-01-02T00:00:00.000Z' },
          },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      schedules: [],
    });
    const twice = normalizeAppData(once);
    expect(twice.subjects[0]?.order).toBe(2);
    expect(twice.records[0]?.checks['1']?.done).toBe(true);
    expect(twice.records[0]?.cycle).toEqual(once.records[0]?.cycle);
  });
});
