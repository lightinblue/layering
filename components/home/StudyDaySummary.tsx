import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';

import { ArrowRightIcon } from '@/components/icons/HomeIcons';
import type { HomeStudyRow } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { durations } from '@/constants/motion';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

const LAYOUT = LinearTransition.duration(durations.listRow);
const ENTER = FadeIn.duration(durations.fadeIn).easing(
  Easing.out(Easing.cubic),
);

/** Max subject chip rows on the home summary. */
const SUMMARY_MAX_ROWS = 3;

type SubjectGroup = {
  subjectName: string;
  subjectColor?: string;
  titles: string[];
};

function groupStudiesBySubject(
  studies: readonly HomeStudyRow[],
): SubjectGroup[] {
  const order: string[] = [];
  const map = new Map<
    string,
    { subjectColor?: string; titles: string[] }
  >();

  for (const row of studies) {
    const key = row.subjectName;
    const existing = map.get(key);
    if (!existing) {
      order.push(key);
      map.set(key, {
        ...(row.subjectColor ? { subjectColor: row.subjectColor } : {}),
        titles: [row.content],
      });
      continue;
    }
    existing.titles.push(row.content);
  }

  return order.slice(0, SUMMARY_MAX_ROWS).map((name) => {
    const g = map.get(name)!;
    return {
      subjectName: name,
      ...(g.subjectColor ? { subjectColor: g.subjectColor } : {}),
      titles: g.titles,
    };
  });
}

/** Titles only; `총 n개` is rendered muted separately. */
function titlePreviewLead(titles: readonly string[]): string {
  if (titles.length === 0) return '';
  if (titles.length === 1) return titles[0]!;
  return `${titles[0]!}, ${titles[1]!}…`;
}

type StudyDaySummaryProps = {
  studies: HomeStudyRow[];
  isToday: boolean;
  colorByName?: Record<string, string>;
  onOpenDay: () => void;
};

/**
 * Home compact study strip — chip + title rows (max 3 subjects).
 */
export function StudyDaySummary({
  studies,
  isToday,
  colorByName,
  onOpenDay,
}: StudyDaySummaryProps) {
  const colors = useThemeColors();
  const groups = useMemo(() => groupStudiesBySubject(studies), [studies]);
  const title = isToday ? '오늘 한 공부' : '이 날 한 공부';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} 자세히 보기`}
      onPress={onOpenDay}
      style={styles.root}>
      <View style={styles.titleRow}>
        <Text style={[styles.label, { color: colors.sectionLabel }]}>
          {title}
        </Text>
        <ArrowRightIcon size={12} color={colors.muted} />
      </View>

      <Animated.View layout={LAYOUT} style={styles.card}>
        <View style={[styles.press, { backgroundColor: colors.surface }]}>
          {studies.length === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              기록이 없어요
            </Text>
          ) : (
            <Animated.View entering={ENTER} style={styles.previewCol}>
              {groups.map((group) => (
                <View key={group.subjectName} style={styles.previewRow}>
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: subjectColor(
                          group.subjectName,
                          group.subjectColor ?? colorByName,
                        ),
                      },
                    ]}>
                    <Text
                      style={[styles.chipText, { color: colors.onAccent }]}
                      numberOfLines={1}>
                      {group.subjectName}
                    </Text>
                  </View>
                  <Text
                    style={[styles.previewText, { color: colors.body }]}
                    numberOfLines={1}>
                    {titlePreviewLead(group.titles)}
                    {group.titles.length > 1 ? (
                      <Text style={[styles.countMuted, { color: colors.muted }]}>
                        {` 총 ${group.titles.length}개`}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 8,
  },
  titleRow: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
  },
  card: {
    paddingHorizontal: 8,
  },
  press: {
    borderRadius: radii.chip,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
    justifyContent: 'center',
  },
  empty: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    textAlign: 'center',
    width: '100%',
  },
  previewCol: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    minWidth: 52,
    maxWidth: 72,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
  },
  previewText: {
    flex: 1,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  countMuted: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    opacity: 0.72,
  },
});
