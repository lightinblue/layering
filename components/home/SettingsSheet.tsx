import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { fonts } from '@/constants/fonts';
import { springs } from '@/constants/motion';
import { PRIMARY_OPTIONS, radii, type PrimaryOption } from '@/constants/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

/**
 * Minimal settings body: review-interval stub + accent color picker.
 */
export function SettingsSheet() {
  const { colors, primary, setPrimary } = useTheme();

  return (
    <View style={styles.content}>
      <Text style={[styles.title, { color: colors.black }]}>설정</Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          복습 주기 설정
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="복습 주기 설정, 업데이트 예정"
          disabled
          style={[
            styles.stubRow,
            { backgroundColor: colors.surface },
          ]}>
          <Text style={[styles.stubText, { color: colors.muted }]}>
            업데이트 예정
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>색상</Text>
        <View style={styles.swatchRow}>
          {PRIMARY_OPTIONS.map((hex) => (
            <ColorSwatch
              key={hex}
              hex={hex}
              selected={hex === primary}
              borderColor={colors.black}
              onPress={() => {
                haptics.themePick();
                setPrimary(hex as PrimaryOption);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function ColorSwatch({
  hex,
  selected,
  borderColor,
  onPress,
}: {
  hex: string;
  selected: boolean;
  borderColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const primed = useRef(false);

  useEffect(() => {
    if (!primed.current) {
      primed.current = true;
      return;
    }
    if (!selected) return;
    scale.value = withSpring(1.12, springs.snappy, (finished) => {
      if (finished) scale.value = withSpring(1, springs.soft);
    });
  }, [selected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`앱 색상 ${hex}`}
      onPress={onPress}>
      <Animated.View
        style={[
          styles.swatch,
          { backgroundColor: hex },
          selected && {
            borderColor,
            borderWidth: 2,
          },
          animStyle,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 22,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
  },
  field: {
    gap: 10,
  },
  label: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  stubRow: {
    height: 48,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  stubText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
