import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { fonts } from '@/constants/fonts';
import {
  ThemeProvider,
  useThemeColors,
} from '@/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  anchor: 'index',
};

SplashScreen.preventAutoHideAsync();

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

  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}

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
            presentation: 'modal',
            title: '전체보기',
          }}
        />
      </Stack>
    </NavThemeProvider>
  );
}
