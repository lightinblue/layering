import { describe, expect, it } from 'vitest';

import { darkPalette, lightPalette } from '@/constants/palette';
import { mixColor, mixThemeColors } from '@/theme/mix-theme-colors';

describe('mixColor', () => {
  it('returns endpoints at 0 and 1', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColor('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('mixes hex midpoints', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('mixes rgba alpha', () => {
    expect(mixColor('rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.6)', 0.5)).toBe(
      'rgba(0, 0, 0, 0.5)',
    );
  });
});

describe('mixThemeColors', () => {
  it('lands on the target palette at t=1', () => {
    const mixed = mixThemeColors(lightPalette, darkPalette, 1);
    expect(mixed.mainWhite).toBe(darkPalette.mainWhite);
    expect(mixed.fabShadowOpacity).toBe(darkPalette.fabShadowOpacity);
  });

  it('blends canvas mid-transition', () => {
    const mixed = mixThemeColors(lightPalette, darkPalette, 0.5);
    expect(mixed.mainWhite).not.toBe(lightPalette.mainWhite);
    expect(mixed.mainWhite).not.toBe(darkPalette.mainWhite);
    expect(mixed.mainWhite.startsWith('#')).toBe(true);
  });
});
