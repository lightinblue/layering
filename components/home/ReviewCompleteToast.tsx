import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { fonts } from '@/constants/fonts';
import { EASE_OUT_MS } from '@/constants/motion';
import { radii } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

/** Round-robin copies for review-card check complete. */
export const REVIEW_COMPLETE_TOASTS = [
  '복습을 완료했어요!',
  '고생했어요 :D',
  '계속 보니 더 잘 외워지죠?',
  '또 복습하다니 대단해요!',
] as const;

/** Visible lifetime including ease-out enter/exit (~2s). */
export const REVIEW_TOAST_MS = 2000;

const EASE_OUT = Easing.out(Easing.cubic);

type ReviewCompleteToastProps = {
  /** Bumps to restart the toast animation with a new message. */
  token: number;
  message: string;
  bottom: number;
  onHidden: () => void;
};

/**
 * Light floating toast above the home FABs.
 * pointerEvents none — never blocks settings/calendar taps.
 */
export function ReviewCompleteToast({
  token,
  message,
  bottom,
  onHidden,
}: ReviewCompleteToastProps) {
  const colors = useThemeColors();
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, {
      duration: EASE_OUT_MS,
      easing: EASE_OUT,
    });
    const hideAt = REVIEW_TOAST_MS - EASE_OUT_MS;
    const hideTimer = setTimeout(() => {
      opacity.value = withTiming(
        0,
        { duration: EASE_OUT_MS, easing: EASE_OUT },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }, Math.max(0, hideAt));
    return () => clearTimeout(hideTimer);
  }, [token, opacity, onHidden]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { bottom }, style]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.white,
            shadowColor: colors.fabShadowColor,
            shadowOpacity: colors.fabShadowOpacity * 0.65,
          },
        ]}>
        <Text style={[styles.text, { color: colors.body }]}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    zIndex: 30,
  },
  bubble: {
    maxWidth: 320,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radii.chip,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  text: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
