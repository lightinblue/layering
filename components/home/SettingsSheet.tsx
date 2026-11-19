import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { fonts } from '@/constants/fonts';
import { springs } from '@/constants/motion';
import { PRIMARY_OPTIONS, radii, type PrimaryOption } from '@/constants/tokens';
import {
  WEEKDAY_START_OPTIONS,
  type WeekdayStart,
} from '@/storage/calendar-prefs';
import { useCalendarPrefs } from '@/theme/CalendarPrefsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

export type SettingsSheetProps = {
  /** __DEV__ only: write rich screenshot AppData and refresh home. */
  onScreenshotSeed?: () => void | Promise<void>;
  /** __DEV__ only: restore empty `전공` seed. */
  onScreenshotReset?: () => void | Promise<void>;
};

/**
 * Minimal settings body: calendar start days + accent color picker.
 * Screenshot helpers render only when `__DEV__` and handlers are passed.
 */
export function SettingsSheet({
  onScreenshotSeed,
  onScreenshotReset,
}: SettingsSheetProps) {
  const { colors, primary, setPrimary } = useTheme();
  const {
    weekStartsOn,
    monthStartsOn,
    setWeekStartsOn,
    setMonthStartsOn,
  } = useCalendarPrefs();
  const [busy, setBusy] = useState<'seed' | 'reset' | null>(null);
  const showScreenshotTools =
    __DEV__ && onScreenshotSeed != null && onScreenshotReset != null;

  const run = async (kind: 'seed' | 'reset') => {
    if (busy) return;
    setBusy(kind);
    try {
      haptics.themePick();
      if (kind === 'seed') await onScreenshotSeed?.();
      else await onScreenshotReset?.();
    } finally {
      setBusy(null);
    }
  };

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
          accessibilityLabel="복습 주기 설정, 업데이트 예정이에요"
          disabled
          style={[
            styles.stubRow,
            { backgroundColor: colors.surface },
          ]}>
          <Text style={[styles.stubText, { color: colors.muted }]}>
            업데이트 예정이에요
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          주 시작
        </Text>
        <SegmentedStartPicker
          value={weekStartsOn}
          onChange={setWeekStartsOn}
          accessibilityGroupLabel="주 시작"
          surface={colors.surface}
          primary={colors.primary}
          ink={colors.black}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>
          홈 주간 스트립의 첫 열이에요.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          월 시작
        </Text>
        <SegmentedStartPicker
          value={monthStartsOn}
          onChange={setMonthStartsOn}
          accessibilityGroupLabel="월 시작"
          surface={colors.surface}
          primary={colors.primary}
          ink={colors.black}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>
          월간 캘린더 격자의 첫 열이에요.
        </Text>
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

      {showScreenshotTools ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.sectionLabel }]}>
            스크린샷 (개발 전용)
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="스크린샷 데이터 넣기"
            disabled={busy != null}
            onPress={() => void run('seed')}
            style={[
              styles.actionRow,
              { backgroundColor: colors.primarySoft },
            ]}>
            {busy === 'seed' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={[styles.actionText, { color: colors.primary }]}>
                스크린샷 데이터 넣기
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="기본으로 되돌리기"
            disabled={busy != null}
            onPress={() => void run('reset')}
            style={[
              styles.actionRow,
              { backgroundColor: colors.surface },
            ]}>
            {busy === 'reset' ? (
              <ActivityIndicator color={colors.body} />
            ) : (
              <Text style={[styles.actionText, { color: colors.body }]}>
                기본으로 되돌리기
              </Text>
            )}
          </Pressable>
          <Text style={[styles.hint, { color: colors.muted }]}>
            넣기 후 홈이 바로 갱신돼요. 캡처가 끝나면 기본으로 되돌리세요.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SegmentedStartPicker({
  value,
  onChange,
  accessibilityGroupLabel,
  surface,
  primary,
  ink,
}: {
  value: WeekdayStart;
  onChange: (next: WeekdayStart) => void;
  accessibilityGroupLabel: string;
  surface: string;
  primary: string;
  ink: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityGroupLabel}
      style={[styles.segmentRow, { backgroundColor: surface }]}>
      {WEEKDAY_START_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${accessibilityGroupLabel}, ${option.accessibilityLabel}`}
            onPress={() => {
              if (selected) return;
              haptics.themePick();
              onChange(option.value);
            }}
            style={[
              styles.segmentBtn,
              selected && { backgroundColor: primary },
            ]}>
            <Text
              style={[
                styles.segmentText,
                { color: selected ? '#FFFFFF' : ink },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
  segmentRow: {
    flexDirection: 'row',
    borderRadius: radii.chip,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.chip - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  actionRow: {
    height: 48,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  hint: {
    fontFamily: fonts.nexonRegular,
    fontSize: 12,
    lineHeight: 18,
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
