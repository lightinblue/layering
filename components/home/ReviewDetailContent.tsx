import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

export type ReviewDetailContentProps = {
  studies: HomeReviewStudy[];
  /** Optional chip fills from current subject list. */
  colorByName?: Record<string, string>;
};

/** 「복습 내용」 sheet — that day’s study content for the selected reviews. */
export function ReviewDetailContent({
  studies,
  colorByName,
}: ReviewDetailContentProps) {
  return (
    <ScrollView
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled">
      {studies.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>연결된 공부 기록이 없어요</Text>
        </View>
      ) : (
        studies.map((study, index) => {
          const memo = study.memo?.trim();
          return (
            <View
              key={`${study.subjectName}-${study.studiedOn}-${index}`}
              style={styles.card}>
              <View
                style={[
                  styles.subjectChip,
                  {
                    backgroundColor: subjectColor(
                      study.subjectName,
                      colorByName,
                    ),
                  },
                ]}>
                <Text style={styles.subjectChipText} numberOfLines={1}>
                  {study.subjectName}
                </Text>
              </View>
              {study.studiedOn ? (
                <Text style={styles.studiedOn} numberOfLines={1}>
                  학습일 {study.studiedOn}
                </Text>
              ) : null}
              <Text style={styles.bodyText}>{study.content}</Text>
              {memo ? <Text style={styles.memo}>{memo}</Text> : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: '100%',
  },
  body: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 14,
  },
  // Width follows label; padding tuned for a 3-char Hangul baseline.
  // Sheet-local radius (not radii.chip) so home study chips stay at 12.
  subjectChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
    color: colors.white,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    padding: 16,
    gap: 8,
  },
  studiedOn: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.accentText,
  },
  bodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: colors.body,
    lineHeight: 22,
  },
  memo: {
    fontFamily: fonts.nexonRegular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
});
