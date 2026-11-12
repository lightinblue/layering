import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  Alert,
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DUMMY_SUBJECTS } from '@/constants/home-mock';
import { fonts } from '@/constants/fonts';
import { EASE_OUT_MS, durations } from '@/constants/motion';
import {
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_COLORS,
  colors as tokenColors,
  radii,
  subjectBorderColor,
  subjectColor,
} from '@/constants/tokens';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import {
  MAX_STUDY_MEMO_LENGTH,
  MAX_STUDY_TITLE_LENGTH,
  MAX_SUBJECT_NAME_LENGTH,
  MAX_SUBJECTS,
} from '@/storage/app-data';
import { SoftPlusIcon } from '@/components/icons/HomeIcons';
import { useThemeColors } from '@/theme/ThemeProvider';
import { haptics } from '@/utils/haptics';

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
const LONG_PRESS_MS = 380;
const MOVE_CANCEL_PX = 10;
const CHIP_SHIFT_ANIM = {
  duration: durations.chipShift,
  update: {
    type: LayoutAnimation.Types.easeOut,
  },
};

const CHIP_EASE = {
  duration: durations.chipShift,
  easing: Easing.out(Easing.cubic),
} as const;

const ADD_REVEAL = {
  duration: EASE_OUT_MS,
  easing: Easing.out(Easing.cubic),
} as const;

/** Inner rise distance while the block height expands (one shared progress). */
const ADD_RISE_PX = 14;
const CHIP_IDLE_OPACITY = 0.45;
const CHIP_SELECTED_OPACITY = 1;

/**
 * One push: name row + palette + actions expand together (height clip) while
 * rising in; content below is shoved down. Same ease-out; interruptible.
 * Keyboard focus waits for `onOpenComplete` so sheet lift does not fight height.
 */
function SubjectAddReveal({
  visible,
  onOpenComplete,
  children,
}: {
  visible: boolean;
  /** Fires once when the open ease-out finishes (not on interrupt / hide). */
  onOpenComplete?: () => void;
  children: ReactNode;
}) {
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const measured = useSharedValue(0);
  const [presented, setPresented] = useState(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const onOpenCompleteRef = useRef(onOpenComplete);
  onOpenCompleteRef.current = onOpenComplete;

  const finishHide = useCallback(() => {
    if (!visibleRef.current) {
      setPresented(false);
      contentHeight.value = 0;
      measured.value = 0;
      progress.value = 0;
    }
  }, [contentHeight, measured, progress]);

  const notifyOpenComplete = useCallback(() => {
    if (visibleRef.current) onOpenCompleteRef.current?.();
  }, []);

  const startOpen = useCallback(() => {
    cancelAnimation(progress);
    progress.value = withTiming(1, ADD_REVEAL, (finished) => {
      if (finished) runOnJS(notifyOpenComplete)();
    });
  }, [notifyOpenComplete, progress]);

  useEffect(() => {
    cancelAnimation(progress);
    if (visible) {
      setPresented(true);
      progress.value = 0;
      if (measured.value === 1 && contentHeight.value > 0) {
        startOpen();
      }
      return;
    }
    if (!presented) return;
    progress.value = withTiming(0, ADD_REVEAL, (finished) => {
      if (finished) runOnJS(finishHide)();
    });
  }, [
    contentHeight,
    finishHide,
    measured,
    presented,
    progress,
    startOpen,
    visible,
  ]);

  const panelStyle = useAnimatedStyle(() => {
    // Until first measure, stay invisible + unconstrained so Yoga reports full height.
    if (measured.value === 0) {
      return { opacity: 0, overflow: 'hidden' as const };
    }
    return {
      height: contentHeight.value * progress.value,
      opacity: 1,
      overflow: 'hidden' as const,
    };
  });

  const innerStyle = useAnimatedStyle(() => ({
    // Rise from below as the clip expands — same progress as height.
    transform: [{ translateY: (1 - progress.value) * ADD_RISE_PX }],
  }));

  if (!presented) return null;

  return (
    <Animated.View style={panelStyle}>
      <Animated.View
        style={innerStyle}
        onLayout={(event) => {
          // Lock full intrinsic height once; ignore later clipped layouts.
          if (measured.value === 1) return;
          const next = event.nativeEvent.layout.height;
          if (next <= 0) return;
          contentHeight.value = next;
          measured.value = 1;
          if (visibleRef.current) {
            startOpen();
          }
        }}>
        {children}
      </Animated.View>
    </Animated.View>
  );
}

function DraftColorSwatch({
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`과목 색상 ${hex}`}
      onPress={onPress}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: hex },
          selected && { borderColor, borderWidth: 2 },
        ]}
      />
    </Pressable>
  );
}

