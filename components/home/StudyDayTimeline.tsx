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
import { radii } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import {
  buildTimelineBands,
  type TimelineSlot,
} from '@/utils/study-timeline';
import { subjectColor } from '@/constants/tokens';
import { haptics } from '@/utils/haptics';

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
 * Full-day study timeline: faint 9/12/18/24 marks + light dividers,
 * band empty slots, filled rows. No 오전/오후/저녁 headers.
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

  const handleAdd = () => {
    if (atCap || !allowAdd) {
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
                allowAdd={allowAdd && !atCap}
                onAdd={handleAdd}
                onEditStudy={onEditStudy}
              />
            ))}
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

function TimelineSlotRow({
  slot,
  colorByName,
  allowAdd,
  onAdd,
  onEditStudy,
}: {
  slot: TimelineSlot;
  colorByName?: Record<string, string>;
  allowAdd: boolean;
  onAdd: () => void;
  onEditStudy: (row: HomeStudyRow) => void;
}) {
  const colors = useThemeColors();

  if (slot.kind === 'empty') {
    return (
      <Animated.View entering={ENTER} layout={ROW_LAYOUT}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="공부 기록 추가"
          accessibilityState={{ disabled: !allowAdd }}
          disabled={!allowAdd}
          onPress={onAdd}
          style={[
            styles.emptySlot,
            {
              backgroundColor: colors.surface,
              opacity: allowAdd ? 1 : 0.55,
            },
          ]}>
          <PlusIcon size={14} />
          <Text style={[styles.emptyText, { color: colors.accentText }]}>
            추가
          </Text>
        </Pressable>
      </Animated.View>
    );
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
  emptySlot: {
    height: 40,
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
  studyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    minWidth: 64,
    maxWidth: 88,
    height: 40,
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
    height: 40,
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
