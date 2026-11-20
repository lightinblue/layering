import { describe, expect, it } from 'vitest';

import {
  buildSyncedPrefsPayload,
  mergeSyncedPrefsPayload,
  normalizeSyncedPrefsBody,
  parseSyncedPrefsPayload,
} from '@/storage/synced-prefs';

describe('normalizeSyncedPrefsBody', () => {
  it('defaults missing fields', () => {
    expect(normalizeSyncedPrefsBody({})).toEqual({
      weekStartsOn: 0,
      themePrimary: '#1991ff',
    });
  });

  it('keeps weekStartsOn and valid themePrimary', () => {
    expect(
      normalizeSyncedPrefsBody({
        weekStartsOn: 1,
        themePrimary: '#45c775',
      }),
    ).toEqual({ weekStartsOn: 1, themePrimary: '#45c775' });
  });
});

describe('mergeSyncedPrefsPayload', () => {
  it('picks newer updatedAt', () => {
    const older = buildSyncedPrefsPayload(
      'dev-a',
      { weekStartsOn: 0, themePrimary: '#62B3F6' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const newer = buildSyncedPrefsPayload(
      'dev-b',
      { weekStartsOn: 1, themePrimary: '#45c775' },
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(mergeSyncedPrefsPayload(older, newer)?.prefs.weekStartsOn).toBe(1);
    expect(mergeSyncedPrefsPayload(newer, older)?.prefs.weekStartsOn).toBe(1);
  });

  it('breaks ties with greater deviceId', () => {
    const a = buildSyncedPrefsPayload(
      'aaa',
      { weekStartsOn: 0, themePrimary: '#62B3F6' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const b = buildSyncedPrefsPayload(
      'bbb',
      { weekStartsOn: 1, themePrimary: '#45c775' },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(mergeSyncedPrefsPayload(a, b)?.deviceId).toBe('bbb');
  });
});

describe('parseSyncedPrefsPayload', () => {
  it('rejects malformed JSON', () => {
    expect(parseSyncedPrefsPayload('{')).toBeNull();
    expect(parseSyncedPrefsPayload('{}')).toBeNull();
  });

  it('parses a valid payload', () => {
    const payload = buildSyncedPrefsPayload('dev', {
      weekStartsOn: 1,
      themePrimary: '#62B3F6',
    });
    expect(parseSyncedPrefsPayload(JSON.stringify(payload))).toEqual(payload);
  });
});
