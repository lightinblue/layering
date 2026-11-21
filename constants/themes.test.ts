import { describe, expect, it } from 'vitest';

import {
  APP_THEMES,
  MULTICOLOR_CHIPS,
  getTheme,
  remapColorToPalette,
  themeIdForPrimary,
} from '@/constants/themes';
import { PRIMARY_OPTIONS, isPrimaryOption } from '@/constants/tokens';

describe('APP_THEMES', () => {
  it('includes 알록달록 with the legacy mixed chip palette', () => {
    const multi = getTheme('multicolor');
    expect(multi.label).toBe('알록달록');
    expect(multi.chips).toEqual([...MULTICOLOR_CHIPS]);
  });

  it('keeps every theme primary in PRIMARY_OPTIONS', () => {
    for (const theme of APP_THEMES) {
      expect(isPrimaryOption(theme.primary)).toBe(true);
      expect(PRIMARY_OPTIONS).toContain(theme.primary);
    }
  });

  it('ships seven chips per theme', () => {
    for (const theme of APP_THEMES) {
      expect(theme.chips).toHaveLength(7);
    }
  });
});

describe('themeIdForPrimary', () => {
  it('maps brand blue to multicolor', () => {
    expect(themeIdForPrimary('#1991ff')).toBe('multicolor');
  });

  it('maps green to forest', () => {
    expect(themeIdForPrimary('#45c775')).toBe('forest');
  });
});

describe('remapColorToPalette', () => {
  const from = MULTICOLOR_CHIPS;
  const to = getTheme('sky').chips;

  it('keeps colors already in the target palette', () => {
    expect(remapColorToPalette(to[2]!, from, to)).toBe(to[2]);
  });

  it('maps by index when color is in the source palette', () => {
    expect(remapColorToPalette(from[0]!, from, to)).toBe(to[0]);
    expect(remapColorToPalette(from[4]!, from, to)).toBe(to[4]);
  });

  it('falls back to nearest when unknown', () => {
    const mapped = remapColorToPalette('#0000ff', from, to);
    expect(to).toContain(mapped);
  });
});
