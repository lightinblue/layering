import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  type ColorSchemeName,
  paletteFor,
  type ChromePalette,
} from '@/constants/palette';
import {
  DEFAULT_PRIMARY,
  softFromPrimary,
  type PrimaryOption,
} from '@/constants/tokens';
import {
  DEFAULT_APPEARANCE,
  loadAppearancePreference,
  saveAppearancePreference,
  type AppearancePreference,
} from '@/storage/appearance';
import { loadThemePrimary, saveThemePrimary } from '@/storage/theme';

export type ThemeColors = ChromePalette;

type ThemeContextValue = {
  colors: ThemeColors;
  primary: PrimaryOption;
  setPrimary: (primary: PrimaryOption) => void;
  /** User preference: system / light / dark. */
  appearance: AppearancePreference;
  setAppearance: (value: AppearancePreference) => void;
  /** Resolved scheme after applying preference. */
  colorScheme: ColorSchemeName;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildColors(
  scheme: ColorSchemeName,
  primary: PrimaryOption,
): ThemeColors {
  const base = paletteFor(scheme);
  const softMix = scheme === 'dark' ? 0.78 : 0.86;
  return {
    ...base,
    primary,
    primarySoft: softFromPrimary(primary, softMix, base.softMixTarget),
  };
}

function resolveScheme(
  preference: AppearancePreference,
  system: string | null | undefined,
): ColorSchemeName {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const [primary, setPrimaryState] = useState<PrimaryOption>(DEFAULT_PRIMARY);
  const [appearance, setAppearanceState] =
    useState<AppearancePreference>(DEFAULT_APPEARANCE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedPrimary, storedAppearance] = await Promise.all([
        loadThemePrimary(),
        loadAppearancePreference(),
      ]);
      if (cancelled) return;
      setPrimaryState(storedPrimary);
      setAppearanceState(storedAppearance);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPrimary = useCallback((next: PrimaryOption) => {
    setPrimaryState(next);
    void saveThemePrimary(next);
  }, []);

  const setAppearance = useCallback((next: AppearancePreference) => {
    setAppearanceState(next);
    void saveAppearancePreference(next);
  }, []);

  const colorScheme = resolveScheme(appearance, systemScheme);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: buildColors(colorScheme, primary),
      primary,
      setPrimary,
      appearance,
      setAppearance,
      colorScheme,
      hydrated,
    }),
    [
      appearance,
      colorScheme,
      hydrated,
      primary,
      setAppearance,
      setPrimary,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Safe fallback when a leaf may render outside the provider (tests). */
export function useThemeColors(): ThemeColors {
  const ctx = useContext(ThemeContext);
  if (!ctx) return buildColors('light', DEFAULT_PRIMARY);
  return ctx.colors;
}

export function useColorScheme(): ColorSchemeName {
  const ctx = useContext(ThemeContext);
  if (!ctx) return 'light';
  return ctx.colorScheme;
}
