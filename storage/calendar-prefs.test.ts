import { describe, expect, it } from 'vitest';

import { normalizeCalendarPrefs } from '@/storage/calendar-prefs';

describe('normalizeCalendarPrefs', () => {
  it('keeps single-field weekStartsOn', () => {
    expect(normalizeCalendarPrefs({ weekStartsOn: 1 })).toEqual({
      weekStartsOn: 1,
    });
  });

  it('migrates legacy two-field blob preferring weekStartsOn', () => {
    expect(
      normalizeCalendarPrefs({ weekStartsOn: 0, monthStartsOn: 1 }),
    ).toEqual({ weekStartsOn: 0 });
  });

  it('falls back to legacy monthStartsOn when weekStartsOn missing', () => {
    expect(normalizeCalendarPrefs({ monthStartsOn: 1 })).toEqual({
      weekStartsOn: 1,
    });
  });
});
