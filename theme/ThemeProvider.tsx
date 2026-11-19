import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing, useColorScheme as useSystemColorScheme } from 'react-native';

import {
  type ColorSchemeName,
  paletteFor,
  type ChromePalette,
} from '@/constants/palette';
import { durations } from '@/constants/motion';
import {
  DEFAULT_PRIMARY,
  softFromPrimary,
  type PrimaryOption,
} from '@/constants/tokens';
import { loadThemePrimary, saveThemePrimary } from '@/storage/theme';
import { mixThemeColors } from '@/theme/mix-theme-colors';

export type ThemeColors = ChromePalette;

type ThemeContextValue = {
  colors: ThemeColors;
  primary: PrimaryOption;
  setPrimary: (primary: PrimaryOption) => void;
  /** Always follows the device system appearance. */
  colorScheme: ColorSchemeName;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_EASE = Easing.out(Easing.cubic);

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

function resolveSystemScheme(
  system: string | null | undefined,
): ColorSchemeName {
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const colorScheme = resolveSystemScheme(systemScheme);
  const [primary, setPrimaryState] = useState<PrimaryOption>(DEFAULT_PRIMARY);
  const [hydrated, setHydrated] = useState(false);
  const [colors, setColors] = useState<ThemeColors>(() =>
    buildColors(colorScheme, DEFAULT_PRIMARY),
  );

  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const progress = useRef(new Animated.Value(0)).current;
  const primedRef = useRef(false);
  const listenerIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const storedPrimary = await loadThemePrimary();
      if (cancelled) return;
      setPrimaryState(storedPrimary);
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

  useEffect(() => {
    if (!hydrated) return;

    const target = buildColors(colorScheme, primary);

    if (!primedRef.current) {
      primedRef.current = true;
      setColors(target);
      return;
    }

    const from = colorsRef.current;
    if (
      from.mainWhite === target.mainWhite &&
      from.primary === target.primary &&
      from.primarySoft === target.primarySoft &&
      from.surface === target.surface &&
      from.black === target.black
    ) {
      setColors(target);
      return;
    }

    if (listenerIdRef.current != null) {
      progress.removeListener(listenerIdRef.current);
      listenerIdRef.current = null;
    }
    progress.stopAnimation();
    progress.setValue(0);

    listenerIdRef.current = progress.addListener(({ value }) => {
      setColors(mixThemeColors(from, target, value));
    });

    Animated.timing(progress, {
      toValue: 1,
      duration: durations.themeShift,
      easing: THEME_EASE,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (listenerIdRef.current != null) {
        progress.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
      if (finished) setColors(target);
    });

    return () => {
      if (listenerIdRef.current != null) {
        progress.removeListener(listenerIdRef.current);
        listenerIdRef.current = null;
      }
      progress.stopAnimation();
    };
  }, [colorScheme, hydrated, primary, progress]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      primary,
      setPrimary,
      colorScheme,
      hydrated,
    }),
    [colors, colorScheme, hydrated, primary, setPrimary],
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
