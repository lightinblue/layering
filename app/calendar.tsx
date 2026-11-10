import { StyleSheet } from 'react-native';

import { View } from '@/components/Themed';
import { colors } from '@/constants/tokens';

/** Blank 전체보기 stub — calendar body lands later. */
export default function CalendarScreen() {
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mainWhite,
  },
});
