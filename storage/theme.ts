import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PRIMARY,
  isPrimaryOption,
  type PrimaryOption,
} from '@/constants/tokens';
import {
  coerceThemeId,
  getTheme,
  themeIdForPrimary,
  type ThemeId,
} from '@/constants/themes';
import { STORAGE_KEYS } from '@/storage/keys';

export async function loadThemePrimary(): Promise<PrimaryOption> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.themePrimary);
  if (raw && isPrimaryOption(raw)) return raw;
  return DEFAULT_PRIMARY;
}

export async function saveThemePrimary(primary: PrimaryOption): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.themePrimary, primary);
}

export async function loadThemeId(): Promise<ThemeId> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.themeId);
  const coerced = coerceThemeId(raw);
  if (coerced) return coerced;
  const primary = await loadThemePrimary();
  return themeIdForPrimary(primary);
}

export async function saveThemeId(themeId: ThemeId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.themeId, themeId);
}

/** Persist theme id + matching primary together. */
export async function saveThemeSelection(themeId: ThemeId): Promise<void> {
  const theme = getTheme(themeId);
  const primary = isPrimaryOption(theme.primary)
    ? theme.primary
    : DEFAULT_PRIMARY;
  await Promise.all([saveThemeId(themeId), saveThemePrimary(primary)]);
}
