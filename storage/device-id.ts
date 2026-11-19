import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

function createUuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  // Fallback for older JS engines.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable UUID for this install (AsyncStorage). Used as merge tie-break. */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing && existing.length > 0) return existing;
  const id = createUuid();
  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, id);
  return id;
}
