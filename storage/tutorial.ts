import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

/** Whether the first-launch tutorial has been completed or skipped. */
export async function loadTutorialSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.tutorialSeen);
  return raw === '1';
}

export async function saveTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.tutorialSeen, '1');
}
