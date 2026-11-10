import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { radii } from '@/constants/tokens';
import { TUTORIAL_PAGES } from '@/constants/tutorial';
import { useThemeColors } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

type TutorialScreenProps = {
  onFinished: () => void;
};

const SWIPE_THRESHOLD = 56;

/**
 * Minimal first-launch intro: forgetting curve → how to use.
 * Skip is always available; finish lands on home.
 * Previous page is weakly available (subtle back + swipe).
 */
export function TutorialScreen({ onFinished }: TutorialScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const page = TUTORIAL_PAGES[index];
  const isFirst = index <= 0;
  const isLast = index >= TUTORIAL_PAGES.length - 1;
  const contentWidth = Math.min(332, width - 48);

  const finish = useCallback(() => {
    haptics.save();
    onFinished();
  }, [onFinished]);

  const goNext = useCallback(() => {
    if (indexRef.current >= TUTORIAL_PAGES.length - 1) {
      finish();
      return;
    }
    haptics.select();
    setIndex((i) => {
      const next = Math.min(i + 1, TUTORIAL_PAGES.length - 1);
      indexRef.current = next;
      return next;
    });
  }, [finish]);

  const goPrev = useCallback(() => {
    if (indexRef.current <= 0) return;
    haptics.select();
    setIndex((i) => {
      const prev = Math.max(i - 1, 0);
      indexRef.current = prev;
      return prev;
    });
  }, []);

  const skip = useCallback(() => {
    haptics.sheetOpen();
    onFinished();
  }, [onFinished]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) =>
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2,
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          if (gesture.dx <= -SWIPE_THRESHOLD) {
            goNext();
            return;
          }
          if (gesture.dx >= SWIPE_THRESHOLD) {
            goPrev();
          }
        },
      }),
    [goNext, goPrev],
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.mainWhite,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 8,
        },
      ]}
      {...panResponder.panHandlers}>
      <View style={[styles.topBar, { width: contentWidth }]}>
        <View style={styles.topLeft}>
          {!isFirst ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 페이지"
              hitSlop={12}
              onPress={goPrev}>
              <Text style={[styles.back, { color: colors.mutedLight }]}>
                이전
              </Text>
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          <View style={styles.dots}>
            {TUTORIAL_PAGES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === index ? colors.primary : colors.mutedLight,
                  },
                ]}
              />
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="튜토리얼 건너뛰기"
          hitSlop={12}
          onPress={skip}>
          <Text style={[styles.skip, { color: colors.muted }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <View style={[styles.body, { width: contentWidth }]}>
        <Animated.View
          key={index}
          entering={FadeInUp.duration(durations.fadeIn).easing(
            Easing.out(Easing.cubic),
          )}
          exiting={FadeOut.duration(durations.fadeOut)}
          style={styles.page}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {page.eyebrow}
          </Text>
          <Text style={[styles.title, { color: colors.black }]}>
            {page.title}
          </Text>
          <Text style={[styles.copy, { color: colors.body }]}>{page.body}</Text>
          {page.accent ? (
            <Animated.Text
              entering={FadeIn.delay(80).duration(durations.fadeIn)}
              style={[styles.accent, { color: colors.primary }]}>
              {page.accent}
            </Animated.Text>
          ) : null}
        </Animated.View>
      </View>

      <View style={[styles.footer, { width: contentWidth }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? '시작하기' : '다음'}
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.88 : 1,
            },
          ]}>
          <Text style={[styles.ctaLabel, { color: colors.white }]}>
            {isLast ? '시작하기' : '다음'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    zIndex: 900,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  back: {
    fontFamily: fonts.nexonRegular,
    fontSize: 13,
  },
  backPlaceholder: {
    width: 28,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  skip: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  page: {
    gap: 14,
  },
  eyebrow: {
    fontFamily: fonts.nexonBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.nexonBold,
    fontSize: 28,
    lineHeight: 38,
  },
  copy: {
    fontFamily: fonts.nexonRegular,
    fontSize: 16,
    lineHeight: 26,
  },
  accent: {
    marginTop: 6,
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  footer: {
    paddingTop: 8,
  },
  cta: {
    height: 54,
    borderRadius: radii.fab,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
  },
});
