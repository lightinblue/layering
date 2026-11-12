/** Design tokens from Figma Home (zgjHZrcERnHvzlG6cfxE0Y). */

export const colors = {
  mainWhite: '#ffffff',
  white: '#ffffff',
  black: '#000000',
  primary: '#1991ff',
  primarySoft: '#dff0ff',
  surface: '#f2f6fa',
  muted: '#9fb1c1',
  mutedLight: '#ced7e0',
  sectionLabel: '#708AA2',
  body: '#526477',
  bodyAlt: '#646464',
  accentText: '#708aa2',
  chipBlue: '#62B3F6',
  chipGreen: '#5DCB85',
  chipYellow: '#F5C21C',
  chipPurple: '#B7A4E9',
  chipPink: '#F65E83',
  chipOrange: '#FE9253',
  chipGray: '#B2B2B2',
  fabShadow: 'rgba(52, 61, 75, 0.16)',
} as const;

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
 * Palette for new subject chips (Figma subject swatches).
 * Order: pink → orange → yellow → green → blue → purple → gray.
 */
export const SUBJECT_COLOR_OPTIONS: readonly string[] = [
  colors.chipPink,
  colors.chipOrange,
  colors.chipYellow,
  colors.chipGreen,
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

/**
 * Study/review chip fill when the subject may have been deleted.
 * Prefer stored hex → live map → neutral gray (never re-hue a deleted name).
 */
export function studySubjectFill(
  subjectName: string,
  options?: {
    storedColor?: string | null;
    missing?: boolean;
    colorByName?: Record<string, string> | null;
  },
): string {
  const stored = options?.storedColor?.trim();
  if (stored) return stored;
  if (options?.missing) return colors.chipGray;
  return subjectColor(subjectName, options?.colorByName);
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

/** Mix hex toward white for soft accent surfaces (selected cards, chips). */
export function softFromPrimary(hex: string, whiteMix = 0.86): string {
  const rgb = parseHexRgb(hex);
  if (!rgb) return colors.primarySoft;
  const t = Math.min(1, Math.max(0, whiteMix));
  return toHex({
    r: Math.round(rgb.r + (255 - rgb.r) * t),
    g: Math.round(rgb.g + (255 - rgb.g) * t),
    b: Math.round(rgb.b + (255 - rgb.b) * t),
  });
}

export function subjectBorderColor(
  name: string,
  colorByName?: Record<string, string> | string | null,
): string {
  return darkenHex(subjectColor(name, colorByName));
}

/** Solid accent options for Settings → 색상 (first = default blue). */
export const PRIMARY_OPTIONS = [
  '#1991ff',
  '#45c775',
  '#ff7a45',
  '#ef5b7a',
  colors.chipYellow,
] as const;

export type PrimaryOption = (typeof PRIMARY_OPTIONS)[number];

export const DEFAULT_PRIMARY: PrimaryOption = PRIMARY_OPTIONS[0];

export function isPrimaryOption(value: string): value is PrimaryOption {
  return (PRIMARY_OPTIONS as readonly string[]).includes(value);
}
