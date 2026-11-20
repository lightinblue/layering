/**
 * Light / dark chrome palettes for 포개.
 * Brand primary stays `#1991ff`. Property names keep light-era semantics
 * (`mainWhite` = canvas, `black` = primary ink) so call sites stay stable.
 */

export type ColorSchemeName = 'light' | 'dark';

export type ChromePalette = {
  mainWhite: string;
  white: string;
  black: string;
  primary: string;
  primarySoft: string;
  surface: string;
  muted: string;
  mutedLight: string;
  sectionLabel: string;
  body: string;
  bodyAlt: string;
  accentText: string;
  chipBlue: string;
  chipGreen: string;
  chipYellow: string;
  chipPurple: string;
  chipPink: string;
  chipOrange: string;
  chipGray: string;
  /** Solid shadow color for FAB / toast (pair with fabShadowOpacity). */
  fabShadowColor: string;
  fabShadowOpacity: number;
  /** Sheet / modal scrim. */
  backdrop: string;
  /** Empty-card / hairline borders. */
  hairline: string;
  /** Text on primary / chip fills — always white. */
  onAccent: string;
  /** Mix target for softFromPrimary (canvas in the active scheme). */
  softMixTarget: string;
};

const BRAND_PRIMARY = '#1991ff';

/** Shared chip accents (readable on both schemes). */
const CHIPS = {
  chipBlue: '#62B3F6',
  chipGreen: '#5DCB85',
  chipYellow: '#F5C21C',
  chipPurple: '#B7A4E9',
  chipPink: '#F65E83',
  chipOrange: '#FE9253',
  chipGray: '#B2B2B2',
} as const;

export const lightPalette: ChromePalette = {
  mainWhite: '#ffffff',
  white: '#ffffff',
  black: '#000000',
  primary: BRAND_PRIMARY,
  primarySoft: '#dff0ff',
  surface: '#f2f6fa',
  muted: '#9fb1c1',
  mutedLight: '#ced7e0',
  sectionLabel: '#708AA2',
  body: '#526477',
  bodyAlt: '#646464',
  accentText: '#708aa2',
  ...CHIPS,
  fabShadowColor: '#343D4B',
  fabShadowOpacity: 0.16,
  backdrop: 'rgba(0, 0, 0, 0.4)',
  hairline: '#e4eaef',
  onAccent: '#ffffff',
  softMixTarget: '#ffffff',
};

/** Cool near-black canvas — not pure black, no purple cast. */
export const darkPalette: ChromePalette = {
  mainWhite: '#0B0F14',
  white: '#151B22',
  black: '#E8EEF4',
  primary: BRAND_PRIMARY,
  primarySoft: '#16324A',
  surface: '#1A222C',
  muted: '#8B9AAB',
  mutedLight: '#3A4554',
  sectionLabel: '#9AABBC',
  body: '#C5CED8',
  bodyAlt: '#A8B2BC',
  accentText: '#9AABBC',
  ...CHIPS,
  fabShadowColor: '#000000',
  fabShadowOpacity: 0.45,
  backdrop: 'rgba(0, 0, 0, 0.55)',
  hairline: '#2A3440',
  onAccent: '#ffffff',
  softMixTarget: '#0B0F14',
};

export function paletteFor(scheme: ColorSchemeName): ChromePalette {
  return scheme === 'dark' ? darkPalette : lightPalette;
}
