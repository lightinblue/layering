import { useLocalSearchParams } from 'expo-router';

import HomeScreen from '@/components/home/HomeScreen';
import {
  DEFAULT_DATA_MODE,
  type DataMode,
} from '@/storage/data-mode';

function parseMode(value: string | string[] | undefined): DataMode {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'dummy' || raw === 'real' || raw === '더미' || raw === '실제') {
    if (raw === '더미' || raw === 'dummy') return 'dummy';
    return 'real';
  }
  return DEFAULT_DATA_MODE;
}

/** FR-B — 오늘 홈 (공부 · 복습). 실제 저장 / 더미 미리보기. */
export default function TodayScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const initialMode = parseMode(mode);
  return <HomeScreen key={initialMode} initialMode={initialMode} />;
}
