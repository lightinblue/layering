import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  AddStudyForm,
  type SubjectAddResult,
  type SubjectOption,
} from '@/components/home/AddStudyForm';
import { fonts } from '@/constants/fonts';
import { durations, springs } from '@/constants/motion';
import { radii } from '@/constants/tokens';
import { APP_THEMES, type ThemeId } from '@/constants/themes';
import { MAX_SUBJECTS } from '@/storage/app-data';
import { WEEKDAY_START_OPTIONS } from '@/storage/calendar-prefs';
import { useCalendarPrefs } from '@/theme/CalendarPrefsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

export type SettingsSheetProps = {
  /** Subject chips for add/delete/reorder (Settings only). */
  subjects?: SubjectOption[];
  onAddSubject?: (name: string, color: string) => SubjectAddResult | boolean;
  onRemoveSubject?: (name: string) => void;
  onReorderSubjects?: (orderedNames: string[]) => void;
  /** __DEV__ only: write rich screenshot AppData and refresh home. */
  onScreenshotSeed?: () => void | Promise<void>;
  /** __DEV__ only: restore empty `전공` seed. */
  onScreenshotReset?: () => void | Promise<void>;
};

/**
 * Settings body: subjects, calendar week start + theme.
 * Appearance always follows the device system setting (no in-app toggle).
 * Screenshot helpers render only when `__DEV__` and handlers are passed.
 */
export function SettingsSheet({
  subjects,
  onAddSubject,
  onRemoveSubject,
  onReorderSubjects,
  onScreenshotSeed,
  onScreenshotReset,
}: SettingsSheetProps) {
  const { colors, themeId, setTheme } = useTheme();
  const { weekStartsOn, setWeekStartsOn } = useCalendarPrefs();
  const [busy, setBusy] = useState<'seed' | 'reset' | null>(null);
  const showScreenshotTools =
    __DEV__ && onScreenshotSeed != null && onScreenshotReset != null;
  const showSubjects =
    subjects != null &&
    onAddSubject != null &&
    onRemoveSubject != null &&
    onReorderSubjects != null;

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

      {showSubjects ? (
        <View style={styles.subjectsBlock}>
          <AddStudyForm
            subjectsOnly
            subjects={subjects}
            onSave={() => {}}
            onAddSubject={onAddSubject}
            onRemoveSubject={onRemoveSubject}
            onReorderSubjects={onReorderSubjects}
            maxSubjects={MAX_SUBJECTS}
          />
        </View>
      ) : null}

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
          시작 요일
        </Text>
        <SegmentedPicker
          options={WEEKDAY_START_OPTIONS}
          value={weekStartsOn}
          onChange={setWeekStartsOn}
          accessibilityGroupLabel="시작 요일"
          surface={colors.surface}
          primary={colors.primary}
          ink={colors.black}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>테마</Text>
        <View style={styles.themeList}>
          {APP_THEMES.map((theme) => (
            <ThemeOptionRow
              key={theme.id}
              themeId={theme.id}
              label={theme.label}
              primary={theme.primary}
              chips={theme.chips}
              selected={theme.id === themeId}
              surface={colors.surface}
              ink={colors.black}
              muted={colors.muted}
              onPress={() => {
                if (theme.id === themeId) return;
                haptics.themePick();
                setTheme(theme.id);
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

const SEGMENT_PAD = 4;
const SEGMENT_GAP = 4;
const SEGMENT_SLIDE = {
  duration: durations.dateShift,
  easing: Easing.out(Easing.cubic),
} as const;

type SegmentOption<T extends string | number> = {
  value: T;
  label: string;
  accessibilityLabel: string;
};

function SegmentedPicker<T extends string | number>({
  options,
  value,
  onChange,
  accessibilityGroupLabel,
  surface,
  primary,
  ink,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityGroupLabel: string;
  surface: string;
  primary: string;
  ink: string;
}) {
  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const count = options.length;
  const [trackWidth, setTrackWidth] = useState(0);
  const pillWidth =
    trackWidth > 0 && count > 0
      ? (trackWidth - SEGMENT_PAD * 2 - SEGMENT_GAP * (count - 1)) / count
      : 0;
  const pillX = useSharedValue(0);
  const primed = useRef(false);
  const pillWidthRef = useRef(0);

  useEffect(() => {
    if (pillWidth <= 0 || selectedIndex < 0) return;
    const targetX = SEGMENT_PAD + selectedIndex * (pillWidth + SEGMENT_GAP);
    const widthChanged = pillWidthRef.current !== pillWidth;
    pillWidthRef.current = pillWidth;

    if (!primed.current || widthChanged) {
      cancelAnimation(pillX);
      pillX.value = targetX;
      primed.current = true;
      return;
    }

    cancelAnimation(pillX);
    pillX.value = withTiming(targetX, SEGMENT_SLIDE);
  }, [pillWidth, pillX, selectedIndex]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityGroupLabel}
      onLayout={onTrackLayout}
      style={[styles.segmentRow, { backgroundColor: surface }]}>
      {pillWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentPill,
            { backgroundColor: primary, width: pillWidth },
            pillStyle,
          ]}
        />
      ) : null}
      {options.map((option) => {
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
            style={styles.segmentBtn}>
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

function ThemeOptionRow({
  themeId,
  label,
  primary,
  chips,
  selected,
  surface,
  ink,
  muted,
  onPress,
}: {
  themeId: ThemeId;
  label: string;
  primary: string;
  chips: readonly string[];
  selected: boolean;
  surface: string;
  ink: string;
  muted: string;
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
    scale.value = withSpring(1.02, springs.snappy, (finished) => {
      if (finished) scale.value = withSpring(1, springs.soft);
    });
  }, [selected, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const previewChips = chips.slice(0, 5);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`테마 ${label}`}
      onPress={onPress}>
      <Animated.View
        style={[
          styles.themeRow,
          {
            backgroundColor: surface,
            borderColor: selected ? primary : 'transparent',
            borderWidth: 2,
          },
          animStyle,
        ]}>
        <View style={[styles.themePrimaryDot, { backgroundColor: primary }]} />
        <View style={styles.themeMeta}>
          <Text style={[styles.themeLabel, { color: ink }]}>{label}</Text>
          <View style={styles.themeChipPreview}>
            {previewChips.map((hex) => (
              <View
                key={`${themeId}-${hex}`}
                style={[styles.themeChipDot, { backgroundColor: hex }]}
              />
            ))}
          </View>
        </View>
        {selected ? (
          <Text style={[styles.themeSelectedMark, { color: muted }]}>✓</Text>
        ) : null}
      </Animated.View>
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
  subjectsBlock: {
    marginHorizontal: -24,
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
    position: 'relative',
    flexDirection: 'row',
    borderRadius: radii.chip,
    padding: SEGMENT_PAD,
    gap: SEGMENT_GAP,
  },
  segmentPill: {
    position: 'absolute',
    top: SEGMENT_PAD,
    bottom: SEGMENT_PAD,
    left: 0,
    borderRadius: radii.chip - 2,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.chip - 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
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
  themeList: {
    gap: 8,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.chip,
  },
  themePrimaryDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  themeMeta: {
    flex: 1,
    gap: 6,
  },
  themeLabel: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
  },
  themeChipPreview: {
    flexDirection: 'row',
    gap: 4,
  },
  themeChipDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  themeSelectedMark: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
  },
});
