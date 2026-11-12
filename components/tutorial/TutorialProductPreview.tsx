import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { ArrowRightIcon, CheckIcon } from '@/components/icons/HomeIcons';
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

const SAMPLE_REVIEW = {
  days: 1 as const,
  subjects: ['전공', '교육학'] as const,
} as const;

type TutorialProductPreviewProps = {
  /** Match page-0 graph width; heights stay natural home sizes. */
  width: number;
};

/**
 * Tutorial page-1 product snapshot: one home-sized study row + one review card
 * (checkbox). Width aligns with the forgetting-curve visual; no height squash.
 */
export function TutorialProductPreview({ width }: TutorialProductPreviewProps) {
  const theme = useThemeColors();
  const layoutW = PixelRatio.roundToNearestPixel(width);

  return (
    <View
      accessibilityLabel="공부 기록과 복습 카드 미리보기"
      style={[styles.wrap, { width: layoutW }]}>
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

      <View
        style={[
          styles.reviewCard,
          {
            backgroundColor: theme.primarySoft,
            borderColor: theme.primary,
          },
        ]}>
        <View style={styles.reviewCardInner}>
          <View style={styles.reviewTopBlock}>
            <View style={styles.reviewTop}>
              <View
                style={[styles.checkbox, { backgroundColor: theme.primary }]}>
                <CheckIcon />
              </View>
              <Text style={styles.intervalText} numberOfLines={1}>
                {intervalLabel(SAMPLE_REVIEW.days)}
              </Text>
            </View>
            <View style={styles.reviewChips}>
              {SAMPLE_REVIEW.subjects.map((name) => (
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
          <View style={styles.detailRow}>
            <Text style={styles.detailText}>자세히</Text>
            <ArrowRightIcon />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    gap: spacing.studyRowGap + 6,
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
    backgroundColor: colors.surface,
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
  reviewCard: {
    width: '100%',
    borderRadius: radii.reviewCard,
    paddingTop: 12,
    paddingBottom: 11,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 2,
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
