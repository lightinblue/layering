import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

export type ReviewDetailContentProps = {
  studies: HomeReviewStudy[];
  /** Card interval — shown as 「n일 전」 beside each study item. */
  intervalDays: number;
  /** Optional chip fills from current subject list. */
  colorByName?: Record<string, string>;
  /** Tap a study row → jump home week strip to that 학습일. */
  onStudyPress?: (studiedOn: string) => void;
};

type SubjectGroup = {
  subjectName: string;
  subjectColor?: string;
  items: HomeReviewStudy[];
};

function groupBySubject(
  studies: readonly HomeReviewStudy[],
): SubjectGroup[] {
  const order: string[] = [];
  const map = new Map<
    string,
    { subjectColor?: string; items: HomeReviewStudy[] }
  >();

  for (const study of studies) {
    const key = study.subjectName;
    const existing = map.get(key);
    if (!existing) {
      order.push(key);
      map.set(key, {
        ...(study.subjectColor ? { subjectColor: study.subjectColor } : {}),
        items: [study],
      });
      continue;
    }
    existing.items.push(study);
  }

  return order.map((name) => {
    const g = map.get(name)!;
    return {
      subjectName: name,
      ...(g.subjectColor ? { subjectColor: g.subjectColor } : {}),
      items: g.items,
    };
  });
}

/** 「복습 내용」 sheet — studies grouped by subject; 「n일 전」 per item. */
export function ReviewDetailContent({
  studies,
  intervalDays,
  colorByName,
  onStudyPress,
}: ReviewDetailContentProps) {
  const colors = useThemeColors();
  const groups = useMemo(() => groupBySubject(studies), [studies]);
  const agoLabel = `${intervalDays}일 전`;

  return (
    <ScrollView
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={[styles.body, { backgroundColor: colors.white }]}
      keyboardShouldPersistTaps="handled">
      {groups.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.bodyText, { color: colors.body }]}>
            연결된 공부 기록이 없어요
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <View
            key={group.subjectName}
            style={[styles.card, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.subjectChip,
                {
                  backgroundColor: subjectColor(
                    group.subjectName,
                    group.subjectColor ?? colorByName,
                  ),
                },
              ]}>
              <Text
                style={[styles.subjectChipText, { color: colors.onAccent }]}
                numberOfLines={1}>
                {group.subjectName}
              </Text>
            </View>

            <View style={styles.itemList}>
              {group.items.map((study, index) => {
                const canJump = Boolean(onStudyPress && study.studiedOn);
                const row = (
                  <View style={styles.itemRow}>
                    <Text
                      style={[styles.bullet, { color: colors.body }]}
                      accessible={false}>
                      •
                    </Text>
                    <Text
                      style={[styles.itemContent, { color: colors.body }]}
                      numberOfLines={3}>
                      {study.content}
                    </Text>
                    <Text
                      style={[styles.ago, { color: colors.muted }]}
                      numberOfLines={1}>
                      {agoLabel}
                    </Text>
                  </View>
                );

                if (canJump) {
                  return (
                    <Pressable
                      key={`${study.studyId ?? study.content}-${study.studiedOn}-${index}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${study.subjectName} ${study.content}, ${agoLabel}`}
                      accessibilityHint="시트를 닫고 홈 주간 날짜로 이동합니다"
                      onPress={() => onStudyPress?.(study.studiedOn)}
                      style={({ pressed }) => [
                        styles.itemPress,
                        pressed && styles.itemPressed,
                      ]}>
                      {row}
                    </Pressable>
                  );
                }

                return (
                  <View
                    key={`${study.studyId ?? study.content}-${study.studiedOn}-${index}`}
                    style={styles.itemPress}>
                    {row}
                  </View>
                );
              })}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: '100%',
  },
  body: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 14,
  },
  subjectChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectChipText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  card: {
    borderRadius: radii.chip,
    padding: 16,
    gap: 12,
  },
  itemList: {
    gap: 8,
  },
  itemPress: {
    borderRadius: 8,
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    lineHeight: 22,
    width: 12,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  ago: {
    fontFamily: fonts.nexonMedium,
    fontSize: 12,
    lineHeight: 22,
    flexShrink: 0,
  },
  bodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    lineHeight: 22,
  },
});
