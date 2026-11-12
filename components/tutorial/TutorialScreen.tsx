import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ForgettingCurveGraph,
  tutorialVisualWidth,
} from '@/components/tutorial/ForgettingCurveGraph';
import { TutorialProductPreview } from '@/components/tutorial/TutorialProductPreview';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { radii } from '@/constants/tokens';
import {
  TUTORIAL_PAGES,
  type TutorialPage,
} from '@/constants/tutorial';
import { useThemeColors } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

type TutorialScreenProps = {
  onFinished: () => void;
};

/**
 * Minimal first-launch intro: forgetting curve → how to use.
 * Horizontal swipe pager; dots left, skip right, next/finish CTA.
 */
export function TutorialScreen({ onFinished }: TutorialScreenProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<TutorialPage>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index >= TUTORIAL_PAGES.length - 1;
  const contentWidth = Math.min(332, width - 48);
  const visualWidth = tutorialVisualWidth(contentWidth);

  const finish = useCallback(() => {
    haptics.save();
    onFinished();
  }, [onFinished]);

  const scrollTo = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(next, TUTORIAL_PAGES.length - 1));
    listRef.current?.scrollToIndex({ index: clamped, animated: true });
    setIndex(clamped);
  }, []);

  const goNext = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    haptics.select();
    scrollTo(index + 1);
  }, [finish, index, isLast, scrollTo]);

  const skip = useCallback(() => {
    haptics.sheetOpen();
    onFinished();
  }, [onFinished]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next === index) return;
      haptics.select();
      setIndex(next);
    },
    [index, width],
  );

  const renderPage = useCallback(
    ({ item, index: pageIndex }: { item: TutorialPage; index: number }) => (
      <View style={[styles.pageSlide, { width }]}>
        <View style={[styles.page, { width: contentWidth }]}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {item.eyebrow}
          </Text>
          <Text style={[styles.title, { color: colors.black }]}>
            {item.title}
          </Text>
          {pageIndex === 0 ? (
            <ForgettingCurveGraph width={visualWidth} />
          ) : null}
          {pageIndex === 1 ? (
            <TutorialProductPreview width={visualWidth} />
          ) : null}
          {/* Same token + lineHeight as page-1 body (\\n lines, no extra gap). */}
          <Text style={[styles.copy, { color: colors.body }]}>{item.body}</Text>
          {item.sub ? (
            <Text style={[styles.copy, { color: colors.body }]}>{item.sub}</Text>
          ) : null}
          {item.accent ? (
            <Animated.Text
              entering={FadeIn.delay(80).duration(durations.fadeIn).easing(
                Easing.out(Easing.cubic),
              )}
              style={[styles.accent, { color: colors.primary }]}>
              {item.accent}
            </Animated.Text>
          ) : null}
        </View>
      </View>
    ),
    [
      colors.black,
      colors.body,
      colors.primary,
      contentWidth,
      visualWidth,
      width,
    ],
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
      ]}>
      <View style={[styles.topBar, { width: contentWidth }]}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="튜토리얼 건너뛰기"
          hitSlop={12}
          onPress={skip}>
          <Text style={[styles.skip, { color: colors.muted }]}>건너뛰기</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <FlatList
          ref={listRef}
          data={TUTORIAL_PAGES as TutorialPage[]}
          keyExtractor={(_, i) => `tutorial-${i}`}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          renderItem={renderPage}
          style={styles.pager}
        />
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
    alignSelf: 'stretch',
    paddingBottom: 24,
  },
  pager: {
    flex: 1,
  },
  pageSlide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    // Extra air between title → visual → body.
    gap: 18,
  },
  eyebrow: {
    fontFamily: fonts.nexonBold,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  title: {
    fontFamily: fonts.nexonBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Secondary body — shared by page-0 and page-1 (lineHeight owns multi-line gap). */
  copy: {
    fontFamily: fonts.nexonRegular,
    fontSize: 14,
    lineHeight: 22,
  },
  accent: {
    marginTop: 0,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    lineHeight: 22,
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
