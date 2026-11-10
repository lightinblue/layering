import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

/**
 * Stub bottom sheet for review 「자세히」.
 * Shows placeholder study content for that review card.
 */
export default function ReviewDetailSheet() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    subjects?: string;
    interval?: string;
  }>();

  const subjectNames = (params.subjects ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const intervalLabel =
    params.interval && params.interval.length > 0
      ? `${params.interval}일 전`
      : '복습';

  return (
    <View
      style={[
        styles.sheet,
        { paddingBottom: Math.max(insets.bottom, 24) },
      ]}>
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

      <View style={styles.body}>
        <Text style={styles.bodyLabel}>그날의 공부</Text>
        <Text style={styles.bodyText}>
          {subjectNames.length > 0
            ? `${subjectNames.join(' · ')} 학습 내용 (placeholder)`
            : '학습 내용 placeholder'}
        </Text>
        <Text style={styles.hint}>
          실제 기록 연동은 나중에 붙입니다.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    // System grabber (sheetGrabberVisible) sits above content.
    paddingTop: 20,
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
  body: {
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
