import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
  radii,
  subjectBorderColor,
  subjectColor,
} from '@/constants/tokens';
import { MAX_SUBJECTS } from '@/storage/app-data';
import { useThemeColors } from '@/theme/ThemeProvider';

export type AddStudyPayload = {
  subject: string;
  title: string;
  memo: string;
};

export type SubjectAddFailReason = 'empty' | 'duplicate' | 'limit';

export type SubjectAddResult =
  | { ok: true }
  | { ok: false; reason: SubjectAddFailReason };

type AddStudyFormProps = {
  onSave: (payload: AddStudyPayload) => void;
  /** Subject chip names (defaults to demo list). */
  subjects?: string[];
  /** Persist a new chip; return failure reason for inline UX. */
  onAddSubject?: (name: string) => SubjectAddResult | boolean;
  /** Remove a chip only (must not delete study/review history). */
  onRemoveSubject?: (name: string) => void;
  /** Cap for chip list (default MAX_SUBJECTS). */
  maxSubjects?: number;
};

const LIMIT_HINT = '과목은 최대 10개까지예요';

function subjectAddErrorMessage(reason: SubjectAddFailReason): string {
  switch (reason) {
    case 'limit':
      return LIMIT_HINT;
    case 'duplicate':
      return '같은 이름의 과목이 있어요';
    case 'empty':
    default:
      return '과목 이름을 입력해 주세요';
  }
}

/**
 * 「공부 기록 추가」 form body (subject · title · optional memo).
 * Subject chips: tap select · long-press delete · 「+」 add (max 10).
 * Mounted inside BottomSheetModal so Expo Go always lays out content.
 */
export function AddStudyForm({
  onSave,
  subjects = [...DUMMY_SUBJECTS],
  onAddSubject,
  onRemoveSubject,
  maxSubjects = MAX_SUBJECTS,
}: AddStudyFormProps) {
  const colors = useThemeColors();
  const [subjectPick, setSubjectPick] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [chipHint, setChipHint] = useState<string | null>(null);

  const atLimit = subjects.length >= maxSubjects;
  const canManage = onAddSubject != null || onRemoveSubject != null;
  const subject =
    subjectPick != null && subjects.includes(subjectPick) ? subjectPick : null;

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

  const openAdd = useCallback(() => {
    if (!onAddSubject) return;
    if (atLimit) {
      setChipHint(LIMIT_HINT);
      return;
    }
    setChipHint(null);
    setDraftName('');
    setAdding(true);
  }, [onAddSubject, atLimit]);

  const cancelAdd = useCallback(() => {
    setAdding(false);
    setDraftName('');
  }, []);

  const confirmAdd = useCallback(() => {
    if (!onAddSubject) return;
    const result = onAddSubject(draftName);
    const normalized: SubjectAddResult =
      typeof result === 'boolean'
        ? result
          ? { ok: true }
          : { ok: false, reason: 'empty' }
        : result;
    if (!normalized.ok) {
      setChipHint(subjectAddErrorMessage(normalized.reason));
      return;
    }
    const name = draftName.trim().replace(/\s+/g, ' ');
    setSubjectPick(name);
    setAdding(false);
    setDraftName('');
    setChipHint(null);
  }, [onAddSubject, draftName]);

  const requestRemove = useCallback(
    (name: string) => {
      if (!onRemoveSubject) return;
      Alert.alert(
        '과목 삭제',
        `‘${name}’ 칩을 삭제할까요?\n이미 기록한 공부·복습은 그대로 남아요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              onRemoveSubject(name);
              setChipHint(null);
              setSubjectPick((prev) => (prev === name ? null : prev));
            },
          },
        ],
      );
    },
    [onRemoveSubject],
  );

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { backgroundColor: colors.white }]}>
      <Text style={[styles.title, { color: colors.black }]}>공부 기록 추가</Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>과목</Text>
        <View style={styles.chipRow}>
          {subjects.map((name) => {
            const selected = subject === name;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`과목 ${name}`}
                accessibilityHint={
                  onRemoveSubject ? '길게 누르면 삭제' : undefined
                }
                onPress={() => {
                  setSubjectPick(name);
                  setChipHint(null);
                }}
                onLongPress={
                  onRemoveSubject ? () => requestRemove(name) : undefined
                }
                delayLongPress={380}
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

          {onAddSubject && !adding ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                atLimit ? '과목 추가 불가, 최대 10개' : '과목 추가'
              }
              accessibilityState={{ disabled: atLimit }}
              onPress={openAdd}
              style={[
                styles.subjectChip,
                styles.addChip,
                {
                  borderColor: atLimit ? colors.mutedLight : colors.primary,
                  backgroundColor: colors.surface,
                },
                atLimit && styles.addChipDisabled,
              ]}>
              <Text
                style={[
                  styles.addChipText,
                  { color: atLimit ? colors.mutedLight : colors.primary },
                ]}>
                +
              </Text>
            </Pressable>
          ) : null}
        </View>

        {adding ? (
          <View style={styles.addRow}>
            <TextInput
              value={draftName}
              onChangeText={(text) => {
                setDraftName(text);
                if (chipHint) setChipHint(null);
              }}
              placeholder="과목 이름"
              placeholderTextColor={colors.mutedLight}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={confirmAdd}
              autoFocus
              style={[
                styles.input,
                styles.addInput,
                { backgroundColor: colors.surface, color: colors.body },
              ]}
              accessibilityLabel="새 과목 이름"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="과목 추가 확인"
              onPress={confirmAdd}
              style={[styles.addConfirm, { backgroundColor: colors.primary }]}>
              <Text style={styles.addConfirmText}>추가</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="과목 추가 취소"
              onPress={cancelAdd}
              style={[styles.addCancel, { backgroundColor: colors.surface }]}>
              <Text style={[styles.addCancelText, { color: colors.muted }]}>
                취소
              </Text>
            </Pressable>
          </View>
        ) : null}

        {chipHint ? (
          <Text style={[styles.chipHint, { color: colors.muted }]}>
            {chipHint}
          </Text>
        ) : canManage && !adding ? (
          <Text style={[styles.chipHint, { color: colors.mutedLight }]}>
            {atLimit
              ? LIMIT_HINT
              : onRemoveSubject
                ? '길게 누르면 삭제 · + 로 추가'
                : '+ 로 과목 추가'}
          </Text>
        ) : null}
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          학습 내용
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="1-3단원 / p. 22-36"
          placeholderTextColor={colors.mutedLight}
          style={[
            styles.input,
            { backgroundColor: colors.surface, color: colors.body },
          ]}
          returnKeyType="next"
          accessibilityLabel="학습 내용"
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>메모</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="추가로 기록하고 싶은 내용"
          placeholderTextColor={colors.mutedLight}
          style={[
            styles.input,
            styles.memoInput,
            { backgroundColor: colors.surface, color: colors.body },
          ]}
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
        style={[
          styles.saveBtn,
          { backgroundColor: colors.primary },
          !canSave && { backgroundColor: colors.mutedLight },
        ]}>
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
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 20,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
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
    color: '#ffffff',
  },
  addChip: {
    minWidth: 44,
    paddingHorizontal: 12,
  },
  addChipDisabled: {
    opacity: 0.55,
  },
  addChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 22,
    lineHeight: 26,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
  },
  addConfirm: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addConfirmText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    color: '#ffffff',
  },
  addCancel: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCancelText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  chipHint: {
    fontFamily: fonts.nexonRegular,
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: '#ffffff',
  },
});
