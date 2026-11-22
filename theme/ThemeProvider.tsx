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
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useColorScheme as useSystemColorScheme,
} from 'react-native';

import {
  type ColorSchemeName,
  paletteFor,
  type ChromePalette,
} from '@/constants/palette';
import { durations } from '@/constants/motion';
import {
  DEFAULT_PRIMARY,
  softFromPrimary,
  isPrimaryOption,
  type PrimaryOption,
} from '@/constants/tokens';
import {
  DEFAULT_THEME_ID,
  MULTICOLOR_CHIPS,
  getTheme,
  themeIdForPrimary,
  type ThemeId,
} from '@/constants/themes';
import {
  pushSyncedPrefsToICloud,
  subscribeSyncedPrefs,
} from '@/storage/icloud-sync';
import {
  loadThemeId,
  loadThemePrimary,
  saveThemeSelection,
} from '@/storage/theme';

export type ThemeColors = ChromePalette;

type ThemeContextValue = {
  colors: ThemeColors;
  primary: PrimaryOption;
  /** Named theme (primary + subject chip palette). */
  themeId: ThemeId;
  /** Subject chip swatches for the active theme. */
  chipPalette: readonly string[];
  /** Apply a named theme (primary + palette); syncs prefs. */
  setTheme: (themeId: ThemeId) => void;
  /**
   * @deprecated Prefer `setTheme`. Maps primary → theme via `themeIdForPrimary`
   * is not used; callers should pick themes. Kept for tests / legacy.
   */
  setPrimary: (primary: PrimaryOption) => void;
  /** Resolved scheme (updates after canvas veil settles). */
  colorScheme: ColorSchemeName;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Soft ease-out — readable canvas 샤락, not a blink. */
const THEME_EASE = Easing.out(Easing.cubic);

function primaryFromTheme(themeId: ThemeId): PrimaryOption {
  const hex = getTheme(themeId).primary;
  return isPrimaryOption(hex) ? hex : DEFAULT_PRIMARY;
}

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

type CanvasVeil = {
  key: number;
  color: string;
};

/**
 * System appearance → themed chrome.
 * On light↔dark: snap palette underneath, fade a full-screen canvas veil
 * with native-driver opacity so the root 샤락s (~560ms) instead of snapping.
 * `colorScheme` (StatusBar / nav) flips when the veil finishes so icons
 * stay readable against the fading previous canvas.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme();
  const systemResolved = resolveSystemScheme(systemScheme);
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [primary, setPrimaryState] = useState<PrimaryOption>(DEFAULT_PRIMARY);
  const [hydrated, setHydrated] = useState(false);
  const [colorScheme, setColorScheme] =
    useState<ColorSchemeName>(systemResolved);
  const [colors, setColors] = useState<ThemeColors>(() =>
    buildColors(systemResolved, DEFAULT_PRIMARY),
  );
  const [veil, setVeil] = useState<CanvasVeil | null>(null);

  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const veilOpacity = useRef(new Animated.Value(1)).current;
  const primedRef = useRef(false);
  const veilKeyRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedId, storedPrimary] = await Promise.all([
        loadThemeId(),
        loadThemePrimary(),
      ]);
      if (cancelled) return;
      setThemeIdState(storedId);
      // Prefer primary implied by themeId so sky vs multicolor stay distinct.
      setPrimaryState(primaryFromTheme(storedId) || storedPrimary);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeSyncedPrefs((next) => {
      setThemeIdState(next.themeId);
      setPrimaryState(next.themePrimary);
    });
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    const nextPrimary = primaryFromTheme(next);
    setThemeIdState(next);
    setPrimaryState(nextPrimary);
    void saveThemeSelection(next);
    void pushSyncedPrefsToICloud({ themeId: next, themePrimary: nextPrimary });
  }, []);

  const setPrimary = useCallback(
    (next: PrimaryOption) => {
      // Legacy: matching primary → theme; `#1991ff` → 알록달록.
      setTheme(themeIdForPrimary(next));
    },
    [setTheme],
  );

  useEffect(() => {
    if (!hydrated) return;

    const target = buildColors(systemResolved, primary);

    if (!primedRef.current) {
      primedRef.current = true;
      setColors(target);
      setColorScheme(systemResolved);
      return;
    }

    const from = colorsRef.current;
    const canvasChanged = from.mainWhite !== target.mainWhite;

    if (!canvasChanged) {
      setColors(target);
      setColorScheme(systemResolved);
      return;
    }

    veilOpacity.stopAnimation();
    veilOpacity.setValue(1);
    veilKeyRef.current += 1;
    const key = veilKeyRef.current;
    // Previous canvas on top; new tokens underneath. Scheme (StatusBar) waits.
    setVeil({ key, color: from.mainWhite });
    setColors(target);

    let cancelled = false;
    Animated.timing(veilOpacity, {
      toValue: 0,
      duration: durations.themeShift,
      easing: THEME_EASE,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (cancelled || !finished) return;
      setColorScheme(systemResolved);
      setVeil((current) => (current?.key === key ? null : current));
    });

    return () => {
      cancelled = true;
    };
  }, [systemResolved, hydrated, primary, veilOpacity]);

  const chipPalette = useMemo(
    () => getTheme(themeId).chips,
    [themeId],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      primary,
      themeId,
      chipPalette,
      setTheme,
      setPrimary,
      colorScheme,
      hydrated,
    }),
    [
      colors,
      colorScheme,
      hydrated,
      primary,
      themeId,
      chipPalette,
      setTheme,
      setPrimary,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.shell, { backgroundColor: colors.mainWhite }]}>
        {children}
        {veil ? (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.veil,
              {
                backgroundColor: veil.color,
                opacity: veilOpacity,
              },
            ]}
          />
        ) : null}
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  veil: {
    ...StyleSheet.absoluteFill,
    zIndex: 10000,
  },
});

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

/** Active theme chip swatches; multicolor fallback outside the provider. */
export function useChipPalette(): readonly string[] {
  const ctx = useContext(ThemeContext);
  if (!ctx) return MULTICOLOR_CHIPS;
  return ctx.chipPalette;
}

export function useColorScheme(): ColorSchemeName {
  const ctx = useContext(ThemeContext);
  if (!ctx) return 'light';
  return ctx.colorScheme;
}
