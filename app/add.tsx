import { StyleSheet } from 'react-native';

import { REVIEW_INTERVAL_DAYS, REVIEW_INTERVAL_NOTICE } from '@/constants/review';
import { Text, View } from '@/components/Themed';
import { colors } from '@/constants/tokens';

/** FR-A stub — 과목 칩·학습 내용·학습일 입력 및 복습일 자동 생성. */
export default function AddRecordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>기록 추가</Text>
      <Text style={styles.body}>과목 · 학습 내용 · 학습일을 입력하는 화면입니다.</Text>
      <Text style={styles.meta}>
        저장 시 복습일: +{REVIEW_INTERVAL_DAYS.join(' / ')}일
      </Text>
      <Text style={styles.notice}>{REVIEW_INTERVAL_NOTICE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    backgroundColor: colors.mainWhite,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    marginBottom: 12,
  },
  meta: {
    fontSize: 14,
    marginBottom: 8,
  },
  notice: {
    fontSize: 13,
    opacity: 0.55,
  },
});
