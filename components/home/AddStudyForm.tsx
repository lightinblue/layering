import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  Alert,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
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
  /** Persist chip order after long-press drag. */
  onReorderSubjects?: (orderedNames: string[]) => void;
  /** Cap for chip list (default MAX_SUBJECTS). */
  maxSubjects?: number;
  /** create (default) vs edit — copy + optional delete. */
  mode?: AddStudyFormMode;
  /** Prefill subject / title / memo when editing. */
  initial?: AddStudyFormInitial;
  /** Shown in edit mode; caller confirms before calling. */
  onDelete?: () => void;
};

type ChipLayout = { x: number; y: number; width: number; height: number };

const LIMIT_HINT = '과목은 최대 10개까지예요';
const NAME_LENGTH_HINT = '과목 이름은 4자까지예요';
const CHIP_HINT =
  '길게 눌러 순서 변경 · 선택한 과목을 다시 누르면 삭제';
const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 10;

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

function moveName(names: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0) return names;
  const next = [...names];
  const [item] = next.splice(from, 1);
  if (item == null) return names;
  next.splice(to, 0, item);
  return next;
}

function namesSignature(names: readonly string[]): string {
  return names.join('\u0001');
}

/**
 * 「공부 기록 추가 / 수정」 form body (subject · title · optional memo).
 * Subject chips: tap select · re-tap for delete X · long-press drag reorder · 「+」 add.
 * Mounted inside BottomSheetModal so Expo Go always lays out content.
 */
