import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts } from '@/constants/fonts';
import { colors, radii, subjectColor } from '@/constants/tokens';

/** Demo subjects until user-managed chips exist. */
const DEMO_SUBJECTS = ['분류', '교육학', '정검'] as const;

/**
 * Bottom sheet for 「공부 기록 추가」.
 * Subject required; title + optional memo; save stubs dismiss + toast.
 */
export default function AddRecordSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');

  const canSave = useMemo(
    () => subject != null && title.trim().length > 0,
    [subject, title],
  );

  const onSave = useCallback(() => {
    if (!canSave || subject == null) return;
    const payload = {
      subject,
      title: title.trim(),
      memo: memo.trim(),
    };
    console.log('[bokbok] save study (stub)', payload);
    if (router.canGoBack()) router.back();
    // Lightweight toast stand-in until a toast lib exists.
    setTimeout(() => {
      Alert.alert('저장됨', `${payload.subject} · ${payload.title}`);
    }, 250);
  }, [canSave, subject, title, memo, router]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        bounces={false}
        style={styles.scroll}
        contentContainerStyle={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}>
        <Text style={styles.title}>공부 기록 추가</Text>

        <View style={styles.field}>
          <Text style={styles.label}>과목</Text>
          <View style={styles.chipRow}>
            {DEMO_SUBJECTS.map((name) => {
              const selected = subject === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`과목 ${name}`}
                  onPress={() => setSubject(name)}
                  style={[
                    styles.subjectChip,
                    { backgroundColor: subjectColor(name) },
                    selected && styles.subjectChipSelected,
                    !selected && styles.subjectChipIdle,
                  ]}>
                  <Text style={styles.subjectChipText}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>학습 내용</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="짧게 적어 주세요"
            placeholderTextColor={colors.mutedLight}
            style={styles.input}
            returnKeyType="next"
            accessibilityLabel="학습 내용"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>메모 · 선택</Text>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="자세한 메모 (비워도 됩니다)"
            placeholderTextColor={colors.mutedLight}
            style={[styles.input, styles.memoInput]}
            multiline
            textAlignVertical="top"
            accessibilityLabel="메모"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={onSave}
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
          <Text style={styles.saveBtnText}>저장</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    flex: 1,
  },
  sheet: {
    flexGrow: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    // System grabber (sheetGrabberVisible) sits above content.
    paddingTop: 20,
    gap: 20,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
    color: colors.black,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: colors.sectionLabel,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    minWidth: 72,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  subjectChipIdle: {
    opacity: 0.45,
  },
  subjectChipSelected: {
    opacity: 1,
    borderColor: colors.primary,
  },
  subjectChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: colors.white,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: colors.body,
    minHeight: 49,
  },
  memoInput: {
    minHeight: 96,
    paddingTop: 14,
  },
  saveBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: radii.chip,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: colors.mutedLight,
  },
  saveBtnText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: colors.white,
  },
});
