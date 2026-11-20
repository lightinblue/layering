import type { ChromePalette } from '@/constants/palette';

type Rgba = { r: number; g: number; b: number; a: number };

function parseColor(raw: string): Rgba | null {
  const value = raw.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map((c) => `${c}${c}`)
            .join('')
        : hex;
    if (full.length !== 6) return null;
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return null;
    return {
      r: (n >> 16) & 255,
      g: (n >> 8) & 255,
      b: n & 255,
      a: 1,
    };
  }

  const rgba = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (!rgba) return null;
  return {
    r: Number(rgba[1]),
    g: Number(rgba[2]),
    b: Number(rgba[3]),
    a: rgba[4] == null ? 1 : Number(rgba[4]),
  };
}

function formatColor(from: string, channels: Rgba): string {
  if (from.trim().startsWith('rgba') || channels.a < 0.999) {
    const a = Math.round(channels.a * 1000) / 1000;
    return `rgba(${Math.round(channels.r)}, ${Math.round(channels.g)}, ${Math.round(channels.b)}, ${a})`;
  }
  const { r, g, b } = channels;
  return `#${((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b))
    .toString(16)
    .slice(1)}`;
}

/** Linear mix for `#RRGGBB` / `rgba(...)` strings. Unknown formats snap at t≥0.5. */
export function mixColor(from: string, to: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0) return from;
  if (clamped >= 1) return to;
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return clamped < 0.5 ? from : to;
  return formatColor(to.startsWith('rgba') || from.startsWith('rgba') ? 'rgba' : from, {
    r: a.r + (b.r - a.r) * clamped,
    g: a.g + (b.g - a.g) * clamped,
    b: a.b + (b.b - a.b) * clamped,
    a: a.a + (b.a - a.a) * clamped,
  });
}

/** Interpolate every chrome token between two palettes. */
export function mixThemeColors(
  from: ChromePalette,
  to: ChromePalette,
  t: number,
): ChromePalette {
  const clamped = Math.min(1, Math.max(0, t));
  if (clamped <= 0) return from;
  if (clamped >= 1) return to;

  return {
    mainWhite: mixColor(from.mainWhite, to.mainWhite, clamped),
    white: mixColor(from.white, to.white, clamped),
    black: mixColor(from.black, to.black, clamped),
    primary: mixColor(from.primary, to.primary, clamped),
    primarySoft: mixColor(from.primarySoft, to.primarySoft, clamped),
    surface: mixColor(from.surface, to.surface, clamped),
    muted: mixColor(from.muted, to.muted, clamped),
    mutedLight: mixColor(from.mutedLight, to.mutedLight, clamped),
    sectionLabel: mixColor(from.sectionLabel, to.sectionLabel, clamped),
    body: mixColor(from.body, to.body, clamped),
    bodyAlt: mixColor(from.bodyAlt, to.bodyAlt, clamped),
    accentText: mixColor(from.accentText, to.accentText, clamped),
    chipBlue: mixColor(from.chipBlue, to.chipBlue, clamped),
    chipGreen: mixColor(from.chipGreen, to.chipGreen, clamped),
    chipYellow: mixColor(from.chipYellow, to.chipYellow, clamped),
    chipPurple: mixColor(from.chipPurple, to.chipPurple, clamped),
    chipPink: mixColor(from.chipPink, to.chipPink, clamped),
    chipOrange: mixColor(from.chipOrange, to.chipOrange, clamped),
    chipGray: mixColor(from.chipGray, to.chipGray, clamped),
    fabShadowColor: mixColor(from.fabShadowColor, to.fabShadowColor, clamped),
    fabShadowOpacity:
      from.fabShadowOpacity +
      (to.fabShadowOpacity - from.fabShadowOpacity) * clamped,
    backdrop: mixColor(from.backdrop, to.backdrop, clamped),
    hairline: mixColor(from.hairline, to.hairline, clamped),
    onAccent: mixColor(from.onAccent, to.onAccent, clamped),
    softMixTarget: mixColor(from.softMixTarget, to.softMixTarget, clamped),
  };
}
