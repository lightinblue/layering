import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DUMMY_SUBJECTS } from '@/constants/home-mock';
import { fonts } from '@/constants/fonts';
import {
  colors,
  radii,
  subjectBorderColor,
  subjectColor,
} from '@/constants/tokens';

export type AddStudyPayload = {
  subject: string;
  title: string;
  memo: string;
};

type AddStudyFormProps = {
  onSave: (payload: AddStudyPayload) => void;
  /** Subject chip names (defaults to demo list). */
  subjects?: string[];
};

/**
 * 「공부 기록 추가」 form body (subject · title · optional memo).
 * Mounted inside BottomSheetModal so Expo Go always lays out content.
 */
export function AddStudyForm({
  onSave,
  subjects = [...DUMMY_SUBJECTS],
}: AddStudyFormProps) {
  const [subject, setSubject] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');

  const canSave = useMemo(
    () => subject != null && title.trim().length > 0,
    [subject, title],
  );

  const handleSave = useCallback(() => {
    if (!canSave || subject == null) return;
    onSave({
      subject,
      title: title.trim(),
      memo: memo.trim(),
    });
  }, [canSave, subject, title, memo, onSave]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>공부 기록 추가</Text>

      <View style={styles.field}>
        <Text style={styles.label}>과목</Text>
        <View style={styles.chipRow}>
          {subjects.map((name) => {
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
                  {
                    backgroundColor: subjectColor(name),
                    borderColor: subjectBorderColor(name),
                  },
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
          placeholder="1-3단원 / p. 22-36"
          placeholderTextColor={colors.mutedLight}
          style={styles.input}
          returnKeyType="next"
          accessibilityLabel="학습 내용"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="추가로 기록하고 싶은 내용"
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
        onPress={handleSave}
        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}>
        <Text style={styles.saveBtnText}>저장</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  content: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingBottom: 8,
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
  },
  subjectChipIdle: {
    opacity: 0.45,
  },
  subjectChipSelected: {
    opacity: 1,
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
