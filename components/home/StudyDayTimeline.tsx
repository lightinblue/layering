import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  NestableDraggableFlatList,
  type RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import type { SubjectOption } from '@/components/home/AddStudyForm';
import { PlusIcon } from '@/components/icons/HomeIcons';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import {
  INLINE_STUDY_PLACEHOLDER,
  TIMELINE_MAX_STUDIES_PER_DAY,
  type TimelineBandId,
} from '@/constants/study-timeline';
import { MAX_STUDY_TITLE_LENGTH } from '@/storage/app-data';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import { buildTimelineBands } from '@/utils/study-timeline';
import { haptics } from '@/utils/haptics';
import { matchSubjectPrefix } from '@/utils/parse-subject-prefix';

/** Match home study chip/body height (not the cramped 36). */
const SLOT_HEIGHT = 44;
/** Vertical space between study rows inside a band (matches slotStack gap). */
const ROW_GAP = 5;
const ROW_LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeInDown.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);
const EXIT = FadeOut.duration(durations.fadeOut);

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
  /** Persist long-press reorder within a band (smooth drag). */
  onReorderBand?: (bandId: TimelineBandId, orderedIds: string[]) => void;
};

/**
 * Day study bands: faint 8/12/18/24 marks + one 공부 add per band.
 * Tap → full-width inline input; subject from live prefix parse on save.
 * After save, keeps an empty inline input open for continuous entry.
 * Long-press drag reorders studies within the band.
 */
