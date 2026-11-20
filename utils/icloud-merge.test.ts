import { describe, expect, it } from 'vitest';

import type { AppData, StudyRecord, SubjectChip } from '@/types/domain';
import {
  dedupeStudyRecords,
  mergeAppData,
  mergeChecks,
  pickWinner,
  purgeExpiredTombstones,
  SOFT_DELETE_PURGE_DAYS,
} from '@/utils/icloud-merge';

const deviceA = 'device-aaa';
const deviceB = 'device-bbb';

function subject(
  partial: Partial<SubjectChip> & Pick<SubjectChip, 'id' | 'name'>,
): SubjectChip {
  return {
    order: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function study(
  partial: Partial<StudyRecord> & Pick<StudyRecord, 'id' | 'studiedOn'>,
): StudyRecord {
  return {
    subjectId: 'sub-1',
    subjectName: '전공',
    content: '내용',
    cycle: [1, 3, 7, 15, 30, 60],
    checks: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('pickWinner', () => {
  it('prefers newer updatedAt', () => {
    const local = subject({
      id: '1',
      name: '로컬',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const remote = subject({
      id: '1',
      name: '원격',
      updatedAt: '2026-03-01T00:00:00.000Z',
    });
    expect(pickWinner(local, remote, deviceA, deviceB).name).toBe('원격');
  });

  it('breaks ties with greater deviceId', () => {
    const local = subject({
      id: '1',
      name: '로컬',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const remote = subject({
      id: '1',
      name: '원격',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(pickWinner(local, remote, deviceA, deviceB).name).toBe('원격');
    expect(pickWinner(local, remote, deviceB, deviceA).name).toBe('로컬');
  });
});

describe('mergeChecks', () => {
  it('merges per-interval by updatedAt', () => {
    const merged = mergeChecks(
      {
        '1': { done: true, updatedAt: '2026-01-02T00:00:00.000Z' },
        '3': { done: false, updatedAt: '2026-01-01T00:00:00.000Z' },
      },
      {
        '3': { done: true, updatedAt: '2026-01-03T00:00:00.000Z' },
        '7': { done: true, updatedAt: '2026-01-01T00:00:00.000Z' },
      },
    );
    expect(merged['1']?.done).toBe(true);
    expect(merged['3']?.done).toBe(true);
    expect(merged['7']?.done).toBe(true);
  });
});

describe('mergeAppData', () => {
  it('unions by id and keeps deleted when newest', () => {
    const local: AppData = {
      subjects: [
        subject({
          id: 's1',
          name: '전공',
          color: '#62B3F6',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      records: [
        study({
          id: 'r1',
          studiedOn: '2026-01-10',
          content: '로컬',
          updatedAt: '2026-01-10T00:00:00.000Z',
          checks: {
            '1': { done: false, updatedAt: '2026-01-10T00:00:00.000Z' },
          },
        }),
      ],
      schedules: [],
    };
    const remoteSubjects = [
      subject({
        id: 's1',
        name: '전공',
        color: '#5DCB85',
        updatedAt: '2026-01-05T00:00:00.000Z',
      }),
      subject({
        id: 's2',
        name: '목록',
        color: '#62B3F6',
        order: 1,
        updatedAt: '2026-01-02T00:00:00.000Z',
      }),
    ];
    const remoteRecords = [
      study({
        id: 'r1',
        studiedOn: '2026-01-10',
        content: '원격삭제',
        updatedAt: '2026-01-12T00:00:00.000Z',
        deleted: true,
        checks: {
          '1': { done: true, updatedAt: '2026-01-11T00:00:00.000Z' },
        },
      }),
      study({
        id: 'r2',
        studiedOn: '2026-01-11',
        content: '새기록',
        updatedAt: '2026-01-11T00:00:00.000Z',
      }),
    ];

    const merged = mergeAppData({
      local,
      remoteSubjects,
      remoteRecords,
      localDeviceId: deviceA,
      remoteDeviceId: deviceB,
      // Keep Jan tombstones inside the 180-day window.
      now: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(merged.subjects).toHaveLength(2);
    expect(merged.subjects.find((s) => s.id === 's1')?.color).toBe('#5DCB85');
    const r1 = merged.records.find((r) => r.id === 'r1');
    expect(r1?.deleted).toBe(true);
    expect(r1?.checks['1']?.done).toBe(true);
    expect(merged.records.some((r) => r.id === 'r2')).toBe(true);
  });
});

describe('dedupeStudyRecords', () => {
  it('soft-deletes content twins with different ids, keeps newest', () => {
    const older = study({
      id: 'a',
      studiedOn: '2026-11-20',
      subjectId: 'edu',
      content: '만능틀 적용, 연습',
      updatedAt: '2026-11-20T01:00:00.000Z',
    });
    const newer = study({
      id: 'b',
      studiedOn: '2026-11-20',
      subjectId: 'edu',
      content: '만능틀 적용, 연습',
      updatedAt: '2026-11-20T02:00:00.000Z',
    });
    const { records, didChange } = dedupeStudyRecords([older, newer], new Date('2026-11-20T03:00:00.000Z'));
    expect(didChange).toBe(true);
    const active = records.filter((r) => !r.deleted);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe('b');
    expect(records.find((r) => r.id === 'a')?.deleted).toBe(true);
  });
});

describe('purgeExpiredTombstones', () => {
  it(`drops soft-deletes older than ${SOFT_DELETE_PURGE_DAYS} days`, () => {
    const now = new Date('2026-11-19T00:00:00.000Z');
    const old = new Date(
      now.getTime() - (SOFT_DELETE_PURGE_DAYS + 1) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const recent = new Date(
      now.getTime() - (SOFT_DELETE_PURGE_DAYS - 1) * 24 * 60 * 60 * 1000,
    ).toISOString();

    const purged = purgeExpiredTombstones(
      {
        subjects: [
          subject({ id: 'old', name: '옛', deleted: true, updatedAt: old }),
          subject({
            id: 'keep',
            name: '최근',
            deleted: true,
            updatedAt: recent,
          }),
        ],
        records: [
          study({
            id: 'old-r',
            studiedOn: '2026-01-01',
            deleted: true,
            updatedAt: old,
          }),
        ],
        schedules: [],
      },
      now,
    );

    expect(purged.subjects.map((s) => s.id)).toEqual(['keep']);
    expect(purged.records).toHaveLength(0);
  });
});
