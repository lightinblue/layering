import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOut } from 'react-native-reanimated';

import brand from '@/constants/brand.json';
import { fonts } from '@/constants/fonts';
import { LAUNCH, launchHoldBeforeFadeMs } from '@/constants/launch';

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Cancel trailing letter-spacing when centering (same idea as lucia-a). */
function centeredTracking(fontSize: number, ratio = 0.04) {
  const letterSpacing = -fontSize * ratio;
  return { letterSpacing, paddingRight: -letterSpacing };
}

const textEnter = (delayMs: number) =>
  FadeInUp.delay(delayMs)
    .duration(LAUNCH.textRevealDurationMs)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] });

export function LaunchScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
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

  const titleDelay = LAUNCH.textRevealDelayMs;
  const line1Delay = titleDelay + LAUNCH.taglineStaggerMs;
  const line2Delay = line1Delay + LAUNCH.taglineStaggerMs;

  return (
    <Animated.View
      pointerEvents="none"
      exiting={FadeOut.duration(LAUNCH.fadeOutMs)}
      style={styles.root}>
      <View style={styles.logoAnchor}>
        <Image
          style={styles.mark}
          source={require('../assets/images/layering-logo.png')}
          resizeMode="contain"
        />
      </View>
      <View style={styles.textBlock}>
        <Animated.Text entering={textEnter(titleDelay)} style={styles.title}>
          {brand.SERVICE_NAME}
        </Animated.Text>
        <Animated.Text entering={textEnter(line1Delay)} style={styles.line1}>
          {brand.SPLASH_LINE_1}
        </Animated.Text>
        <Animated.Text entering={textEnter(line2Delay)} style={styles.line2}>
          {brand.SPLASH_LINE_2}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: LAUNCH.backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  logoAnchor: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    transform: [{ translateY: -LAUNCH.markSize / 2 - LAUNCH.contentLift }],
  },
  textBlock: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: LAUNCH.markSize / 2 + LAUNCH.textGap - LAUNCH.contentLift,
    alignItems: 'center',
  },
  mark: {
    width: LAUNCH.markSize,
    height: LAUNCH.markSize,
  },
  /** Slightly smaller than the previous single large splash line (22). */
  title: {
    fontFamily: fonts.nexonBold,
    fontSize: 20,
    color: '#1A1A1A',
    ...centeredTracking(20),
  },
  line1: {
    marginTop: 10,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: 'rgba(26, 26, 26, 0.55)',
    ...centeredTracking(14, 0.02),
  },
  line2: {
    marginTop: 4,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: 'rgba(26, 26, 26, 0.45)',
    ...centeredTracking(14, 0.02),
  },
});
