import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';

import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { TIMELINE_MAX_STUDIES_PER_DAY } from '@/constants/study-timeline';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import { ArrowRightIcon } from '@/components/icons/HomeIcons';

const LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeIn.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);

type StudyDaySummaryProps = {
  studies: HomeStudyRow[];
  isToday: boolean;
  colorByName?: Record<string, string>;
  onOpenTimeline: () => void;
};

/**
 * Home compact study strip — opens the day timeline depth.
 */
export function StudyDaySummary({
  studies,
  isToday,
  colorByName,
  onOpenTimeline,
}: StudyDaySummaryProps) {
  const colors = useThemeColors();
  const preview = studies.slice(0, 2);
  const extra = Math.max(0, studies.length - preview.length);
  const title = isToday ? '오늘 한 공부' : '이 날 한 공부';

  return (
    <View style={styles.root}>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          {title}
        </Text>
      </View>

      <Animated.View layout={LAYOUT} style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, 타임라인 열기`}
          accessibilityHint="하루 공부 타임라인을 열어요"
          onPress={onOpenTimeline}
          style={[styles.press, { backgroundColor: colors.surface }]}>
          {studies.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              기록이 없어요 · 타임라인에서 추가
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

          <View style={styles.ctaRow}>
            <Text style={[styles.cta, { color: colors.primary }]}>
              타임라인
              {studies.length > 0
                ? ` · ${studies.length}/${TIMELINE_MAX_STUDIES_PER_DAY}`
                : ''}
            </Text>
            <ArrowRightIcon color={colors.primary} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 8,
  },
  labelWrap: {
    padding: 8,
    alignSelf: 'flex-start',
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
    gap: 12,
  },
  empty: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
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
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  cta: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
});
