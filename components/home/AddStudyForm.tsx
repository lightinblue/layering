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
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_COLORS,
  radii,
  subjectBorderColor,
  subjectColor,
} from '@/constants/tokens';
import {
  MAX_SUBJECT_NAME_LENGTH,
  MAX_SUBJECTS,
} from '@/storage/app-data';
import { useThemeColors } from '@/theme/ThemeProvider';

export type AddStudyPayload = {
  subject: string;
  title: string;
  memo: string;
};

export type SubjectOption = {
  name: string;
  color: string;
};

export type SubjectAddFailReason =
  | 'empty'
  | 'duplicate'
  | 'limit'
  | 'tooLong';

export type SubjectAddResult =
  | { ok: true }
  | { ok: false; reason: SubjectAddFailReason };

export type AddStudyFormMode = 'create' | 'edit';

export type AddStudyFormInitial = {
  subject: string;
  title: string;
  memo?: string;
};

type AddStudyFormProps = {
  onSave: (payload: AddStudyPayload) => void;
  /** Subject chips (defaults to demo list with Figma colors). */
  subjects?: SubjectOption[];
  /** Persist a new chip with chosen color; return failure reason for inline UX. */
  onAddSubject?: (name: string, color: string) => SubjectAddResult | boolean;
  /** Remove a chip only (must not delete study/review history). */
  onRemoveSubject?: (name: string) => void;
  /** Cap for chip list (default MAX_SUBJECTS). */
  maxSubjects?: number;
  /** create (default) vs edit — copy + optional delete. */
  mode?: AddStudyFormMode;
  /** Prefill subject / title / memo when editing. */
  initial?: AddStudyFormInitial;
  /** Shown in edit mode; caller confirms before calling. */
  onDelete?: () => void;
};

const LIMIT_HINT = '과목은 최대 10개까지예요';
const NAME_LENGTH_HINT = '과목 이름은 4자까지예요';

const DEFAULT_SUBJECT_OPTIONS: SubjectOption[] = DUMMY_SUBJECTS.map((name) => ({
  name,
  color: SUBJECT_COLORS[name] ?? subjectColor(name),
}));

function subjectAddErrorMessage(reason: SubjectAddFailReason): string {
  switch (reason) {
    case 'limit':
      return LIMIT_HINT;
    case 'duplicate':
      return '같은 이름의 과목이 있어요';
    case 'tooLong':
      return NAME_LENGTH_HINT;
    case 'empty':
    default:
      return '과목 이름을 입력해 주세요';
  }
}

/**
 * 「공부 기록 추가 / 수정」 form body (subject · title · optional memo).
 * Subject chips: tap select · long-press delete · 「+」 add with color pick (max 10).
 * Mounted inside BottomSheetModal so Expo Go always lays out content.
 */
