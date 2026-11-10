import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

/** FR-C stub — 날짜별 복습 확인·체크, 완료/미완료 색 구분. */
export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>캘린더</Text>
      <Text style={styles.body}>날짜를 고르면 그날의 복습 항목을 확인하고 체크할 수 있습니다.</Text>
      <Text style={styles.hint}>미완료 항목은 원래 복습일에 그대로 둡니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    opacity: 0.55,
  },
});