export function StudyDayTimeline({
  studies,
  subjects,
  colorByName,
  allowAdd,
  onAddStudy,
  onEditStudy,
  onReorderBand,
}: StudyDayTimelineProps) {
  const colors = useThemeColors();
  const bands = useMemo(() => buildTimelineBands(studies), [studies]);
  const atCap = studies.length >= TIMELINE_MAX_STUDIES_PER_DAY;
  const canAdd = allowAdd && !atCap;
  const [draftBandId, setDraftBandId] = useState<TimelineBandId | null>(null);
  /** Remount key so a fresh empty input appears after each save. */
  const [draftKey, setDraftKey] = useState(0);

  const openDraft = (bandId: TimelineBandId) => {
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
  };

  const closeDraft = () => setDraftBandId(null);

  const commitDraft = (subject: string, title: string) => {
    if (!draftBandId) return;
    const bandId = draftBandId;
    onAddStudy({ bandId, subject, title });
    // Continuous entry: reopen empty inline add under the new row when under cap.
    if (studies.length + 1 >= TIMELINE_MAX_STUDIES_PER_DAY) {
      setDraftBandId(null);
      return;
    }
    setDraftKey((k) => k + 1);
    setDraftBandId(bandId);
  };

  return (
    <View style={styles.root}>
      {bands.map((band, bandIndex) => {
        const drafting = draftBandId === band.id;
        const studyRows = band.slots
          .filter((s) => s.kind === 'study')
          .map((s) => s.row);
        return (
          <View key={band.id} style={styles.bandBlock}>
            <TimelineMark label={band.labelStart} />
            <View style={styles.slotStack}>
              <BandStudyList
                rows={studyRows}
                colorByName={colorByName}
                canReorder={Boolean(onReorderBand)}
                onEditStudy={onEditStudy}
                onReorder={(orderedIds) => onReorderBand?.(band.id, orderedIds)}
              />
              {drafting ? (
                <InlineBandAddRow
                  key={draftKey}
                  subjects={subjects}
                  colorByName={colorByName}
                  onCancel={closeDraft}
                  onCommit={commitDraft}
                />
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
 * Per-band nestable drag list. Keeps local data during drag so rows never
 * flash empty when the parent re-renders mid-gesture.
 */
function BandStudyList({
  rows,
  colorByName,
  canReorder,
  onEditStudy,
  onReorder,
}: {
  rows: HomeStudyRow[];
  colorByName?: Record<string, string>;
  canReorder: boolean;
  onEditStudy: (row: HomeStudyRow) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  const colors = useThemeColors();
  const [data, setData] = useState(rows);
  const rowKey = rows.map((r) => `${r.id}:${r.dayOrder ?? ''}`).join('|');

  useEffect(() => {
    setData(rows);
  }, [rowKey, rows]);

  if (data.length === 0) return null;

  const listHeight =
    data.length * SLOT_HEIGHT + Math.max(0, data.length - 1) * ROW_GAP;

  return (
    <NestableDraggableFlatList
      data={data}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      activationDistance={10}
      animationConfig={{
        damping: 22,
        mass: 0.28,
        stiffness: 220,
        overshootClamping: false,
      }}
      containerStyle={[styles.dragList, { height: listHeight }]}
      // Avoid ItemSeparator — it collapses height after drag in nested lists.
      onDragBegin={() => haptics.select()}
      onDragEnd={({ data: next }) => {
        setData(next);
        const ids = next.map((row) => row.id);
        const prev = rows.map((row) => row.id);
        if (ids.length !== prev.length) {
          // Never persist a partial list (would drop rows).
          setData(rows);
          return;
        }
        if (ids.every((id, i) => id === prev[i])) return;
        onReorder(ids);
      }}
      renderItem={({
        item,
        drag,
        isActive,
        getIndex,
      }: RenderItemParams<HomeStudyRow>) => {
        const index = getIndex() ?? 0;
        const isLast = index >= data.length - 1;
        return (
          <ScaleDecorator activeScale={1.02}>
            <View
              style={[
                !isLast ? styles.studyItemGap : null,
                isActive ? styles.dragging : undefined,
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.subjectName} ${item.content} 수정`}
                accessibilityHint="길게 눌러 순서를 바꿀 수 있어요"
                delayLongPress={180}
                onLongPress={canReorder ? drag : undefined}
                onPress={() => {
                  haptics.select();
                  onEditStudy(item);
                }}
                style={styles.studyRow}>
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
                <View
                  style={[styles.body, { backgroundColor: colors.surface }]}>
                  <Text
                    style={[styles.bodyText, { color: colors.body }]}
                    numberOfLines={1}>
                    {item.content}
                  </Text>
                </View>
              </Pressable>
            </View>
          </ScaleDecorator>
        );
      }}
    />
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
  /** When the band already has ≥1 study, drop the gray surface fill. */
  filled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const height = SLOT_HEIGHT * span + ROW_GAP * Math.max(0, span - 1);
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
  /** Shown only after save without a live-matched subject prefix. */
  const [showSubjectPrompt, setShowSubjectPrompt] = useState(false);
  const names = subjects.map((s) => s.name);

  const submit = () => {
    const match = matchSubjectPrefix(raw, names);
    const title = match.title.trim();
    // Empty content (blank or subject-only): dismiss, never create a record.
    if (!title) {
      haptics.select();
      onCancel();
      return;
    }
    if (!match.subject) {
      haptics.reject();
      setShowSubjectPrompt(true);
      return;
    }
    haptics.save();
    onCommit(match.subject, title);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(durations.fadeIn).easing(Easing.out(Easing.cubic))}
      exiting={EXIT}
      layout={ROW_LAYOUT}
      style={styles.inlineWrap}>
      {showSubjectPrompt ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="과목을 선택해 주세요"
          accessibilityHint="과목 이름을 앞에 적으면 자동으로 배정돼요"
          onPress={() => haptics.select()}
          style={[
            styles.subjectPrompt,
            {
              backgroundColor: colors.surface,
              borderColor: colors.mutedLight,
            },
          ]}>
          <Text style={[styles.subjectPromptText, { color: colors.muted }]}>
            과목을 선택해 주세요
          </Text>
        </Pressable>
      ) : null}

      {/* Full-width gray content — no subject chip UI; live-parse on save. */}
      <View style={styles.inlineInputRow}>
        <TextInput
          value={raw}
          onChangeText={(text) => {
            setRaw(text);
            if (showSubjectPrompt) setShowSubjectPrompt(false);
          }}
          placeholder={INLINE_STUDY_PLACEHOLDER}
          placeholderTextColor={colors.mutedLight}
          maxLength={MAX_STUDY_TITLE_LENGTH}
          returnKeyType="done"
          onSubmitEditing={submit}
          blurOnSubmit
          autoFocus
          style={[
            styles.inlineInput,
            { backgroundColor: colors.surface, color: colors.body },
          ]}
          accessibilityLabel="학습 내용"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="저장"
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
          onPress={() => {
            haptics.select();
            onCancel();
          }}
          style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.muted }]}>취소</Text>
        </Pressable>
      </View>
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
  },
  dragList: {
    flexGrow: 0,
    overflow: 'visible',
  },
  studyItemGap: {
    marginBottom: ROW_GAP,
  },
  dragging: {
    opacity: 0.92,
    zIndex: 2,
  },
  bandAdd: {
    borderRadius: radii.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  emptyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  inlineWrap: {
    gap: 6,
  },
  subjectPrompt: {
    height: SLOT_HEIGHT,
    borderRadius: radii.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  subjectPromptText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
    height: SLOT_HEIGHT,
    borderRadius: radii.chip,
    paddingHorizontal: 12,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  savePill: {
    height: SLOT_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 6,
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
  capHint: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    paddingLeft: 32,
    paddingTop: 8,
  },
});