export function AddStudyForm({
  onSave,
  subjects = DEFAULT_SUBJECT_OPTIONS,
  onAddSubject,
  onRemoveSubject,
  onReorderSubjects,
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
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [draggingName, setDraggingName] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  const propNames = useMemo(
    () => chipSubjects.map((s) => s.name),
    [chipSubjects],
  );
  const [orderedNames, setOrderedNames] = useState(propNames);
  const orderedNamesRef = useRef(orderedNames);
  const draggingRef = useRef<string | null>(null);
  const dragOriginRef = useRef<string[]>([]);
  const chipLayoutsRef = useRef<Record<string, ChipLayout>>({});
  const rowPageRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActivatedRef = useRef(false);
  const activeChipRef = useRef<string | null>(null);

  useEffect(() => {
    orderedNamesRef.current = orderedNames;
  }, [orderedNames]);

  useEffect(() => {
    if (draggingRef.current) return;
    if (namesSignature(propNames) === namesSignature(orderedNamesRef.current)) {
      return;
    }
    setOrderedNames(propNames);
  }, [propNames]);

  const colorByName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of chipSubjects) map[s.name] = s.color;
    return map;
  }, [chipSubjects]);

  const orderedChips = useMemo(() => {
    const byName = new Map(chipSubjects.map((s) => [s.name, s]));
    const list: SubjectOption[] = [];
    for (const name of orderedNames) {
      const chip = byName.get(name);
      if (chip) list.push(chip);
    }
    for (const chip of chipSubjects) {
      if (!list.some((s) => s.name === chip.name)) list.push(chip);
    }
    return list;
  }, [chipSubjects, orderedNames]);

  const atLimit = subjects.length >= maxSubjects;
  const subjectNames = useMemo(
    () => orderedChips.map((s) => s.name),
    [orderedChips],
  );
  const subject =
    subjectPick != null && subjectNames.includes(subjectPick)
      ? subjectPick
      : null;

  const canSave = useMemo(
    () => subject != null && title.trim().length > 0,
    [subject, title],
  );

  const rowRef = useRef<ComponentRef<typeof View>>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const measureRow = useCallback(() => {
    rowRef.current?.measureInWindow((x: number, y: number) => {
      rowPageRef.current = { x, y };
    });
  }, []);

  const findHoverIndex = useCallback(
    (pageX: number, pageY: number, exclude: string) => {
      const localX = pageX - rowPageRef.current.x;
      const localY = pageY - rowPageRef.current.y;
      let best = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      orderedNamesRef.current.forEach((name, index) => {
        if (name === exclude) return;
        const layout = chipLayoutsRef.current[name];
        if (!layout) return;
        const cx = layout.x + layout.width / 2;
        const cy = layout.y + layout.height / 2;
        const dist = (cx - localX) ** 2 + (cy - localY) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
        }
      });
      return best;
    },
    [],
  );

  const hoverIndexRef = useRef(-1);

  const endDrag = useCallback(() => {
    const name = draggingRef.current;
    clearLongPressTimer();
    dragActivatedRef.current = false;
    activeChipRef.current = null;
    draggingRef.current = null;
    setDraggingName(null);
    setDragOffset({ x: 0, y: 0 });
    const hover = hoverIndexRef.current;
    hoverIndexRef.current = -1;
    if (!name || !onReorderSubjects) return;
    const origin = dragOriginRef.current;
    const from = origin.indexOf(name);
    if (from < 0 || hover < 0 || hover === from) return;
    const next = moveName(origin, from, hover);
    orderedNamesRef.current = next;
    setOrderedNames(next);
    if (namesSignature(next) === namesSignature(origin)) return;
    onReorderSubjects(next);
  }, [clearLongPressTimer, onReorderSubjects]);

  const handleChipTap = useCallback(
    (name: string) => {
      setChipHint(null);
      if (subjectPick !== name) {
        setSubjectPick(name);
        setDeleteArmed(null);
        return;
      }
      if (!onRemoveSubject) return;
      setDeleteArmed((prev) => (prev === name ? null : name));
    },
    [subjectPick, onRemoveSubject],
  );

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
              setDeleteArmed(null);
              setSubjectPick((prev) => (prev === name ? null : prev));
            },
          },
        ],
      );
    },
    [onRemoveSubject],
  );

  const beginDrag = useCallback(
    (name: string) => {
      if (!onReorderSubjects) return;
      measureRow();
      dragActivatedRef.current = true;
      draggingRef.current = name;
      dragOriginRef.current = [...orderedNamesRef.current];
      setDraggingName(name);
      setDeleteArmed(null);
      setDragOffset({ x: 0, y: 0 });
    },
    [measureRow, onReorderSubjects],
  );

  const onChipLayout = useCallback((name: string, event: LayoutChangeEvent) => {
    chipLayoutsRef.current[name] = event.nativeEvent.layout;
  }, []);

  const panResponders = useMemo(() => {
    const map: Record<
      string,
      ReturnType<typeof PanResponder.create>
    > = {};
    for (const { name } of orderedChips) {
      map[name] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => dragActivatedRef.current,
        onMoveShouldSetPanResponderCapture: () => dragActivatedRef.current,
        onPanResponderTerminationRequest: () => !dragActivatedRef.current,
        onShouldBlockNativeResponder: () => dragActivatedRef.current,
        onPanResponderGrant: () => {
          activeChipRef.current = name;
          dragActivatedRef.current = false;
          clearLongPressTimer();
          if (!onReorderSubjects) return;
          longPressTimerRef.current = setTimeout(() => {
            if (activeChipRef.current !== name) return;
            beginDrag(name);
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (
          event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          if (!dragActivatedRef.current) {
            if (
              Math.abs(gesture.dx) > MOVE_CANCEL_PX ||
              Math.abs(gesture.dy) > MOVE_CANCEL_PX
            ) {
              clearLongPressTimer();
            }
            return;
          }
          setDragOffset({ x: gesture.dx, y: gesture.dy });
          hoverIndexRef.current = findHoverIndex(
            event.nativeEvent.pageX,
            event.nativeEvent.pageY,
            name,
          );
        },
        onPanResponderRelease: (
          _event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          const wasDragging = dragActivatedRef.current;
          clearLongPressTimer();
          if (wasDragging) {
            endDrag();
            return;
          }
          if (
            Math.abs(gesture.dx) <= MOVE_CANCEL_PX &&
            Math.abs(gesture.dy) <= MOVE_CANCEL_PX
          ) {
            handleChipTap(name);
          }
          activeChipRef.current = null;
        },
        onPanResponderTerminate: () => {
          const wasDragging = dragActivatedRef.current;
          clearLongPressTimer();
          if (wasDragging) {
            endDrag();
            return;
          }
          activeChipRef.current = null;
        },
      });
    }
    return map;
  }, [
    orderedChips,
    onReorderSubjects,
    clearLongPressTimer,
    beginDrag,
    findHoverIndex,
    endDrag,
    handleChipTap,
  ]);

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
    setDeleteArmed(null);
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
    setDeleteArmed(null);
    setAdding(false);
    setDraftName('');
    setChipHint(null);
  }, [onAddSubject, draftName, draftColor]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      bounces={false}
      scrollEnabled={draggingName == null}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { backgroundColor: colors.white }]}>
      <Text style={[styles.title, { color: colors.black }]}>
        {isEdit ? '공부 기록 수정' : '공부 기록 추가'}
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>과목</Text>
        <View
          ref={rowRef}
          style={styles.chipRow}
          onLayout={measureRow}
          collapsable={false}>
          {orderedChips.map(({ name, color }) => {
            const selected = subject === name;
            const fill = color || subjectColor(name, colorByName);
            const dragging = draggingName === name;
            const showDelete = deleteArmed === name && selected && !!onRemoveSubject;
            const pan = panResponders[name];
            return (
              <View
                key={name}
                onLayout={(event) => onChipLayout(name, event)}
                style={[
                  styles.chipWrap,
                  dragging && {
                    zIndex: 20,
                    transform: [
                      { translateX: dragOffset.x },
                      { translateY: dragOffset.y },
                      { scale: 1.06 },
                    ],
                  },
                ]}>
                <View
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`과목 ${name}`}
                  accessibilityHint={
                    onReorderSubjects
                      ? '길게 눌러 순서 변경. 선택한 뒤 다시 누르면 삭제 버튼이 나타나요.'
                      : onRemoveSubject
                        ? '선택한 뒤 다시 누르면 삭제 버튼이 나타나요.'
                        : undefined
                  }
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: fill,
                      borderColor: subjectBorderColor(name, fill),
                    },
                    selected && styles.subjectChipSelected,
                    !selected && styles.subjectChipIdle,
                    dragging && styles.subjectChipDragging,
                  ]}
                  {...(pan ? pan.panHandlers : {})}>
                  <Text style={styles.subjectChipText}>{name}</Text>
                </View>
                {showDelete ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${name} 과목 삭제`}
                    hitSlop={8}
                    onPress={() => requestRemove(name)}
                    style={[
                      styles.deleteBadge,
                      { backgroundColor: colors.white },
                    ]}>
                    <Text style={styles.deleteBadgeText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
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
        ) : (onRemoveSubject || onReorderSubjects) && !adding ? (
          <Text style={[styles.chipHint, { color: colors.mutedLight }]}>
            {CHIP_HINT}
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
    overflow: 'visible',
  },
  chipWrap: {
    position: 'relative',
    overflow: 'visible',
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
  subjectChipDragging: {
    opacity: 0.95,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  subjectChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    color: '#ffffff',
  },
  deleteBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e5484d',
    zIndex: 30,
  },
  deleteBadgeText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    lineHeight: 18,
    color: '#e5484d',
    marginTop: -1,
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
