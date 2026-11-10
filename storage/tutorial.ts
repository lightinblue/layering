import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '@/storage/keys';

/**
 * Bump this token to force another one-shot clear of tutorial-seen in __DEV__.
 * Each token applies at most once per install (sentinel stored in AsyncStorage).
 */
const TUTORIAL_RETEST_TOKEN = 'retest-2026-11-10e';
const TUTORIAL_RETEST_SENTINEL = '@bokbok/dev/tutorial-retest-token';

/** Whether the first-launch tutorial has been completed or skipped. */
export async function loadTutorialSeen(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.tutorialSeen);
  return raw === '1';
}

export async function saveTutorialSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.tutorialSeen, '1');
}

/** Remove the tutorial-seen flag so the first-launch tutorial shows again. */
export async function clearTutorialSeen(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.tutorialSeen);
}

/**
 * __DEV__ one-shot: clear `@bokbok/tutorial-seen/v1` once per retest token
 * so the first-launch tutorial shows again after a reload.
 */
export async function runTutorialRetestClearIfNeeded(): Promise<void> {
  if (!__DEV__) return;

  const applied = await AsyncStorage.getItem(TUTORIAL_RETEST_SENTINEL);
  if (applied === TUTORIAL_RETEST_TOKEN) return;

  await clearTutorialSeen();
  await AsyncStorage.setItem(TUTORIAL_RETEST_SENTINEL, TUTORIAL_RETEST_TOKEN);
}
