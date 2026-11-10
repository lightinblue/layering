import { useLocalSearchParams } from 'expo-router';

import HomeScreen from '@/components/home/HomeScreen';
import {
  HOME_DEMO_STATES,
  type HomeDemoState,
} from '@/constants/home-mock';

function parseDemo(value: string | string[] | undefined): HomeDemoState {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (HOME_DEMO_STATES as string[]).includes(raw)) {
    return raw as HomeDemoState;
  }
  return 'full';
}

/** FR-B — 오늘 홈 (공부 · 복습). Figma: 홈 full / few / empty. */
export default function TodayScreen() {
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const demoState = parseDemo(demo);
  return <HomeScreen key={demoState} initialDemoState={demoState} />;
}