export function AddStudyForm({
  onSave,
  subjects = DEFAULT_SUBJECT_OPTIONS,
  onAddSubject,
  onRemoveSubject,
  maxSubjects = MAX_SUBJECTS,
  mode = 'create',
  initial,
  onDelete,
}: AddStudyFormProps) {
  const colors = useThemeColors();
  const isEdit = mode === 'edit';
  const [subjectPick, setSubjectPick] = useState<string | null>(
    () => initial?.subject ?? null,
  );
  const [title, setTitle] = useState(() => initial?.title ?? '');
  const [memo, setMemo] = useState(() => initial?.memo ?? '');
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<string>(SUBJECT_COLOR_OPTIONS[0]);
  const [chipHint, setChipHint] = useState<string | null>(null);

  const chipSubjects = useMemo(() => {
    if (!initial?.subject) return subjects;
    if (subjects.some((s) => s.name === initial.subject)) return subjects;
    return [
      ...subjects,
      {
        name: initial.subject,
        color: subjectColor(initial.subject),
      },
    ];
  }, [subjects, initial?.subject]);

  const atLimit = subjects.length >= maxSubjects;
  const subjectNames = useMemo(
    () => chipSubjects.map((s) => s.name),
    [chipSubjects],
  );
  const colorByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of chipSubjects) map[s.name] = s.color;
    return map;
  }, [chipSubjects]);
  const subject =
    subjectPick != null && subjectNames.includes(subjectPick)
      ? subjectPick
      : null;

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

  const requestDelete = useCallback(() => {
    if (!onDelete) return;
    Alert.alert(
      '공부 기록 삭제',
      '이 공부 기록과 연결된 복습 일정도 함께 삭제돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
    );
  }, [onDelete]);

  const openAdd = useCallback(() => {
    if (!onAddSubject) return;
    if (atLimit) {
      setChipHint(LIMIT_HINT);
      return;
    }
    setChipHint(null);
    setDraftName('');
    setDraftColor(SUBJECT_COLOR_OPTIONS[0]);
    setAdding(true);
  }, [onAddSubject, atLimit]);

  const cancelAdd = useCallback(() => {
    setAdding(false);
    setDraftName('');
  }, []);

  const confirmAdd = useCallback(() => {
    if (!onAddSubject) return;
    const result = onAddSubject(draftName, draftColor);
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
  }, [onAddSubject, draftName, draftColor]);

  const requestRemove = useCallback(
    (name: string) => {
      if (!onRemoveSubject) return;
      Alert.alert(
        '과목 삭제',
        `‘${name}’ 과목을 삭제할까요?\n이미 기록한 내용은 그대로 남아요.`,
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
      <Text style={[styles.title, { color: colors.black }]}>
        {isEdit ? '공부 기록 수정' : '공부 기록 추가'}
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>과목</Text>
        <View style={styles.chipRow}>
          {chipSubjects.map(({ name, color }) => {
            const selected = subject === name;
            const fill = color || subjectColor(name, colorByName);
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
                    backgroundColor: fill,
                    borderColor: subjectBorderColor(name, fill),
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
                  borderColor: atLimit ? colors.mutedLight : colors.muted,
                  backgroundColor: colors.surface,
                },
                atLimit && styles.addChipDisabled,
              ]}>
              <Text
                style={[
                  styles.addChipText,
                  { color: atLimit ? colors.mutedLight : colors.muted },
                ]}>
                +
              </Text>
            </Pressable>
          ) : null}
        </View>

        {adding ? (
          <View style={styles.addBlock}>
            <View style={styles.addRow}>
              <TextInput
                value={draftName}
                onChangeText={(text) => {
                  setDraftName(text.slice(0, MAX_SUBJECT_NAME_LENGTH));
                  if (chipHint) setChipHint(null);
                }}
                placeholder="과목 이름"
                placeholderTextColor={colors.mutedLight}
                maxLength={MAX_SUBJECT_NAME_LENGTH}
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

            <View style={styles.swatchRow}>
              {SUBJECT_COLOR_OPTIONS.map((hex) => {
                const selected = draftColor === hex;
                return (
                  <Pressable
                    key={hex}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`과목 색상 ${hex}`}
                    onPress={() => setDraftColor(hex)}
                    style={[
                      styles.swatch,
                      { backgroundColor: hex },
                      selected && {
                        borderColor: colors.black,
                        borderWidth: 2,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {chipHint ? (
          <Text style={[styles.chipHint, { color: colors.muted }]}>
            {chipHint}
          </Text>
        ) : atLimit ? (
          <Text style={[styles.chipHint, { color: colors.mutedLight }]}>
            {LIMIT_HINT}
          </Text>
        ) : onRemoveSubject && !adding ? (
          <Text style={[styles.chipHint, { color: colors.mutedLight }]}>
            길게 누르면 삭제
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

      {isEdit && onDelete ? (
        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="삭제"
            onPress={requestDelete}
            style={[styles.deleteBtn, styles.actionBtn]}>
            <Text style={styles.deleteBtnText}>삭제</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="수정"
            accessibilityState={{ disabled: !canSave }}
            disabled={!canSave}
            onPress={handleSave}
            style={[
              styles.saveBtn,
              styles.actionBtn,
              { backgroundColor: colors.primary },
              !canSave && { backgroundColor: colors.mutedLight },
            ]}>
            <Text style={styles.saveBtnText}>수정</Text>
          </Pressable>
        </View>
      ) : (
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
      )}
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
  // Width follows label; padding tuned so a 3-char Hangul name is the visual baseline.
  subjectChip: {
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
    width: 44,
    paddingHorizontal: 0,
  },
  addChipDisabled: {
    opacity: 0.55,
  },
  addChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 22,
    lineHeight: 26,
  },
  addBlock: {
    gap: 10,
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
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
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
  actionRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    marginTop: 0,
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
  deleteBtn: {
    marginTop: 0,
    height: 52,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5484d',
  },
  deleteBtnText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: '#ffffff',
  },
});
