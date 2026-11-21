import { describe, expect, it } from 'vitest';

import {
  APP_THEMES,
  MULTICOLOR_CHIPS,
  THEME_IDS,
  THEME_NEUTRAL_GRAY,
  coerceThemeId,
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

  it('orders themes in a connected hue path after 알록달록', () => {
    expect([...THEME_IDS]).toEqual([
      'multicolor',
      'sunset',
      'forest',
      'sky',
      'lilac',
    ]);
  });

  it('keeps every theme primary in PRIMARY_OPTIONS', () => {
    for (const theme of APP_THEMES) {
      expect(isPrimaryOption(theme.primary)).toBe(true);
      expect(PRIMARY_OPTIONS).toContain(theme.primary);
    }
  });

  it('ships nine chips per theme ending with neutral gray', () => {
    for (const theme of APP_THEMES) {
      expect(theme.chips).toHaveLength(9);
      expect(theme.chips[theme.chips.length - 1]!.toLowerCase()).toBe(
        THEME_NEUTRAL_GRAY.toLowerCase(),
      );
    }
  });

  it('uses a yellow picker swatch for 노을 while primary stays orange', () => {
    const sunset = getTheme('sunset');
    expect(sunset.primary.toLowerCase()).toBe('#ff7a45');
    expect(sunset.swatch?.toLowerCase()).toBe('#f5c21c');
  });
});

describe('coerceThemeId', () => {
  it('maps merged legacy ids', () => {
    expect(coerceThemeId('lemon')).toBe('sunset');
    expect(coerceThemeId('cherry')).toBe('lilac');
    expect(coerceThemeId('lavender')).toBe('lilac');
  });
});

describe('themeIdForPrimary', () => {
  it('maps brand blue to multicolor', () => {
    expect(themeIdForPrimary('#1991ff')).toBe('multicolor');
  });

  it('maps green to forest', () => {
    expect(themeIdForPrimary('#45c775')).toBe('forest');
  });

  it('maps yellow and purple primaries onto merged themes', () => {
    expect(themeIdForPrimary('#F5C21C')).toBe('sunset');
    expect(themeIdForPrimary('#8B7CF6')).toBe('lilac');
  });
});

describe('remapColorToPalette', () => {
  const from = MULTICOLOR_CHIPS;
  const to = getTheme('sky').chips;

  it('keeps colors already in the target palette', () => {
    expect(remapColorToPalette(to[2]!, from, to)).toBe(to[2]);
  });

  it('maps by index when color is in the source palette', () => {
    // pink / green are not also members of sky — pure index remap
    expect(remapColorToPalette(from[0]!, from, to)).toBe(to[0]);
    expect(remapColorToPalette(from[3]!, from, to)).toBe(to[3]);
  });

  it('falls back to nearest when unknown', () => {
    const mapped = remapColorToPalette('#0000ff', from, to);
    expect(to).toContain(mapped);
  });
});
