import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

export type DataMode = 'real' | 'dummy';

export const DATA_MODES: DataMode[] = ['real', 'dummy'];

export const DATA_MODE_LABEL: Record<DataMode, string> = {
  real: '실제',
  dummy: '더미',
};

/** Default for real use. */
export const DEFAULT_DATA_MODE: DataMode = 'real';

export async function loadDataMode(): Promise<DataMode> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.dataMode);
  if (raw === 'real' || raw === 'dummy') return raw;
  return DEFAULT_DATA_MODE;
}

export async function saveDataMode(mode: DataMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.dataMode, mode);
}
