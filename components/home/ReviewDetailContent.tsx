import { StyleSheet, Text, View } from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

export type ReviewDetailContentProps = {
  intervalLabel: string;
  studies: HomeReviewStudy[];
};

/** 「자세히」 sheet — that day’s study content for the selected reviews. */
export function ReviewDetailContent({
  intervalLabel,
  studies,
}: ReviewDetailContentProps) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>복습 자세히</Text>
      <Text style={styles.meta}>{intervalLabel}</Text>

      {studies.length > 0 ? (
        <View style={styles.chipRow}>
          {[...new Set(studies.map((s) => s.subjectName))].map((name) => (
            <View
              key={name}
              style={[
                styles.subjectChip,
                { backgroundColor: subjectColor(name) },
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
        studies.map((study, index) => (
          <View
            key={`${study.subjectName}-${study.studiedOn}-${index}`}
            style={styles.card}>
            <Text style={styles.bodyLabel}>그날의 공부</Text>
            <Text style={styles.subjectLine}>{study.subjectName}</Text>
            <Text style={styles.bodyText}>{study.content}</Text>
            <Text style={styles.hint}>학습일 {study.studiedOn}</Text>
          </View>
        ))
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
  subjectChip: {
    minWidth: 64,
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
  bodyLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    color: colors.sectionLabel,
  },
  subjectLine: {
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
  hint: {
    fontFamily: fonts.nexonRegular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
});
