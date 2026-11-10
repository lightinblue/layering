import { StyleSheet, Text, View } from 'react-native';

import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

export type ReviewDetailContentProps = {
  subjectNames: string[];
  intervalLabel: string;
};

/** Stub body for review 「자세히」 sheet. */
export function ReviewDetailContent({
  subjectNames,
  intervalLabel,
}: ReviewDetailContentProps) {
  return (
    <View style={styles.body}>
      <Text style={styles.title}>복습 자세히</Text>
      <Text style={styles.meta}>{intervalLabel}</Text>

      {subjectNames.length > 0 ? (
        <View style={styles.chipRow}>
          {subjectNames.map((name) => (
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

      <View style={styles.card}>
        <Text style={styles.bodyLabel}>그날의 공부</Text>
        <Text style={styles.bodyText}>
          {subjectNames.length > 0
            ? `${subjectNames.join(' · ')} 학습 내용 (placeholder)`
            : '학습 내용 placeholder'}
        </Text>
        <Text style={styles.hint}>실제 기록 연동은 나중에 붙입니다.</Text>
      </View>
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
