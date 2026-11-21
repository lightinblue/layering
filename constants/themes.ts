import { colors } from '@/constants/tokens';

/**
 * App themes: fixed primary + coordinated subject-chip palette.
 * `multicolor` (알록달록) lists chips in rainbow/spectrum order (+ gray).
 * Family themes mix related hues (not mono tints) so chips stay distinguishable.
 * Picker order follows a connected hue path after 알록달록.
 */

export const THEME_IDS = [
  'multicolor',
  'sunset',
  'forest',
  'sky',
  'lilac',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Legacy theme ids from earlier builds → current id. */
const THEME_ID_ALIASES: Record<string, ThemeId> = {
  lemon: 'sunset',
  cherry: 'lilac',
  lavender: 'lilac',
};

export type AppTheme = {
  id: ThemeId;
  /** Settings label (Korean). */
  label: string;
  /** Accent / chrome primary. */
  primary: string;
  /**
   * Settings picker circle fill when solid (omit → use `primary`).
   * 알록달록 ignores this and renders a multicolor pie.
   */
  swatch?: string;
  /** Subject chip swatches (pickable; length 8, last = neutral gray). */
  chips: readonly string[];
};

/** Shared neutral chip (every palette includes one). */
export const THEME_NEUTRAL_GRAY = colors.chipGray;

/**
 * 알록달록: rainbow/spectrum order for add/list swatches, then gray.
 * pink → orange → yellow → green → teal → blue → purple → gray
 */
export const MULTICOLOR_CHIPS = [
  colors.chipPink,
  colors.chipOrange,
  colors.chipYellow,
  colors.chipGreen,
  '#5BB8C9',
  colors.chipBlue,
  colors.chipPurple,
  THEME_NEUTRAL_GRAY,
] as const;

/**
 * Hue-connected picker order: 알록달록 → warm → green → blue → pink/purple.
 */
export const APP_THEMES: readonly AppTheme[] = [
  {
    id: 'multicolor',
    label: '알록달록',
    primary: '#1991ff',
    chips: MULTICOLOR_CHIPS,
  },
  {
    id: 'sunset',
    label: '노을',
    /** Chrome + picker yellow; chips keep yellow/orange mix. */
    primary: '#F5C21C',
    // Yellow + orange + coral (8 incl. gray)
    chips: [
      '#FBE28A',
      '#F5C21C',
      '#FFB347',
      '#FE9253',
      '#ff7a45',
      '#E85A28',
      '#C94A1A',
      THEME_NEUTRAL_GRAY,
    ],
  },
  {
    id: 'forest',
    label: '숲',
    primary: '#45c775',
    // Green + yellow-green + teal; chips 2–3 stay light mint vs deep green
    chips: [
      '#A8C95C',
      '#6EDC9A',
      '#2E9B5A',
      '#45c775',
      '#1E8A4A',
      '#3DB8A0',
      '#0D7A6A',
      THEME_NEUTRAL_GRAY,
    ],
  },
  {
    id: 'sky',
    label: '하늘',
    primary: '#1991ff',
    // Blue + teal + soft violet
    chips: [
      '#9DC4F0',
      '#62B3F6',
      '#1991ff',
      '#0D6FD4',
      '#5BB8C9',
      '#2A9AA8',
      '#6B8AE8',
      THEME_NEUTRAL_GRAY,
    ],
  },
  {
    id: 'lilac',
    label: '라일락',
    primary: '#ef5b7a',
    // Pink + purple: light → vivid → deep, then purple range
    chips: [
      '#FFC0D4',
      '#F65E83',
      '#B71C5A',
      '#ef5b7a',
      '#B7A4E9',
      '#8B7CF6',
      '#5E4BCF',
      THEME_NEUTRAL_GRAY,
    ],
  },
] as const;

export const DEFAULT_THEME_ID: ThemeId = 'multicolor';

const THEME_BY_ID: Record<ThemeId, AppTheme> = Object.fromEntries(
  APP_THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, AppTheme>;

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return (
    typeof value === 'string' &&
    (THEME_IDS as readonly string[]).includes(value)
  );
}

/** Resolve current or legacy theme id (lemon/cherry/lavender → merged). */
export function coerceThemeId(
  value: string | null | undefined,
): ThemeId | null {
  if (!value) return null;
  if (isThemeId(value)) return value;
  return THEME_ID_ALIASES[value] ?? null;
}

export function getTheme(id: ThemeId): AppTheme {
  return THEME_BY_ID[id] ?? THEME_BY_ID[DEFAULT_THEME_ID];
}

/**
 * Infer theme from a stored primary when `themeId` is missing (legacy prefs).
 * `#1991ff` → 알록달록 (preserve prior “blue accent + mixed chips” feel).
 */
export function themeIdForPrimary(primary: string): ThemeId {
  const hex = primary.trim().toLowerCase();
  if (hex === '#1991ff') return 'multicolor';
  if (hex === '#f5c21c' || hex === '#ff7a45') return 'sunset';
  if (hex === '#8b7cf6') return 'lilac';
  const match = APP_THEMES.find(
    (t) => t.id !== 'multicolor' && t.primary.toLowerCase() === hex,
  );
  return match?.id ?? DEFAULT_THEME_ID;
}

function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  let raw = hex.trim();
  if (raw.startsWith('#')) raw = raw.slice(1);
  if (raw.length === 3) {
    raw = raw
      .split('')
      .map((c) => `${c}${c}`)
      .join('');
  }
  if (raw.length !== 6) return null;
  const n = Number.parseInt(raw, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDistance(a: string, b: string): number {
  const aa = parseHexRgb(a);
  const bb = parseHexRgb(b);
  if (!aa || !bb) return Number.POSITIVE_INFINITY;
  const dr = aa.r - bb.r;
  const dg = aa.g - bb.g;
  const db = aa.b - bb.b;
  return dr * dr + dg * dg + db * db;
}

/** Map a chip color onto `toPalette` by index in `fromPalette`, else nearest. */
export function remapColorToPalette(
  color: string,
  fromPalette: readonly string[],
  toPalette: readonly string[],
): string {
  if (toPalette.length === 0) return color;
  const normalized = color.trim().toLowerCase();
  const inTo = toPalette.find((c) => c.toLowerCase() === normalized);
  if (inTo) return inTo;

  const idx = fromPalette.findIndex((c) => c.toLowerCase() === normalized);
  if (idx >= 0) {
    return toPalette[idx % toPalette.length]!;
  }

  let best = toPalette[0]!;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of toPalette) {
    const d = colorDistance(normalized, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}
