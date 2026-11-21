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
      themeId: 'multicolor',
    });
  });

  it('keeps weekStartsOn and derives primary from themeId', () => {
    expect(
      normalizeSyncedPrefsBody({
        weekStartsOn: 1,
        themeId: 'forest',
        themePrimary: '#45c775',
      }),
    ).toEqual({
      weekStartsOn: 1,
      themePrimary: '#45c775',
      themeId: 'forest',
    });
  });

  it('infers themeId from legacy themePrimary when themeId missing', () => {
    expect(
      normalizeSyncedPrefsBody({
        weekStartsOn: 0,
        themePrimary: '#ef5b7a',
      }),
    ).toEqual({
      weekStartsOn: 0,
      themePrimary: '#ef5b7a',
      themeId: 'cherry',
    });
  });

  it('maps legacy blue primary to 알록달록', () => {
    expect(
      normalizeSyncedPrefsBody({
        weekStartsOn: 0,
        themePrimary: '#1991ff',
      }).themeId,
    ).toBe('multicolor');
  });
});

describe('mergeSyncedPrefsPayload', () => {
  it('picks newer updatedAt', () => {
    const older = buildSyncedPrefsPayload(
      'dev-a',
      {
        weekStartsOn: 0,
        themePrimary: '#1991ff',
        themeId: 'multicolor',
      },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const newer = buildSyncedPrefsPayload(
      'dev-b',
      {
        weekStartsOn: 1,
        themePrimary: '#45c775',
        themeId: 'forest',
      },
      new Date('2026-06-01T00:00:00.000Z'),
    );
    expect(mergeSyncedPrefsPayload(older, newer)?.prefs.weekStartsOn).toBe(1);
    expect(mergeSyncedPrefsPayload(newer, older)?.prefs.themeId).toBe('forest');
  });

  it('breaks ties with greater deviceId', () => {
    const a = buildSyncedPrefsPayload(
      'aaa',
      {
        weekStartsOn: 0,
        themePrimary: '#1991ff',
        themeId: 'multicolor',
      },
      new Date('2026-01-01T00:00:00.000Z'),
    );
    const b = buildSyncedPrefsPayload(
      'bbb',
      {
        weekStartsOn: 1,
        themePrimary: '#45c775',
        themeId: 'forest',
      },
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
      themePrimary: '#8B7CF6',
      themeId: 'lavender',
    });
    expect(parseSyncedPrefsPayload(JSON.stringify(payload))).toEqual(payload);
  });
});
