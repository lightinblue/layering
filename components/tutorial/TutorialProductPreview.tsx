import { StyleSheet, Text, View } from 'react-native';

import { CheckIcon } from '@/components/icons/HomeIcons';
import { tutorialVisualSize } from '@/components/tutorial/ForgettingCurveGraph';
import { fonts } from '@/constants/fonts';
import { intervalLabel } from '@/constants/home-mock';
import {
  colors,
  radii,
  sizes,
  spacing,
  subjectColor,
} from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

const SAMPLE_STUDY = {
  subject: '전공',
  content: '기출 10문항',
} as const;

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

/** Home review card minHeight (詳しく/자세히 row omitted). */
const REVIEW_CARD_H = 120;
const STACK_GAP = spacing.studyRowGap + 3;
const NATURAL_STACK_H = sizes.studyBodyHeight + STACK_GAP + REVIEW_CARD_H;
const FRAME_PAD_X = 14;
const FRAME_PAD_Y = 10;

type TutorialProductPreviewProps = {
  /** Base width from page-0 graph; frame grows with padding around content. */
  width: number;
};

/**
 * Page-1 product snapshot: one study row + two home-chrome review cards
 * (checkbox + chips, no 「자세히」). Soft gray frame padding around the stack.
 */
export function TutorialProductPreview({ width }: TutorialProductPreviewProps) {
  const theme = useThemeColors();
  const { width: graphW } = tutorialVisualSize(width);
  const contentW = graphW;
  const cardW = (contentW - spacing.reviewGap) / 2;
  const frameW = contentW + FRAME_PAD_X * 2;
  const frameH = NATURAL_STACK_H + FRAME_PAD_Y * 2;

  return (
    <View
      accessibilityLabel="공부 기록과 복습 카드 미리보기"
      style={[
        styles.frame,
        {
          width: frameW,
          height: frameH,
          paddingHorizontal: FRAME_PAD_X,
          paddingVertical: FRAME_PAD_Y,
          backgroundColor: theme.surface,
        },
      ]}>
      <View style={[styles.stack, { width: contentW }]}>
        <View style={styles.studyRow}>
          <View
            style={[
              styles.studyChip,
              { backgroundColor: subjectColor(SAMPLE_STUDY.subject) },
            ]}>
            <Text style={styles.studyChipText} numberOfLines={1}>
              {SAMPLE_STUDY.subject}
            </Text>
          </View>
          <View style={styles.studyBody}>
            <Text style={styles.studyBodyText} numberOfLines={1}>
              {SAMPLE_STUDY.content}
            </Text>
          </View>
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
                    : colors.surface,
                  borderColor: card.completed ? theme.primary : 'transparent',
                },
              ]}>
              <View style={styles.reviewCardInner}>
                <View style={styles.reviewTopBlock}>
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
                      {card.completed ? <CheckIcon /> : null}
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
                        <Text style={styles.reviewChipText}>
                          {name.charAt(0)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'center',
    borderRadius: radii.reviewCard,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: STACK_GAP,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  studyChip: {
    width: sizes.studyChip.width,
    height: sizes.studyChip.height,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingHorizontal: 4,
  },
  studyChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: colors.white,
    textAlign: 'center',
  },
  studyBody: {
    flex: 1,
    minWidth: 0,
    height: sizes.studyBodyHeight,
    backgroundColor: colors.white,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 14,
  },
  studyBodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.body,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: spacing.reviewGap,
    width: '100%',
  },
  /** Match HomeScreen reviewCard chrome (minus 자세히 row). */
  reviewCard: {
    borderRadius: radii.reviewCard,
    paddingTop: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 2,
    minHeight: REVIEW_CARD_H,
  },
  reviewCardInner: {
    flex: 1,
    gap: 12,
    justifyContent: 'flex-start',
    minHeight: REVIEW_CARD_H - 23,
  },
  reviewTopBlock: {
    gap: 9,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  checkbox: {
    width: sizes.reviewCheckbox,
    height: sizes.reviewCheckbox,
    borderRadius: radii.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 11,
    color: colors.accentText,
    letterSpacing: -0.44,
    flexShrink: 1,
  },
  reviewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  reviewChip: {
    width: sizes.reviewChip.width,
    height: sizes.reviewChip.height,
    borderRadius: radii.reviewChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 16,
  },
});
