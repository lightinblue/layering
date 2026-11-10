import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { fonts } from '@/constants/fonts';
import { colors } from '@/constants/tokens';

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

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
            presentation: 'formSheet',
            headerShown: false,
            // Fractional detents: fitToContents + ScrollView often opens as a blank sheet.
            sheetAllowedDetents: [0.58, 0.92],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            // iOS formSheet content wrapper has no intrinsic height without this.
            contentStyle: {
              height: '100%',
              backgroundColor: colors.white,
            },
          }}
        />
        <Stack.Screen
          name="review-detail"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: [0.4, 0.72],
            sheetInitialDetentIndex: 0,
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            contentStyle: {
              height: '100%',
              backgroundColor: colors.white,
            },
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
    </ThemeProvider>
  );
}
