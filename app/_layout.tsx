import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { LaunchScreen } from '@/components/launch-screen';
import { TutorialScreen } from '@/components/tutorial/TutorialScreen';
import { useColorScheme } from '@/components/useColorScheme';
import { fonts } from '@/constants/fonts';
import {
  startICloudSync,
  subscribeICloudMerged,
} from '@/storage/icloud-sync';
import {
  loadTutorialSeen,
  runTutorialRetestClearIfNeeded,
  saveTutorialSeen,
} from '@/storage/tutorial';
import { syncTodayReviewWidgetSnapshot } from '@/storage/today-review-widget';
import { CalendarPrefsProvider } from '@/theme/CalendarPrefsProvider';
import {
  ThemeProvider,
  useThemeColors,
} from '@/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: 'index',
};

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden or unavailable — avoid an unhandled rejection on launch.
});
// Soft handoff when native (Expo Go = app icon) and JS overlay sizes differ slightly.
// Web has no native splash module options — ignore failures there.
try {
  SplashScreen.setOptions({ duration: 200, fade: true });
} catch {
  // expo-splash-screen web stub
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fonts.gothamBlack]: require('../assets/fonts/GothamXNarrow-Black.ttf'),
    [fonts.gothamBold]: require('../assets/fonts/GothamXNarrow-Bold.ttf'),
    [fonts.gothamMedium]: require('../assets/fonts/GothamXNarrow-Medium.ttf'),
    [fonts.gothamBook]: require('../assets/fonts/GothamXNarrow-Book.ttf'),
    [fonts.gothamLight]: require('../assets/fonts/GothamXNarrow-Light.ttf'),
    [fonts.nexonRegular]: require('../assets/fonts/NEXONLv2Gothic-Regular.otf'),
    [fonts.nexonMedium]: require('../assets/fonts/NEXONLv2Gothic-Medium.otf'),
    [fonts.nexonLight]: require('../assets/fonts/NEXONLv2Gothic-Light.otf'),
    [fonts.nexonBold]: require('../assets/fonts/NEXONLv2Gothic-Bold.otf'),
  });
  const [tutorialSeen, setTutorialSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await runTutorialRetestClearIfNeeded();
      const seen = await loadTutorialSeen();
      if (!cancelled) setTutorialSeen(seen);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Login-less iCloud KVS: silent local-only when unavailable. No sync UI.
  useEffect(() => {
    return startICloudSync();
  }, []);

  // Widget refresh when a remote merge lands before Home is mounted.
  useEffect(() => {
    return subscribeICloudMerged((merged) => {
      void syncTodayReviewWidgetSnapshot(merged);
    });
  }, []);

  const finishTutorial = useCallback(() => {
    setTutorialSeen(true);
    void saveTutorialSeen();
  }, []);

  if (!loaded || tutorialSeen === null) {
    return null;
  }

  return (
    <ThemeProvider>
      <CalendarPrefsProvider>
        <RootChrome tutorialSeen={tutorialSeen} onTutorialFinished={finishTutorial} />
      </CalendarPrefsProvider>
    </ThemeProvider>
  );
}

function RootChrome({
  tutorialSeen,
  onTutorialFinished,
}: {
  tutorialSeen: boolean;
  onTutorialFinished: () => void;
}) {
  const colors = useThemeColors();
  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.mainWhite }]}>
      {tutorialSeen ? (
        <RootLayoutNav />
      ) : (
        <TutorialScreen onFinished={onTutorialFinished} />
      )}
      <LaunchScreen />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const colors = useThemeColors();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.mainWhite },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.mainWhite },
          headerTitleStyle: { fontFamily: fonts.nexonMedium },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="day"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add"
          options={{
            // SheetPanel chrome (not formSheet — blank body on Expo Go).
            presentation: 'transparentModal',
            animation: 'none',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="review-detail"
          options={{
            // SheetPanel chrome (not formSheet — blank body on Expo Go).
            presentation: 'transparentModal',
            animation: 'none',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="calendar"
          options={{
            // SheetPanel chrome (not formSheet — blank body on Expo Go).
            presentation: 'transparentModal',
            animation: 'none',
            headerShown: false,
            title: '',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </NavThemeProvider>
  );
}
