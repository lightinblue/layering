import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData } from '@/types/domain';
import { STORAGE_KEYS } from '@/storage/keys';

export const EMPTY_APP_DATA: AppData = {
  subjects: [],
  records: [],
  schedules: [],
};

/** 로컬 저장 로드. 아직 화면에서 호출하지 않음 — 구조만 준비. */
export async function loadAppData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.appData);
  if (!raw) return { ...EMPTY_APP_DATA };
  try {
    const parsed = JSON.parse(raw) as AppData;
    return {
      subjects: parsed.subjects ?? [],
      records: parsed.records ?? [],
      schedules: parsed.schedules ?? [],
    };
  } catch {
    return { ...EMPTY_APP_DATA };
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.appData, JSON.stringify(data));
}
