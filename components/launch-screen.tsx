import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, useColorScheme as useSystemColorScheme } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import {
  LAUNCH,
  LAUNCH_MARK_DARK,
  LAUNCH_MARK_LIGHT,
  launchHoldBeforeFadeMs,
} from '@/constants/launch';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * In-app splash: symbol only, true center — must match expo-splash-screen
 * (light/dark image + bg, imageWidth ≈ markSize) so hideAsync does not flash.
 * Uses system appearance directly so the mark matches native splash before
 * ThemeProvider settles.
 */
export function LaunchScreen() {
  const systemScheme = useSystemColorScheme();
  const [visible, setVisible] = useState(true);
  const isDark = systemScheme === 'dark';
  const backgroundColor = isDark
    ? LAUNCH.backgroundColorDark
    : LAUNCH.backgroundColor;
  const markSource = isDark ? LAUNCH_MARK_DARK : LAUNCH_MARK_LIGHT;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Reveal this overlay only after it mounts so native → JS stays same frame.
      await SplashScreen.hideAsync().catch(() => {});
      await sleep(launchHoldBeforeFadeMs());
      if (!cancelled) {
        setVisible(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      exiting={FadeOut.duration(LAUNCH.fadeOutMs)}
      style={[styles.root, { backgroundColor }]}>
      <Image
        accessibilityIgnoresInvertColors
        style={styles.mark}
        source={markSource}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: {
    width: LAUNCH.markSize,
    height: LAUNCH.markSize,
  },
});
