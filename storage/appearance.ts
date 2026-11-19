import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

/** Device-local appearance preference (not iCloud-synced). */
export type AppearancePreference = 'system' | 'light' | 'dark';

export const DEFAULT_APPEARANCE: AppearancePreference = 'system';

export const APPEARANCE_OPTIONS: {
  value: AppearancePreference;
  label: string;
  accessibilityLabel: string;
}[] = [
  { value: 'system', label: '시스템', accessibilityLabel: '시스템 설정 따르기' },
  { value: 'light', label: '라이트', accessibilityLabel: '라이트 모드' },
  { value: 'dark', label: '다크', accessibilityLabel: '다크 모드' },
];

function isAppearance(value: unknown): value is AppearancePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appearance);
  if (raw && isAppearance(raw)) return raw;
  return DEFAULT_APPEARANCE;
}

export async function saveAppearancePreference(
  value: AppearancePreference,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.appearance, value);
}
