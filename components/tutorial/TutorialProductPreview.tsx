import { StyleSheet, Text, View } from 'react-native';

import { ArrowRightIcon, CheckIcon } from '@/components/icons/HomeIcons';
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

/** Natural stacked height: study 44 + gap 8 + review card 120. */
const NATURAL_STACK_H =
  sizes.studyBodyHeight + spacing.studyRowGap + 8 + 120;
const FRAME_PAD = 10;

type TutorialProductPreviewProps = {
  /** Same width passed to page-0 ForgettingCurveGraph. */
  width: number;
};

/**
 * Page-1 product snapshot in the exact graph W×H frame.
 * One home-sized study row + two review check cards; uniform scale + center
 * so cards aren’t individually squashed.
 */
export function TutorialProductPreview({ width }: TutorialProductPreviewProps) {
  const theme = useThemeColors();
  const { width: layoutW, height: layoutH } = tutorialVisualSize(width);
  const innerW = layoutW - FRAME_PAD * 2;
  const innerH = layoutH - FRAME_PAD * 2;
  const cardW = (innerW - spacing.reviewGap) / 2;
  const scale = Math.min(1, innerH / NATURAL_STACK_H);
  const scaledH = NATURAL_STACK_H * scale;

  return (
    <View
      accessibilityLabel="공부 기록과 복습 카드 미리보기"
      style={[
        styles.frame,
        {
          width: layoutW,
          height: layoutH,
          backgroundColor: theme.surface,
        },
      ]}>
      {/* Layout footprint matches visual size so the group centers cleanly. */}
      <View style={{ width: innerW, height: scaledH, justifyContent: 'center' }}>
        <View
          style={[
            styles.scaled,
            {
              width: innerW,
              height: NATURAL_STACK_H,
              transform: [{ scale }],
            },
          ]}>
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
                    : colors.white,
                  borderColor: card.completed ? theme.primary : '#e4eaef',
                  borderWidth: card.completed ? 2 : 1,
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
                <View style={styles.detailRow}>
                  <Text style={styles.detailText}>자세히</Text>
                  <ArrowRightIcon />
                </View>
              </View>
            </View>
          ))}
        </View>
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
  scaled: {
    gap: spacing.studyRowGap + 3,
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
  reviewCard: {
    borderRadius: radii.reviewCard,
    paddingTop: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 8,
    minHeight: 120,
  },
  reviewCardInner: {
    flex: 1,
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 95,
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 1,
    alignSelf: 'stretch',
  },
  detailText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: -0.4,
    textAlign: 'right',
    lineHeight: 12,
  },
});
