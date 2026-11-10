import { StyleSheet, Text, View } from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

export type ReviewDetailContentProps = {
  intervalLabel: string;
  studies: HomeReviewStudy[];
  /** Optional chip fills from current subject list. */
  colorByName?: Record<string, string>;
};

/** 「복습 내용」 sheet — that day’s study content for the selected reviews. */
export function ReviewDetailContent({
  intervalLabel,
  studies,
  colorByName,
}: ReviewDetailContentProps) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>복습 내용</Text>
      <Text style={styles.meta}>{intervalLabel}</Text>

      {studies.length > 0 ? (
        <View style={styles.chipRow}>
          {[...new Set(studies.map((s) => s.subjectName))].map((name) => (
            <View
              key={name}
              style={[
                styles.subjectChip,
                { backgroundColor: subjectColor(name, colorByName) },
              ]}>
              <Text style={styles.subjectChipText}>{name}</Text>
            </View>
          ))}
        </View>
      ) : null}

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
              {study.studiedOn ? (
                <Text style={styles.studiedOn}>학습일 {study.studiedOn}</Text>
              ) : null}
              <Text style={styles.bodyText}>{study.content}</Text>
              {memo ? <Text style={styles.memo}>{memo}</Text> : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 14,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
    color: colors.black,
  },
  meta: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
    color: colors.accentText,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Width follows label; padding tuned for a 3-char Hangul baseline.
  subjectChip: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
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
