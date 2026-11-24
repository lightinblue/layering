import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ElementRef,
} from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type HostView = ElementRef<typeof View>;
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { SubjectOption } from '@/components/home/AddStudyForm';
import {
  ArrowRightIcon,
  PlusIcon,
  SoftCheckIcon,
} from '@/components/icons/HomeIcons';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations, springs } from '@/constants/motion';
import {
  INLINE_STUDY_PLACEHOLDER,
  TIMELINE_MAX_STUDIES_PER_DAY,
  type TimelineBandId,
} from '@/constants/study-timeline';
import { MAX_STUDY_TITLE_LENGTH } from '@/storage/app-data';
import { radii, subjectColor, textInputFontSize } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import { buildTimelineBands } from '@/utils/study-timeline';
import { haptics } from '@/utils/haptics';
import { matchSubjectPrefix } from '@/utils/parse-subject-prefix';

/** Match home study chip/body height (not the cramped 36). */
const SLOT_HEIGHT = 44;
/** Vertical space between study rows inside a band (matches slotStack gap). */
const ROW_GAP = 5;
const ROW_STRIDE = SLOT_HEIGHT + ROW_GAP;

/** Same height as BandAddControl — keep when swapping empty slot → input. */
function bandAddHeight(span: number): number {
  return SLOT_HEIGHT * span + ROW_GAP * Math.max(0, span - 1);
}
const ROW_LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeInDown.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);
const EXIT = FadeOut.duration(durations.fadeOut);

type BandFrame = {
  id: TimelineBandId;
  pageY: number;
  height: number;
  count: number;
};

type StudyDayTimelineProps = {
  studies: HomeStudyRow[];
  subjects: SubjectOption[];
  colorByName?: Record<string, string>;
  allowAdd: boolean;
  onAddStudy: (input: {
    bandId: TimelineBandId;
    subject: string;
    title: string;
  }) => void;
  onEditStudy: (row: HomeStudyRow) => void;
  /** Toggle study-day todo check. */
  onToggleDayDone?: (studyId: string) => void;
  /** After confirm: move study to tomorrow, same band. */
  onDeferTomorrow?: (studyId: string) => void;
  /** Persist long-press reorder within a band. */
  onReorderBand?: (bandId: TimelineBandId, orderedIds: string[]) => void;
  /**
   * Persist long-press drop into another band (오전→오후/밤).
   * Return true only when the move was applied (optimistic UI depends on this).
   */
  onMoveStudyToBand?: (input: {
    studyId: string;
    toBandId: TimelineBandId;
    toIndex: number;
  }) => boolean;
};

/**
 * Day study bands: faint 8/12/18/24 marks + one 공부 add per band.
 * Long-press drag reorders within a band and can drop into another band.
 */
