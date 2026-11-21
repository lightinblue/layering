import { colors } from '@/constants/tokens';

/**
 * App themes: fixed primary + coordinated subject-chip palette.
 * `multicolor` (알록달록) keeps the original mixed Figma swatches.
 * Family themes mix related hues (not mono tints) so chips stay distinguishable.
 */

export const THEME_IDS = [
  'multicolor',
  'sky',
  'forest',
  'sunset',
  'cherry',
  'lemon',
  'lavender',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type AppTheme = {
  id: ThemeId;
  /** Settings label (Korean). */
  label: string;
  /** Accent / chrome primary. */
  primary: string;
  /** Subject chip swatches (pickable; length 7). */
  chips: readonly string[];
};

/** Default / legacy mixed palette (Figma order). */
export const MULTICOLOR_CHIPS = [
  colors.chipPink,
  colors.chipOrange,
  colors.chipYellow,
  colors.chipGreen,
  colors.chipBlue,
  colors.chipPurple,
  colors.chipGray,
] as const;

export const APP_THEMES: readonly AppTheme[] = [
  {
    id: 'multicolor',
    label: '알록달록',
    primary: '#1991ff',
    chips: MULTICOLOR_CHIPS,
  },
  {
    id: 'sky',
    label: '하늘',
    primary: '#1991ff',
    // Blue family + teal / soft violet / cool gray
    chips: [
      '#7EB8F0',
      '#1991ff',
      '#5BB8C9',
      '#4A90D9',
      '#6B8AE8',
      '#9DC4F0',
      '#9fb1c1',
    ],
  },
  {
    id: 'forest',
    label: '숲',
    primary: '#45c775',
    // Green + yellow-green + teal + moss
    chips: [
      '#8FD9A8',
      '#45c775',
      '#A8C95C',
      '#2FA85C',
      '#5DCB85',
      '#3DB8A0',
      '#8FA89A',
    ],
  },
  {
    id: 'sunset',
    label: '노을',
    primary: '#ff7a45',
    // Orange + coral + peach + warm rose
    chips: [
      '#FFA87A',
      '#ff7a45',
      '#FE9253',
      '#E85A28',
      '#F06583',
      '#FFB347',
      '#C4A090',
    ],
  },
  {
    id: 'cherry',
    label: '벚꽃',
    primary: '#ef5b7a',
    // Pink + red + soft magenta/purple
    chips: [
      '#F48BA3',
      '#ef5b7a',
      '#E0455A',
      '#F65E83',
      '#C75B8A',
      '#B7A4E9',
      '#C49AA6',
    ],
  },
  {
    id: 'lemon',
    label: '레몬',
    primary: '#F5C21C',
    // Yellow + orange + gold + amber
    chips: [
      '#F7D45A',
      '#F5C21C',
      '#FE9253',
      '#E0A800',
      '#FFB347',
      '#D4A017',
      '#B2A88A',
    ],
  },
  {
    id: 'lavender',
    label: '라벤더',
    primary: '#8B7CF6',
    // Purple + lilac + blue-violet + soft pink-lilac
    chips: [
      '#B7A4E9',
      '#8B7CF6',
      '#A78BFA',
      '#6F5FE0',
      '#9B8CF8',
      '#D4A5E8',
      '#A39BB8',
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
