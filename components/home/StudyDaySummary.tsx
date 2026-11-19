import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

const LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeIn.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);

type StudyDaySummaryProps = {
  studies: HomeStudyRow[];
  isToday: boolean;
  colorByName?: Record<string, string>;
  onOpenDay: () => void;
};

/**
 * Home compact study strip — title + summary both open the day detail.
 */
export function StudyDaySummary({
  studies,
  isToday,
  colorByName,
  onOpenDay,
}: StudyDaySummaryProps) {
  const colors = useThemeColors();
  const preview = studies.slice(0, 2);
  const extra = Math.max(0, studies.length - preview.length);
  const title = isToday ? '오늘 한 공부' : '이 날 한 공부';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} 자세히 보기`}
      onPress={onOpenDay}
      style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          {title}
        </Text>
        <ArrowRightIcon size={12} color={colors.muted} />
      </View>

      <Animated.View layout={LAYOUT} style={styles.card}>
        <View style={[styles.press, { backgroundColor: colors.surface }]}>
          {studies.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              기록이 없어요
            </Text>
          ) : (
            <Animated.View entering={ENTER} style={styles.previewCol}>
              {preview.map((row) => (
                <View key={row.id} style={styles.previewRow}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: subjectColor(
                          row.subjectName,
                          row.subjectColor ?? colorByName,
                        ),
                      },
                    ]}
                  />
                  <Text
                    style={[styles.previewText, { color: colors.body }]}
                    numberOfLines={1}>
                    {row.subjectName} · {row.content}
                  </Text>
                </View>
              ))}
              {extra > 0 ? (
                <Text style={[styles.more, { color: colors.muted }]}>
                  +{extra}개 더
                </Text>
              ) : null}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 8,
  },
  titleRow: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
  },
  card: {
    paddingHorizontal: 8,
  },
  press: {
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
    justifyContent: 'center',
  },
  empty: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  previewCol: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  previewText: {
    flex: 1,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  more: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    paddingLeft: 16,
  },
});
