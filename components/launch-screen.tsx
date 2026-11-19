import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { LAUNCH, launchHoldBeforeFadeMs } from '@/constants/launch';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * In-app splash: symbol only, true center — must match expo-splash-screen
 * (same asset, imageWidth ≈ markSize, scheme bg) so hideAsync does not flash.
 * Expo Go still paints the app icon as its native splash (SDK 52+ limit);
 * we use that same icon asset here so the handoff stays one symbol.
 */
export function LaunchScreen() {
  const colorScheme = useColorScheme();
  const [visible, setVisible] = useState(true);
  const backgroundColor =
    colorScheme === 'dark'
      ? LAUNCH.backgroundColorDark
      : LAUNCH.backgroundColor;

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
        source={require('../assets/images/icon.png')}
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
