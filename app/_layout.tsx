import {
  NotoSansKR_500Medium,
  useFonts as useNotoSansKRFonts,
} from '@expo-google-fonts/noto-sans-kr';
import {
  Oswald_500Medium,
  Oswald_700Bold,
  useFonts as useOswaldFonts,
} from '@expo-google-fonts/oswald';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [oswaldLoaded, oswaldError] = useOswaldFonts({
    Oswald_500Medium,
    Oswald_700Bold,
  });
  const [notoLoaded, notoError] = useNotoSansKRFonts({
    NotoSansKR_500Medium,
  });

  const loaded = oswaldLoaded && notoLoaded;
  const error = oswaldError ?? notoError;

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
