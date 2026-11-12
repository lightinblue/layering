import { PixelRatio, StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import {
  colors,
  radii,
  sizes,
  subjectColor,
} from '@/constants/tokens';

const SAMPLE = {
  subject: '전공',
  content: '기출 10문항',
} as const;

type TutorialProductPreviewProps = {
  /** Match page-0 graph width; height stays natural home study-row size. */
  width: number;
};

/**
 * Single static study-record row for tutorial page 1.
 * Width aligns with the forgetting-curve visual; height uses real home tokens.
 */
export function TutorialProductPreview({ width }: TutorialProductPreviewProps) {
  const layoutW = PixelRatio.roundToNearestPixel(width);

  return (
    <View
      accessibilityLabel="공부 기록 미리보기"
      style={[styles.wrap, { width: layoutW }]}>
      <View style={styles.studyRow}>
        <View
          style={[
            styles.studyChip,
            { backgroundColor: subjectColor(SAMPLE.subject) },
          ]}>
          <Text style={styles.studyChipText} numberOfLines={1}>
            {SAMPLE.subject}
          </Text>
        </View>
        <View style={styles.studyBody}>
          <Text style={styles.studyBodyText} numberOfLines={1}>
            {SAMPLE.content}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
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
});
