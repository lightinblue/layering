import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

/** FR-B stub — 오늘 복습 목록·완료 체크. */
export default function TodayScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>오늘</Text>
      <Text style={styles.body}>오늘 복습할 내용이 없어요</Text>
      <Text style={styles.hint}>학습 기록을 추가하면 오늘 복습 항목이 여기에 모입니다.</Text>
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
