import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  colors as baseColors,
  DEFAULT_PRIMARY,
  softFromPrimary,
  type PrimaryOption,
} from '@/constants/tokens';
import { loadThemePrimary, saveThemePrimary } from '@/storage/theme';

export type ThemeColors = Omit<typeof baseColors, 'primary' | 'primarySoft'> & {
  primary: string;
  primarySoft: string;
};

type ThemeContextValue = {
  colors: ThemeColors;
  primary: PrimaryOption;
  setPrimary: (primary: PrimaryOption) => void;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildColors(primary: PrimaryOption): ThemeColors {
  return {
    ...baseColors,
    primary,
    primarySoft: softFromPrimary(primary),
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [primary, setPrimaryState] = useState<PrimaryOption>(DEFAULT_PRIMARY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadThemePrimary();
      if (cancelled) return;
      setPrimaryState(stored);
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

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: buildColors(primary),
      primary,
      setPrimary,
      hydrated,
    }),
    [primary, setPrimary, hydrated],
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
  if (!ctx) return buildColors(DEFAULT_PRIMARY);
  return ctx.colors;
}
