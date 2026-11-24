/** Design tokens from Figma Home (zgjHZrcERnHvzlG6cfxE0Y). */

import { Platform } from 'react-native';

import { lightPalette } from '@/constants/palette';

/**
 * TextInput font size. iOS Safari zooms the page when focused inputs are
 * under 16px — keep web at 16 for a11y (no maximum-scale viewport hack).
 */
export const textInputFontSize = Platform.OS === 'web' ? 16 : 15;

/** @deprecated Prefer `useThemeColors()` — static light fallback for module-level styles. */
export const colors = { ...lightPalette } as const;

export const spacing = {
  weekGap: 1,
  sectionGap: 28,
  /** Gap between topBlock and sections (and other frame siblings). */
  blockGap: 18,
  /** Gap between date header and week strip (tighter than blockGap). */
  headerWeekGap: 10,
  studyRowGap: 5,
  reviewGap: 10,
  labelPad: 8,
  contentWidth: 332,
  headerWidth: 345,
  frameWidth: 356,
} as const;

export const radii = {
  weekDay: 14,
  chip: 12,
  reviewCard: 12,
  reviewChip: 6,
  checkbox: 8,
  fab: 16,
} as const;

export const sizes = {
  dayNumber: 80,
  ellipse: 24,
  weekCell: { width: 50, height: 58 },
  studyChip: { width: 77, height: 44 },
  studyBodyHeight: 44,
  /** Visual size; pair with hitSlop so touch stays ~44. */
  reviewCheckbox: 32,
  /** Review subject marker: 24×24 color square with first glyph. */
  reviewChip: { width: 24, height: 24 },
  fab: 57,
  fabIcon: 28,
  addStudyHeight: 66,
  checkIcon: 20,
  arrow: 14,
  plus: 19.2,
} as const;

/** Subject chip color map used in Figma mocks / seed chips. */
export const SUBJECT_COLORS: Record<string, string> = {
  전공: colors.chipBlue,
  분류: colors.chipBlue,
  교육학: colors.chipGreen,
  정검: colors.chipGray,
};

/**
 * Fallback subject swatches (prefer theme `chipPalette`).
 * Rainbow/spectrum order: pink → … → purple → gray.
 */
export const SUBJECT_COLOR_OPTIONS: readonly string[] = [
  colors.chipPink,
  colors.chipOrange,
  colors.chipYellow,
  colors.chipGreen,
  '#5BB8C9',
  colors.chipBlue,
  colors.chipPurple,
  colors.chipGray,
];

/** Resolve chip fill: explicit override → name map → gray. */
export function subjectColor(
  name: string,
  colorByName?: Record<string, string> | string | null,
): string {
  if (typeof colorByName === 'string' && colorByName.length > 0) {
    return colorByName;
  }
  if (colorByName && typeof colorByName === 'object' && colorByName[name]) {
    return colorByName[name];
  }
  return SUBJECT_COLORS[name] ?? colors.chipGray;
}

/** Parse `#RRGGBB` / `#RGB` → 0–255 channels (or null). */
function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Darken a `#RRGGBB` (or `#RGB`) hex for same-hue chip borders.
 * Mild default so selected subject chips keep a soft rim.
 */
export function darkenHex(hex: string, amount = 0.1): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return hex;
  const factor = 1 - amount;
  return toHex({
    r: Math.max(0, Math.round(rgb.r * factor)),
    g: Math.max(0, Math.round(rgb.g * factor)),
    b: Math.max(0, Math.round(rgb.b * factor)),
  });
}

/**
 * Mix hex toward a canvas color for soft accent surfaces (selected cards).
 * Light mode → toward white; dark mode → toward dark canvas.
 */
export function softFromPrimary(
  hex: string,
  mix = 0.86,
  towardHex: string = lightPalette.softMixTarget,
): string {
  const rgb = parseHexRgb(hex);
  const toward = parseHexRgb(towardHex) ?? { r: 255, g: 255, b: 255 };
  if (!rgb) return towardHex;
  const t = Math.min(1, Math.max(0, mix));
  return toHex({
    r: Math.round(rgb.r + (toward.r - rgb.r) * t),
    g: Math.round(rgb.g + (toward.g - rgb.g) * t),
    b: Math.round(rgb.b + (toward.b - rgb.b) * t),
  });
}

export function subjectBorderColor(
  name: string,
  colorByName?: Record<string, string> | string | null,
): string {
  return darkenHex(subjectColor(name, colorByName));
}

/** Solid accent options (theme primaries; Settings picks themes, not raw swatches). */
export const PRIMARY_OPTIONS = [
  '#1991ff',
  '#45c775',
  '#ff7a45',
  '#ef5b7a',
  colors.chipYellow,
  '#8B7CF6',
] as const;

export type PrimaryOption = (typeof PRIMARY_OPTIONS)[number];

export const DEFAULT_PRIMARY: PrimaryOption = PRIMARY_OPTIONS[0];

export function isPrimaryOption(value: string): value is PrimaryOption {
  return (PRIMARY_OPTIONS as readonly string[]).includes(value);
}
