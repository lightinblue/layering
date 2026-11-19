import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';

import { PlusIcon } from '@/components/icons/HomeIcons';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { TIMELINE_MAX_STUDIES_PER_DAY } from '@/constants/study-timeline';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import {
  buildTimelineBands,
  type TimelineSlot,
} from '@/utils/study-timeline';
import { haptics } from '@/utils/haptics';

const SLOT_HEIGHT = 40;
const ROW_LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeInDown.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);

type StudyDayTimelineProps = {
  studies: HomeStudyRow[];
  colorByName?: Record<string, string>;
  allowAdd: boolean;
  onAdd: () => void;
  onEditStudy: (row: HomeStudyRow) => void;
};

/**
 * Day study bands: faint 8/12/18/24 marks + one add control per band
 * (오전/오후/밤 투두). No section headers.
 */
export function StudyDayTimeline({
  studies,
  colorByName,
  allowAdd,
  onAdd,
  onEditStudy,
}: StudyDayTimelineProps) {
  const colors = useThemeColors();
  const bands = buildTimelineBands(studies);
  const atCap = studies.length >= TIMELINE_MAX_STUDIES_PER_DAY;
  const canAdd = allowAdd && !atCap;

  const handleAdd = () => {
    if (!canAdd) {
      haptics.reject();
      return;
    }
    haptics.select();
    onAdd();
  };

  return (
    <View style={styles.root}>
      {bands.map((band, bandIndex) => (
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
            {canAdd && band.showAdd ? (
              <BandAddControl
                label={band.addLabel}
                span={band.addSpan}
                onPress={handleAdd}
              />
            ) : null}
          </Animated.View>
          {bandIndex === bands.length - 1 ? (
            <TimelineMark label={band.labelEnd} />
          ) : null}
        </View>
      ))}
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

/** Single add control for a band — height spans remaining empty capacity. */
function BandAddControl({
  label,
  span,
  onPress,
}: {
  label: string;
  span: number;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const height = SLOT_HEIGHT * span + 6 * Math.max(0, span - 1);
  return (
    <Animated.View entering={ENTER} layout={ROW_LAYOUT}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={[
          styles.bandAdd,
          {
            minHeight: height,
            backgroundColor: colors.surface,
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
    gap: 8,
  },
  markRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
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
    gap: 6,
    paddingLeft: 32,
  },
  bandAdd: {
    borderRadius: radii.chip,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  emptyText: {
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
