import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/tokens';
import { fonts } from '@/constants/fonts';

/**
 * Placeholder bottom sheet for 「공부 기록 추가」.
 * Real input / settings / save UI lands later — keep blank for now.
 */
export default function AddRecordSheet() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.grabber} accessibilityElementsHidden />
      <Text style={styles.title}>공부 기록 추가</Text>
      <Text style={styles.copy}>
        여기에 입력·설정·저장 UI가 들어올 예정입니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mutedLight,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
    color: colors.black,
  },
  copy: {
    fontFamily: fonts.nexonRegular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.accentText,
  },
});
