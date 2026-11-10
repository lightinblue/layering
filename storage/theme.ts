import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PRIMARY,
  isPrimaryOption,
  type PrimaryOption,
} from '@/constants/tokens';
import { STORAGE_KEYS } from '@/storage/keys';

export async function loadThemePrimary(): Promise<PrimaryOption> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.themePrimary);
  if (raw && isPrimaryOption(raw)) return raw;
  return DEFAULT_PRIMARY;
}

export async function saveThemePrimary(primary: PrimaryOption): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.themePrimary, primary);
}
