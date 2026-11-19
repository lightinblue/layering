import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { radii, subjectBorderColor, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import {
  buildTimelineBands,
  type TimelineSlot,
} from '@/utils/study-timeline';
import { haptics } from '@/utils/haptics';
import {
  matchSubjectPrefix,
  resolveSubjectAndTitle,
} from '@/utils/parse-subject-prefix';

const SLOT_HEIGHT = 36;
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
};

/**
 * Day study bands: faint 8/12/18/24 marks + one 투두 add per band.
 * Tap 투두 → inline composer in place (chips + title); no sheet.
 */
export function StudyDayTimeline({
  studies,
  subjects,
  colorByName,
  allowAdd,
  onAddStudy,
  onEditStudy,
}: StudyDayTimelineProps) {
  const colors = useThemeColors();
  const bands = buildTimelineBands(studies);
  const atCap = studies.length >= TIMELINE_MAX_STUDIES_PER_DAY;
  const canAdd = allowAdd && !atCap;
  const [draftBandId, setDraftBandId] = useState<TimelineBandId | null>(null);

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
    setDraftBandId(bandId);
  };

  const closeDraft = () => setDraftBandId(null);

  const commitDraft = (subject: string, title: string) => {
    if (!draftBandId) return;
    onAddStudy({ bandId: draftBandId, subject, title });
    setDraftBandId(null);
  };

  return (
    <View style={styles.root}>
      {bands.map((band, bandIndex) => {
        const drafting = draftBandId === band.id;
        return (
          <View key={band.id} style={styles.bandBlock}>
            <TimelineMark label={band.labelStart} />
            <Animated.View style={styles.slotStack} layout={ROW_LAYOUT}>
              {band.slots.map((slot) => (
                <TimelineSlotRow
                  key={slot.kind === 'study' ? slot.row.id : slot.key}
                  slot={slot}
                  colorByName={colorByName}
                  onEditStudy={onEditStudy}
                />
              ))}
              {drafting ? (
                <InlineBandAddRow
                  subjects={subjects}
                  colorByName={colorByName}
                  onCancel={closeDraft}
                  onCommit={commitDraft}
                />
              ) : canAdd && band.showAdd ? (
                <BandAddControl
                  label={band.addLabel}
                  span={band.addSpan}
                  onPress={() => openDraft(band.id)}
                />
              ) : null}
            </Animated.View>
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
  onPress,
}: {
  label: string;
  span: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Animated.View entering={ENTER} exiting={EXIT} layout={ROW_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[
          styles.bandAdd,
          { backgroundColor: colors.surface },
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
  colorByName,
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
  const [picked, setPicked] = useState<string | null>(null);
  /** Shown only after save without a subject (match or pick). */
  const [showSubjectPrompt, setShowSubjectPrompt] = useState(false);
  const names = subjects.map((s) => s.name);
  const match = matchSubjectPrefix(raw, names);
  const highlighted = match.subject ?? picked;

  useEffect(() => {
    if (highlighted != null) setShowSubjectPrompt(false);
  }, [highlighted]);

  const pickSubject = (name: string) => {
    haptics.select();
    setPicked(name);
    setShowSubjectPrompt(false);
  };

  const submit = () => {
    const resolved = resolveSubjectAndTitle(raw, names, picked);
    if (!resolved) {
      haptics.reject();
      if (highlighted == null) setShowSubjectPrompt(true);
      return;
    }
    haptics.save();
    onCommit(resolved.subject, resolved.title);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(durations.fadeIn).easing(Easing.out(Easing.cubic))}
      exiting={EXIT}
      layout={ROW_LAYOUT}
      style={styles.inlineWrap}>
      {showSubjectPrompt && highlighted == null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="과목을 선택해 주세요"
          accessibilityHint="아래 과목 칩을 눌러 선택해요"
          onPress={() => {
            haptics.select();
            // Keep prompt; tapping a chip completes the pick.
          }}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipRow}>
        {subjects.map((s) => {
          const selected = s.name === highlighted;
          const fill = s.color || subjectColor(s.name, colorByName);
          const border = subjectBorderColor(s.name, fill);
          return (
            <Pressable
              key={s.name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`과목 ${s.name}`}
              onPress={() => pickSubject(s.name)}
              style={[
                styles.subjectChip,
                {
                  backgroundColor: fill,
                  opacity: selected || highlighted == null ? 1 : 0.45,
                  borderColor: border,
                },
              ]}>
              <Text
                style={[styles.subjectChipText, { color: colors.onAccent }]}
                numberOfLines={1}>
                {s.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.inlineInputRow}>
        <TextInput
          value={raw}
          onChangeText={setRaw}
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

function TimelineSlotRow({
  slot,
  colorByName,
  onEditStudy,
}: {
  slot: TimelineSlot;
  colorByName?: Record<string, string>;
  onEditStudy: (row: HomeStudyRow) => void;
}) {
  const colors = useThemeColors();

  if (slot.kind === 'empty') {
    return null;
  }

  const { row } = slot;
  return (
    <Animated.View entering={ENTER} layout={ROW_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.subjectName} ${row.content} 수정`}
        onPress={() => {
          haptics.select();
          onEditStudy(row);
        }}
        style={styles.studyRow}>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: subjectColor(
                row.subjectName,
                row.subjectColor ?? colorByName,
              ),
            },
          ]}>
          <Text
            style={[styles.chipText, { color: colors.onAccent }]}
            numberOfLines={1}>
            {row.subjectName}
          </Text>
        </View>
        <View style={[styles.body, { backgroundColor: colors.surface }]}>
          <Text
            style={[styles.bodyText, { color: colors.body }]}
            numberOfLines={1}>
            {row.content}
          </Text>
        </View>
      </Pressable>
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
    gap: 5,
    paddingLeft: 32,
  },
  bandAdd: {
    height: SLOT_HEIGHT,
    borderRadius: radii.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  inlineWrap: {
    gap: 6,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
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
  subjectChip: {
    minWidth: 56,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  subjectChipText: {
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
    fontSize: 13,
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
