import { StyleSheet, Text, View } from 'react-native';

import { CheckIcon } from '@/components/icons/HomeIcons';
import {
  tutorialVisualSize,
} from '@/components/tutorial/ForgettingCurveGraph';
import { fonts } from '@/constants/fonts';
import { intervalLabel } from '@/constants/home-mock';
import {
  colors,
  radii,
  subjectColor,
} from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

const SAMPLE_STUDIES = [
  { subject: '전공', content: '기출 10문항' },
  { subject: '교육학', content: '노트 정리' },
] as const;

const SAMPLE_REVIEWS = [
  {
    days: 1 as const,
    completed: true,
    subjects: ['전공', '교육학'] as const,
  },
  {
    days: 3 as const,
    completed: false,
    subjects: ['전공'] as const,
  },
] as const;

type TutorialProductPreviewProps = {
  /** Must match the page-0 ForgettingCurveGraph width. */
  width: number;
};

/**
 * Compact static snapshot of study rows + review cards for tutorial page 1.
 * Outer box matches `tutorialVisualSize(width)` exactly (same as the graph).
 */
export function TutorialProductPreview({ width }: TutorialProductPreviewProps) {
  const theme = useThemeColors();
  const { width: layoutW, height: layoutH } = tutorialVisualSize(width);
  const cardW = (layoutW - 20 - 8) / 2;

  return (
    <View
      accessibilityLabel="공부 기록과 복습 카드 미리보기"
      style={[
        styles.wrap,
        {
          width: layoutW,
          height: layoutH,
          backgroundColor: theme.surface,
        },
      ]}>
      <View style={styles.studies}>
        {SAMPLE_STUDIES.map((row) => (
          <View key={row.subject} style={styles.studyRow}>
            <View
              style={[
                styles.studyChip,
                { backgroundColor: subjectColor(row.subject) },
              ]}>
              <Text style={styles.studyChipText} numberOfLines={1}>
                {row.subject}
              </Text>
            </View>
            <View style={styles.studyBody}>
              <Text style={styles.studyBodyText} numberOfLines={1}>
                {row.content}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.reviewRow}>
        {SAMPLE_REVIEWS.map((card) => (
          <View
            key={card.days}
            style={[
              styles.reviewCard,
              {
                width: cardW,
                backgroundColor: card.completed
                  ? theme.primarySoft
                  : colors.white,
                borderColor: card.completed ? theme.primary : '#e4eaef',
              },
            ]}>
            <View style={styles.reviewTop}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: card.completed
                      ? theme.primary
                      : colors.mutedLight,
                  },
                ]}>
                {card.completed ? <CheckIcon size={14} /> : null}
              </View>
              <Text style={styles.intervalText} numberOfLines={1}>
                {intervalLabel(card.days)}
              </Text>
            </View>
            <View style={styles.reviewChips}>
              {card.subjects.map((name) => (
                <View
                  key={name}
                  style={[
                    styles.reviewChip,
                    { backgroundColor: subjectColor(name) },
                  ]}>
                  <Text style={styles.reviewChipText}>{name.charAt(0)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignSelf: 'center',
    borderRadius: radii.reviewCard,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 8,
  },
  studies: {
    gap: 4,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  studyChip: {
    width: 56,
    height: 30,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  studyChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: colors.white,
  },
  studyBody: {
    flex: 1,
    minWidth: 0,
    height: 30,
    backgroundColor: colors.white,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  studyBodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: colors.body,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewCard: {
    borderRadius: radii.reviewCard,
    borderWidth: 1.5,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    paddingRight: 6,
    gap: 6,
    minHeight: 58,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 10,
    color: colors.accentText,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  reviewChips: {
    flexDirection: 'row',
    gap: 3,
  },
  reviewChip: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 10,
    color: colors.white,
    lineHeight: 12,
  },
});