export function StudyDayTimeline({
  studies,
  subjects,
  colorByName,
  allowAdd,
  onAddStudy,
  onEditStudy,
  onToggleDayDone,
  onDeferTomorrow,
  onReorderBand,
  onMoveStudyToBand,
}: StudyDayTimelineProps) {
  const colors = useThemeColors();
  const bands = useMemo(() => buildTimelineBands(studies), [studies]);
  const atCap = studies.length >= TIMELINE_MAX_STUDIES_PER_DAY;
  const canAdd = allowAdd && !atCap;
  const [draftBandId, setDraftBandId] = useState<TimelineBandId | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const bandStackRefs = useRef<Partial<Record<TimelineBandId, HostView | null>>>(
    {},
  );
  const framesRef = useRef<BandFrame[]>([]);

  const measureBands = useCallback(() => {
    const next: BandFrame[] = [];
    let pending = bands.length;
    if (pending === 0) {
      framesRef.current = [];
      return;
    }
    for (const band of bands) {
      const node = bandStackRefs.current[band.id];
      const count = band.slots.filter((s) => s.kind === 'study').length;
      if (!node || typeof node.measureInWindow !== 'function') {
        pending -= 1;
        if (pending === 0) framesRef.current = next;
        continue;
      }
      node.measureInWindow(
        (_x: number, pageY: number, _w: number, height: number) => {
          next.push({
            id: band.id,
            pageY,
            height: Math.max(height, 1),
            count,
          });
          pending -= 1;
          if (pending === 0) {
            next.sort((a, b) => a.pageY - b.pageY);
            framesRef.current = next;
          }
        },
      );
    }
  }, [bands]);

  const resolveDropBand = useCallback(
    (absoluteY: number): { bandId: TimelineBandId; index: number } | null => {
      const frames = framesRef.current;
      if (frames.length === 0) return null;
      for (const frame of frames) {
        const bottom = frame.pageY + Math.max(frame.height, ROW_STRIDE);
        if (absoluteY >= frame.pageY && absoluteY <= bottom + ROW_STRIDE / 2) {
          const local = absoluteY - frame.pageY;
          const index = Math.max(
            0,
            Math.min(frame.count, Math.round(local / ROW_STRIDE)),
          );
          return { bandId: frame.id, index };
        }
      }
      // Above first / below last → clamp to nearest band end.
      if (absoluteY < frames[0]!.pageY) {
        return { bandId: frames[0]!.id, index: 0 };
      }
      const last = frames[frames.length - 1]!;
      return { bandId: last.id, index: last.count };
    },
    [],
  );

  const openDraft = useCallback(
    (bandId: TimelineBandId) => {
      if (!canAdd) {
        haptics.reject();
        return;
      }
      if (subjects.length === 0) {
        haptics.reject();
        return;
      }
      haptics.select();
      setDraftKey((k) => k + 1);
      setDraftBandId(bandId);
    },
    [canAdd, subjects.length],
  );

  const closeDraft = useCallback(() => setDraftBandId(null), []);

  const commitDraft = useCallback(
    (subject: string, title: string) => {
      if (!draftBandId) return;
      const bandId = draftBandId;
      // Clear tray first so a slow persist / remount cannot leave gray chrome up.
      setDraftBandId(null);
      onAddStudy({ bandId, subject, title });
    },
    [draftBandId, onAddStudy],
  );

  // Cap or external study list changes must not leave a draft tray mounted.
  useEffect(() => {
    if (!canAdd && draftBandId != null) setDraftBandId(null);
  }, [canAdd, draftBandId]);

  const canDrag = Boolean(onReorderBand || onMoveStudyToBand);

  return (
    <View style={styles.root} onLayout={measureBands}>
      {bands.map((band, bandIndex) => {
        const drafting = draftBandId === band.id;
        const studyRows = band.slots
          .filter((s) => s.kind === 'study')
          .map((s) => s.row);
        return (
          <View key={band.id} style={styles.bandBlock}>
            <TimelineMark label={band.labelStart} />
            <View
              ref={(node) => {
                bandStackRefs.current[band.id] = node;
              }}
              style={styles.slotStack}
              onLayout={measureBands}>
              <BandStudyList
                bandId={band.id}
                rows={studyRows}
                colorByName={colorByName}
                canReorder={canDrag}
                onEditStudy={(row) => {
                  closeDraft();
                  onEditStudy(row);
                }}
                onToggleDayDone={
                  onToggleDayDone
                    ? (id) => {
                        closeDraft();
                        onToggleDayDone(id);
                      }
                    : undefined
                }
                onDeferTomorrow={
                  onDeferTomorrow
                    ? (id) => {
                        closeDraft();
                        onDeferTomorrow(id);
                      }
                    : undefined
                }
                onDragStart={() => {
                  closeDraft();
                  measureBands();
                }}
                onReorder={(orderedIds) => onReorderBand?.(band.id, orderedIds)}
                onDropAcross={(studyId, absoluteY) => {
                  const hit = resolveDropBand(absoluteY);
                  if (!hit) return false;
                  if (hit.bandId === band.id) {
                    // Same band — let translation-based reorder handle it.
                    return false;
                  }
                  if (!onMoveStudyToBand) return false;
                  // Only optimistic-remove when persist path actually applied.
                  return onMoveStudyToBand({
                    studyId,
                    toBandId: hit.bandId,
                    toIndex: hit.index,
                  });
                }}
              />
              {drafting ? (
                // Keep empty-band footprint so lower content does not snap up,
                // but do NOT wrap the TextInput in a tall tappable surface
                // (that dead pad stole taps and blocked blur-dismiss).
                <View
                  style={[
                    styles.bandAddDraft,
                    studyRows.length === 0
                      ? { minHeight: bandAddHeight(band.addSpan) }
                      : null,
                  ]}
                  pointerEvents="box-none">
                  <InlineBandAddRow
                    key={draftKey}
                    subjects={subjects}
                    colorByName={colorByName}
                    onCancel={closeDraft}
                    onCommit={commitDraft}
                  />
                  {studyRows.length === 0 ? (
                    <View
                      pointerEvents="none"
                      style={{
                        flexGrow: 1,
                        minHeight: Math.max(
                          0,
                          bandAddHeight(band.addSpan) - SLOT_HEIGHT,
                        ),
                      }}
                    />
                  ) : null}
                </View>
              ) : canAdd && band.showAdd ? (
                <BandAddControl
                  label={band.addLabel}
                  span={band.addSpan}
                  filled={studyRows.length > 0}
                  onPress={() => openDraft(band.id)}
                />
              ) : null}
            </View>
            {bandIndex === bands.length - 1 ? (
              <TimelineMark label={band.labelEnd} />
            ) : null}
          </View>
        );
      })}
      {atCap ? (
        <Text style={[styles.capHint, { color: colors.muted }]}>
          하루 {TIMELINE_MAX_STUDIES_PER_DAY}개까지
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Plain View list + long-press pan reorder. Avoids DraggableFlatList, which
 * collapsed nested list height to 0 on drop (rows looked like they vanished).
 * Cross-band drops are resolved by the parent via absoluteY.
 */
function BandStudyList({
  bandId: _bandId,
  rows,
  colorByName,
  canReorder,
  onEditStudy,
  onToggleDayDone,
  onDeferTomorrow,
  onReorder,
  onDragStart,
  onDropAcross,
}: {
  bandId: TimelineBandId;
  rows: HomeStudyRow[];
  colorByName?: Record<string, string>;
  canReorder: boolean;
  onEditStudy: (row: HomeStudyRow) => void;
  onToggleDayDone?: (studyId: string) => void;
  onDeferTomorrow?: (studyId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onDragStart: () => void;
  /** Return true if a cross-band move was handled. */
  onDropAcross: (studyId: string, absoluteY: number) => boolean;
}) {
  const [items, setItems] = useState(rows);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const rowKey = rows
    .map(
      (r) =>
        `${r.id}:${r.dayOrder ?? ''}:${r.dayBand ?? ''}:${r.dayDone ? 1 : 0}`,
    )
    .join('|');

  useEffect(() => {
    setItems(rows);
  }, [rowKey, rows]);

  // Hook count must be identical for empty and non-empty bands. BandStudyList
  // stays mounted when a band goes 0↔1; never early-return around hooks
  // ("fewer hooks" / "more hooks than previous render").
  const commitRef = useRef<
    (from: number, translationY: number, absoluteY: number) => void
  >(() => {});
  commitRef.current = (from, translationY, absoluteY) => {
    const list = itemsRef.current;
    if (from < 0 || from >= list.length) return;
    const moved = list[from];
    if (!moved) return;

    if (onDropAcross(moved.id, absoluteY)) {
      // Optimistic remove — parent persist will refresh band membership.
      setItems(list.filter((_, i) => i !== from));
      return;
    }

    const delta = Math.round(translationY / ROW_STRIDE);
    const to = Math.max(0, Math.min(list.length - 1, from + delta));
    if (to === from) return;
    const next = [...list];
    next.splice(from, 1);
    next.splice(to, 0, moved);
    // Optimistic UI — rows stay mounted with stable keys.
    setItems(next);
    onReorder(next.map((row) => row.id));
  };

  const listHeight =
    items.length === 0
      ? 0
      : items.length * SLOT_HEIGHT + Math.max(0, items.length - 1) * ROW_GAP;

  return (
    <View style={[styles.bandList, { height: listHeight }]}>
      {items.map((item, index) => (
        <DraggableStudyRow
          key={item.id}
          item={item}
          index={index}
          colorByName={colorByName}
          canReorder={canReorder}
          onEditStudy={onEditStudy}
          onToggleDayDone={onToggleDayDone}
          onDeferTomorrow={onDeferTomorrow}
          onDragStart={onDragStart}
          onCommitDrag={(from, ty, absoluteY) =>
            commitRef.current(from, ty, absoluteY)
          }
        />
      ))}
    </View>
  );
}

function DraggableStudyRow({
  item,
  index,
  colorByName,
  canReorder,
  onEditStudy,
  onToggleDayDone,
  onDeferTomorrow,
  onCommitDrag,
  onDragStart,
}: {
  item: HomeStudyRow;
  index: number;
  colorByName?: Record<string, string>;
  canReorder: boolean;
  onEditStudy: (row: HomeStudyRow) => void;
  onToggleDayDone?: (studyId: string) => void;
  onDeferTomorrow?: (studyId: string) => void;
  onCommitDrag: (
    from: number,
    translationY: number,
    absoluteY: number,
  ) => void;
  onDragStart: () => void;
}) {
  const colors = useThemeColors();
  const translateY = useSharedValue(0);
  const isActive = useSharedValue(false);
  const startIndex = useSharedValue(index);
  const checkScale = useSharedValue(1);
  const deferScale = useSharedValue(1);
  const commitRef = useRef(onCommitDrag);
  commitRef.current = onCommitDrag;
  const startRef = useRef(onDragStart);
  startRef.current = onDragStart;

  useEffect(() => {
    startIndex.value = index;
  }, [index, startIndex]);

  const finishDrag = (from: number, translationY: number, absoluteY: number) => {
    commitRef.current(from, translationY, absoluteY);
  };

  const pan = useMemo(() => {
    // Web: Pan + Pressable race → flaky check/edit taps. Reorder stays native.
    if (!canReorder || Platform.OS === 'web') {
      return Gesture.Pan().enabled(false);
    }
    return Gesture.Pan()
      .activateAfterLongPress(180)
      .maxPointers(1)
      .onStart(() => {
        isActive.value = true;
        startIndex.value = index;
        runOnJS(haptics.select)();
        runOnJS(startRef.current)();
      })
      .onUpdate((e) => {
        translateY.value = e.translationY;
      })
      .onEnd((e) => {
        const from = startIndex.value;
        const ty = e.translationY;
        const ay = e.absoluteY;
        // Soft settle — no spring bounce.
        translateY.value = withTiming(0, { duration: 140 });
        isActive.value = false;
        runOnJS(finishDrag)(from, ty, ay);
      })
      .onFinalize(() => {
        if (isActive.value) {
          translateY.value = withTiming(0, { duration: 140 });
          isActive.value = false;
        }
      });
    // finishDrag reads commitRef — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReorder, index, isActive, startIndex, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isActive.value ? 40 : 1,
    opacity: isActive.value ? 0.97 : 1,
    // Soft downward shadow (iOS).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: isActive.value ? 4 : 0 },
    shadowOpacity: isActive.value ? 0.1 : 0,
    shadowRadius: isActive.value ? 6 : 0,
    // Soft downward shadow (Android).
    elevation: isActive.value ? 3 : 0,
  }));

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));
  const deferAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: deferScale.value }],
  }));

  const top = index * ROW_STRIDE;
  const done = Boolean(item.dayDone);
  const showActions = Boolean(onToggleDayDone || onDeferTomorrow);

  const bounce = (sv: typeof checkScale) => {
    sv.value = withSpring(0.86, springs.snappy, (finished) => {
      if (finished) sv.value = withSpring(1, springs.soft);
    });
  };

  const confirmDefer = () => {
    if (!onDeferTomorrow) return;
    haptics.select();
    bounce(deferScale);
    // RN-web Alert.alert is a no-op stub — use window.confirm on web.
    if (Platform.OS === 'web') {
      const ok =
        typeof window !== 'undefined' &&
        window.confirm('내일로 미룰까요?\n같은 시간대로 옮겨져요.');
      if (ok) onDeferTomorrow(item.id);
      return;
    }
    Alert.alert('내일로 미룰까요?', '같은 시간대로 옮겨져요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '미루기',
        onPress: () => onDeferTomorrow(item.id),
      },
    ]);
  };

  const studyMain = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.subjectName} ${item.content} 수정`}
      accessibilityHint={
        canReorder && Platform.OS !== 'web'
          ? '길게 눌러 순서를 바꾸거나 다른 시간대로 옮길 수 있어요'
          : undefined
      }
      onPress={() => {
        haptics.select();
        onEditStudy(item);
      }}
      style={styles.studyMain}>
      <View
        style={[
          styles.chip,
          {
            backgroundColor: subjectColor(
              item.subjectName,
              item.subjectColor ?? colorByName,
            ),
          },
        ]}>
        <Text
          style={[styles.chipText, { color: colors.onAccent }]}
          numberOfLines={1}>
          {item.subjectName}
        </Text>
      </View>
      <View style={[styles.body, { backgroundColor: colors.surface }]}>
        <Text
          style={[
            styles.bodyText,
            {
              color: done ? colors.muted : colors.body,
            },
          ]}
          numberOfLines={1}>
          {item.content}
        </Text>
      </View>
    </Pressable>
  );

  const rowActions = showActions ? (
    <View style={styles.rowActions}>
      {onDeferTomorrow ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="내일로 미루기"
          hitSlop={10}
          onPress={confirmDefer}
          style={styles.actionHit}>
          <Animated.View style={deferAnimStyle}>
            <ArrowRightIcon size={16} color={colors.mutedLight} />
          </Animated.View>
        </Pressable>
      ) : null}
      {onToggleDayDone ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? '완료 해제' : '완료'}
          hitSlop={10}
          onPress={() => {
            bounce(checkScale);
            onToggleDayDone(item.id);
          }}
          style={styles.actionHit}>
          <Animated.View style={checkAnimStyle}>
            <SoftCheckIcon
              size={18}
              color={done ? colors.primary : colors.mutedLight}
              strokeWidth={done ? 2.6 : 2}
            />
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  ) : null;

  // Actions sit outside GestureDetector so Pan cannot swallow check/defer taps
  // (flaky on RN-web when Pressable is nested under a long-press Pan).
  return (
    <Animated.View
      style={[
        styles.absoluteRow,
        { top, height: SLOT_HEIGHT },
        animatedStyle,
      ]}>
      <View style={styles.studyRow}>
        <GestureDetector gesture={pan}>
          <Animated.View style={styles.studyMainWrap}>{studyMain}</Animated.View>
        </GestureDetector>
        {rowActions}
      </View>
    </Animated.View>
  );
}

function TimelineMark({ label }: { label: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.markRow}>
      <Text style={[styles.markLabel, { color: colors.mutedLight }]}>
        {label}
      </Text>
      <View style={[styles.markLine, { backgroundColor: colors.hairline }]} />
    </View>
  );
}

function BandAddControl({
  label,
  span,
  filled,
  onPress,
}: {
  label: string;
  span: number;
  filled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const height = bandAddHeight(span);
  return (
    <Animated.View entering={ENTER} exiting={EXIT} layout={ROW_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[
          styles.bandAdd,
          {
            minHeight: height,
            backgroundColor: filled ? 'transparent' : colors.surface,
          },
        ]}>
        <PlusIcon size={14} />
        <Text style={[styles.emptyText, { color: colors.accentText }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function InlineBandAddRow({
  subjects,
  onCancel,
  onCommit,
}: {
  subjects: SubjectOption[];
  colorByName?: Record<string, string>;
  onCancel: () => void;
  onCommit: (subject: string, title: string) => void;
}) {
  const colors = useThemeColors();
  const [raw, setRaw] = useState('');
  const [showSubjectPrompt, setShowSubjectPrompt] = useState(false);
  const names = subjects.map((s) => s.name);
  /** Skip blur-dismiss when save/submit is in flight (blur fires first). */
  const committingRef = useRef(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  // RN-web often ignores autoFocus — focus after mount (and once more on web).
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const webRetry =
      Platform.OS === 'web'
        ? window.setTimeout(() => inputRef.current?.focus(), 50)
        : null;
    return () => {
      cancelAnimationFrame(id);
      if (webRetry != null) window.clearTimeout(webRetry);
    };
  }, []);

  const submit = () => {
    const match = matchSubjectPrefix(raw, names);
    const title = match.title.trim();
    if (!title) {
      committingRef.current = true;
      haptics.select();
      onCancel();
      return;
    }
    if (!match.subject) {
      // Stay open for the hint; allow a later blur to dismiss.
      committingRef.current = false;
      haptics.reject();
      setShowSubjectPrompt(true);
      return;
    }
    setShowSubjectPrompt(false);
    committingRef.current = true;
    haptics.save();
    onCommit(match.subject, title);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(durations.fadeIn).easing(Easing.out(Easing.cubic))}
      exiting={EXIT}
      layout={ROW_LAYOUT}
      style={styles.inlineWrap}>
      <View style={styles.inlineInputRow}>
        <TextInput
          ref={inputRef}
          value={raw}
          onChangeText={(text) => {
            setRaw(text);
            // Clear hint as soon as a known subject prefix is present.
            if (
              showSubjectPrompt &&
              matchSubjectPrefix(text, names).subject
            ) {
              setShowSubjectPrompt(false);
            }
          }}
          placeholder={INLINE_STUDY_PLACEHOLDER}
          placeholderTextColor={colors.mutedLight}
          maxLength={MAX_STUDY_TITLE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={submit}
          blurOnSubmit
          autoFocus
          onBlur={() => {
            if (committingRef.current) {
              committingRef.current = false;
              return;
            }
            // Dismiss draft when focus leaves without save.
            onCancel();
          }}
          style={[
            styles.inlineInput,
            { backgroundColor: colors.surface, color: colors.body },
          ]}
          accessibilityLabel="학습 내용"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장"
          // onPressIn before blur so save is not cancelled by blur-dismiss.
          onPressIn={() => {
            committingRef.current = true;
          }}
          onPress={submit}
          style={[styles.savePill, { backgroundColor: colors.primary }]}>
          <Text style={[styles.savePillText, { color: colors.onAccent }]}>
            저장
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="취소"
          hitSlop={8}
          onPressIn={() => {
            committingRef.current = true;
          }}
          onPress={() => {
            haptics.select();
            onCancel();
          }}
          style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.muted }]}>취소</Text>
        </Pressable>
      </View>
      {showSubjectPrompt ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
          style={[styles.subjectHint, { color: colors.primary }]}>
          과목을 입력해주세요
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 4,
  },
  bandBlock: {
    gap: 6,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 1,
  },
  markLabel: {
    fontFamily: fonts.gothamMedium,
    fontSize: 11,
    width: 22,
    textAlign: 'right',
    opacity: 0.85,
  },
  markLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  slotStack: {
    gap: ROW_GAP,
    paddingLeft: 32,
    position: 'relative',
  },
  bandList: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  absoluteRow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bandAdd: {
    borderRadius: radii.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  /** Compact draft tray — one input row (not full empty-band addSpan). */
  bandAddDraft: {
    borderRadius: radii.chip,
    justifyContent: 'flex-start',
    minHeight: SLOT_HEIGHT,
  },
  emptyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  inlineWrap: {
    gap: 6,
  },
  /** Small theme-primary hint under the inline add input (no toast/banner). */
  subjectHint: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    lineHeight: 16,
    paddingLeft: 4,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    minWidth: 0,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
    height: SLOT_HEIGHT,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    fontFamily: fonts.nexonMedium,
    fontSize: textInputFontSize,
  },
  savePill: {
    height: SLOT_HEIGHT,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 14,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  savePillText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  cancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  cancelText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: SLOT_HEIGHT,
  },
  /** Flex host for GestureDetector → studyMain (actions are siblings). */
  studyMainWrap: {
    flex: 1,
    minWidth: 0,
    height: SLOT_HEIGHT,
  },
  studyMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: SLOT_HEIGHT,
  },
  chip: {
    minWidth: 64,
    maxWidth: 88,
    height: SLOT_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  body: {
    flex: 1,
    minWidth: 0,
    height: SLOT_HEIGHT,
    borderRadius: radii.chip,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  bodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    paddingLeft: 2,
  },
  actionHit: {
    width: 28,
    height: SLOT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capHint: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    paddingLeft: 32,
    paddingTop: 8,
  },
});