function SelectableChip({
  selected,
  dimmed = false,
  style,
  children,
  panHandlers,
  accessibilityLabel,
  accessibilityHint,
}: {
  selected: boolean;
  /** Drag placeholder — keeps opacity below selection settle. */
  dimmed?: boolean;
  style: object | object[];
  children: ReactNode;
  panHandlers?: object;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const targetOpacity = dimmed
    ? 0.28
    : selected
      ? CHIP_SELECTED_OPACITY
      : CHIP_IDLE_OPACITY;
  const opacity = useSharedValue(targetOpacity);

  useEffect(() => {
    cancelAnimation(opacity);
    opacity.value = withTiming(targetOpacity, CHIP_EASE);
  }, [opacity, targetOpacity]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[style, animStyle]}
      {...(panHandlers ?? {})}>
      {children}
    </Animated.View>
  );
}

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
 * Subject chips: tap select · re-tap for delete X · long-press drag reorder · soft + add.
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
  const [title, setTitle] = useState(
    () => (initial?.title ?? '').slice(0, MAX_STUDY_TITLE_LENGTH),
  );
  const [memo, setMemo] = useState(
    () => (initial?.memo ?? '').slice(0, MAX_STUDY_MEMO_LENGTH),
  );
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState<string>(SUBJECT_COLOR_OPTIONS[0]);
  const draftInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [chipHint, setChipHint] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);
  const [draggingName, setDraggingName] = useState<string | null>(null);
  /** Floating chip top-left in row-local coords while dragging. */
  const [dragLocal, setDragLocal] = useState({ x: 0, y: 0 });

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
  /** Finger offset inside the chip at drag start (page coords). */
  const fingerInChipRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef({ width: 0, height: 0 });
  const lastShiftAtRef = useRef(0);
  const lastPageRef = useRef({ x: 0, y: 0 });

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

  // Cap is MAX_SUBJECTS (10). Keep + visible (disabled) at capacity — do not unmount it.
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

  const findHoverIndex = useCallback((localX: number, localY: number) => {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    orderedNamesRef.current.forEach((name, index) => {
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
  }, []);

  const endDrag = useCallback(() => {
    const name = draggingRef.current;
    clearLongPressTimer();
    dragActivatedRef.current = false;
    activeChipRef.current = null;
    draggingRef.current = null;
    setDraggingName(null);
    setDragLocal({ x: 0, y: 0 });
    if (!name || !onReorderSubjects) return;
    const origin = dragOriginRef.current;
    const next = orderedNamesRef.current;
    if (namesSignature(next) === namesSignature(origin)) return;
    onReorderSubjects(next);
  }, [clearLongPressTimer, onReorderSubjects]);

  const handleChipTap = useCallback(
    (name: string) => {
      setChipHint(null);
      if (subjectPick !== name) {
        haptics.select();
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
              haptics.delete();
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
    (name: string, pageX: number, pageY: number) => {
      if (!onReorderSubjects) return;
      measureRow();
      const layout = chipLayoutsRef.current[name];
      if (!layout) return;
      const chipPageX = rowPageRef.current.x + layout.x;
      const chipPageY = rowPageRef.current.y + layout.y;
      fingerInChipRef.current = {
        x: pageX - chipPageX,
        y: pageY - chipPageY,
      };
      dragSizeRef.current = { width: layout.width, height: layout.height };
      lastShiftAtRef.current = 0;
      dragActivatedRef.current = true;
      draggingRef.current = name;
      dragOriginRef.current = [...orderedNamesRef.current];
      haptics.subjectReorderStart();
      setDraggingName(name);
      setDeleteArmed(null);
      setDragLocal({ x: layout.x, y: layout.y });
    },
    [measureRow, onReorderSubjects],
  );

  const shiftWhileDragging = useCallback(
    (name: string, localX: number, localY: number) => {
      const from = orderedNamesRef.current.indexOf(name);
      if (from < 0) return;
      const hover = findHoverIndex(localX, localY);
      if (hover < 0 || hover === from) return;
      const now = Date.now();
      // Avoid thrashing when the finger sits on a boundary.
      if (now - lastShiftAtRef.current < 48) return;
      lastShiftAtRef.current = now;
      const next = moveName(orderedNamesRef.current, from, hover);
      if (namesSignature(next) === namesSignature(orderedNamesRef.current)) {
        return;
      }
      haptics.subjectReorderTick();
      LayoutAnimation.configureNext(CHIP_SHIFT_ANIM);
      orderedNamesRef.current = next;
      setOrderedNames(next);
    },
    [findHoverIndex],
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
        onPanResponderGrant: (event: GestureResponderEvent) => {
          activeChipRef.current = name;
          dragActivatedRef.current = false;
          clearLongPressTimer();
          lastPageRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
          if (!onReorderSubjects) return;
          longPressTimerRef.current = setTimeout(() => {
            if (activeChipRef.current !== name) return;
            beginDrag(
              name,
              lastPageRef.current.x,
              lastPageRef.current.y,
            );
          }, LONG_PRESS_MS);
        },
        onPanResponderMove: (
          event: GestureResponderEvent,
          gesture: PanResponderGestureState,
        ) => {
          lastPageRef.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
          if (!dragActivatedRef.current) {
            if (
              Math.abs(gesture.dx) > MOVE_CANCEL_PX ||
              Math.abs(gesture.dy) > MOVE_CANCEL_PX
            ) {
              clearLongPressTimer();
            }
            return;
          }
          const { pageX, pageY } = event.nativeEvent;
          const localX = pageX - rowPageRef.current.x - fingerInChipRef.current.x;
          const localY = pageY - rowPageRef.current.y - fingerInChipRef.current.y;
          setDragLocal({ x: localX, y: localY });
          const centerX = localX + dragSizeRef.current.width / 2;
          const centerY = localY + dragSizeRef.current.height / 2;
          shiftWhileDragging(name, centerX, centerY);
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
    shiftWhileDragging,
    endDrag,
    handleChipTap,
  ]);

  const handleSave = useCallback(() => {
    if (!canSave || subject == null) return;
    // Length is gated by TextInput maxLength only — never reject on save.
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
          // Haptic fires in onDelete only after confirmed delete.
          onPress: onDelete,
        },
      ],
    );
  }, [onDelete]);

  const openAdd = useCallback(() => {
    if (!onAddSubject) return;
    if (atLimit) {
      haptics.reject();
      setChipHint(LIMIT_HINT);
      return;
    }
    haptics.fab();
    setChipHint(null);
    setDeleteArmed(null);
    setDraftName('');
    setDraftColor(SUBJECT_COLOR_OPTIONS[0]);
    addingRef.current = true;
    setAdding(true);
  }, [onAddSubject, atLimit]);

  const cancelAdd = useCallback(() => {
    // Dismiss keyboard first so sheet drop and height collapse don't fight.
    Keyboard.dismiss();
    draftInputRef.current?.blur();
    addingRef.current = false;
    setAdding(false);
    setDraftName('');
  }, []);

  const focusDraftAfterReveal = useCallback(() => {
    // Only focus after height settle — avoids keyboard lift fighting the reveal.
    if (!addingRef.current) return;
    draftInputRef.current?.focus();
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
      haptics.reject();
      setChipHint(subjectAddErrorMessage(normalized.reason));
      return;
    }
    const name = draftName.trim().replace(/\s+/g, ' ');
    haptics.subjectAdd();
    Keyboard.dismiss();
    draftInputRef.current?.blur();
    setSubjectPick(name);
    setDeleteArmed(null);
    addingRef.current = false;
    setAdding(false);
    setDraftName('');
    setChipHint(null);
  }, [onAddSubject, draftName, draftColor]);

  const draggingChip = draggingName
    ? orderedChips.find((s) => s.name === draggingName) ?? null
    : null;
  const draggingFill = draggingChip
    ? draggingChip.color || subjectColor(draggingChip.name, colorByName)
    : null;

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
                style={styles.chipWrap}>
                <SelectableChip
                  selected={selected}
                  dimmed={dragging}
                  panHandlers={pan?.panHandlers}
                  accessibilityLabel={`과목 ${name}`}
                  accessibilityHint={
                    onRemoveSubject
                      ? '선택한 뒤 다시 누르면 삭제 버튼이 나타나요.'
                      : undefined
                  }
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: fill,
                      borderColor: subjectBorderColor(name, fill),
                    },
                  ]}>
                  <Text
                    style={[
                      styles.subjectChipText,
                      dragging && styles.subjectChipPlaceholderText,
                    ]}
                    numberOfLines={1}>
                    {name}
                  </Text>
                </SelectableChip>
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

          {draggingChip && draggingFill ? (
            <View
              pointerEvents="none"
              style={[
                styles.chipWrap,
                styles.dragFloating,
                {
                  left: dragLocal.x,
                  top: dragLocal.y,
                  width: dragSizeRef.current.width || undefined,
                },
              ]}>
              <View
                style={[
                  styles.subjectChip,
                  styles.subjectChipDragging,
                  {
                    backgroundColor: draggingFill,
                    borderColor: subjectBorderColor(
                      draggingChip.name,
                      draggingFill,
                    ),
                    width: '100%',
                  },
                ]}>
                <Text style={styles.subjectChipText}>{draggingChip.name}</Text>
              </View>
            </View>
          ) : null}

          {onAddSubject ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                adding
                  ? '과목 추가 취소'
                  : atLimit
                    ? '과목 추가 불가, 최대 10개'
                    : '과목 추가'
              }
              accessibilityState={{ disabled: atLimit && !adding }}
              // Stay mounted while adding so a packed row never drops the +.
              // Under max: opens the name row; while open: same control cancels.
              disabled={atLimit && !adding}
              onPress={adding ? cancelAdd : openAdd}
              style={[
                styles.subjectChip,
                styles.addChip,
                {
                  borderColor:
                    atLimit && !adding ? colors.mutedLight : colors.muted,
                  backgroundColor: colors.surface,
                },
                (atLimit || adding) && styles.addChipDisabled,
              ]}>
              <SoftPlusIcon
                color={
                  atLimit && !adding ? colors.mutedLight : colors.muted
                }
              />
            </Pressable>
          ) : null}
        </View>

        <SubjectAddReveal
          visible={adding}
          onOpenComplete={focusDraftAfterReveal}>
          <View style={styles.addBlock}>
            <View style={styles.addRow}>
              <TextInput
                ref={draftInputRef}
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
              {SUBJECT_COLOR_OPTIONS.map((hex) => (
                <DraftColorSwatch
                  key={hex}
                  hex={hex}
                  selected={draftColor === hex}
                  borderColor={colors.black}
                  onPress={() => {
                    haptics.themePick();
                    setDraftColor(hex);
                  }}
                />
              ))}
            </View>
          </View>
        </SubjectAddReveal>

        {chipHint ? (
          <Text style={[styles.chipHint, { color: colors.muted }]}>
            {chipHint}
          </Text>
        ) : atLimit ? (
          <Text style={[styles.chipHint, { color: colors.mutedLight }]}>
            {LIMIT_HINT}
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
          // Hard cap — users cannot type past 40; no save-time reject.
          maxLength={MAX_STUDY_TITLE_LENGTH}
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
          // Hard cap — users cannot type past 120; no save-time reject.
          maxLength={MAX_STUDY_MEMO_LENGTH}
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
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    overflow: 'visible',
  },
  chipWrap: {
    position: 'relative',
    // RN defaults flexShrink:1 — packed rows were crushing chips/+ instead of wrapping.
    flexShrink: 0,
    overflow: 'visible',
  },
  dragFloating: {
    position: 'absolute',
    zIndex: 40,
    transform: [{ scale: 1.06 }],
  },
  // Width follows label; padding tuned so a 3-char Hangul name is the visual baseline.
  subjectChip: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    flexShrink: 0,
  },
  subjectChipPlaceholderText: {
    opacity: 0.55,
  },
  subjectChipDragging: {
    opacity: 0.98,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
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
    borderColor: tokenColors.muted,
    zIndex: 30,
  },
  deleteBadgeText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    lineHeight: 18,
    color: tokenColors.muted,
    marginTop: -1,
  },
  addChip: {
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    paddingHorizontal: 0,
    flexShrink: 0,
    flexGrow: 0,
  },
  addChipDisabled: {
    opacity: 0.55,
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
