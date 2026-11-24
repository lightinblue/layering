import { useMemo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

export type ReviewDetailContentProps = {
  studies: HomeReviewStudy[];
  /** Card interval — shown under the sheet title as 「n일 전」. */
  intervalDays: number;
  /** Optional chip fills from current subject list. */
  colorByName?: Record<string, string>;
  /** Tap a study row / gray surface → jump home week strip to that studiedOn. */
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

/** 「복습 내용」 sheet — header meta + subject-grouped bullets (Mac-parity). */
export function ReviewDetailContent({
  studies,
  intervalDays,
  colorByName,
  onStudyPress,
}: ReviewDetailContentProps) {
  const colors = useThemeColors();
  const groups = useMemo(() => groupBySubject(studies), [studies]);
  const agoLabel = `${intervalDays}일 전`;
  const studiedOn = useMemo(() => {
    const dates = [
      ...new Set(
        studies
          .map((s) => s.studiedOn?.trim())
          .filter((d): d is string => Boolean(d)),
      ),
    ];
    return dates[0] ?? '';
  }, [studies]);

  return (
    <ScrollView
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={[styles.body, { backgroundColor: colors.white }]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.body }]}>복습 내용</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.ago, { color: colors.muted }]}>{agoLabel}</Text>
          {studiedOn ? (
            <Text style={[styles.studiedOn, { color: colors.accentText }]}>
              {studiedOn}
            </Text>
          ) : null}
        </View>
      </View>

      {groups.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.bodyText, { color: colors.body }]}>
            연결된 공부 기록이 없어요
          </Text>
        </View>
      ) : (
        groups.map((group) => {
          const groupDate =
            group.items.find((s) => s.studiedOn?.trim())?.studiedOn?.trim() ??
            '';
          const canJumpGroup = Boolean(onStudyPress && groupDate);
          const cardStyle: StyleProp<ViewStyle> = [
            styles.card,
            { backgroundColor: colors.surface },
          ];

          const cardInner: ReactNode = (
            <>
              <Pressable
                disabled={!canJumpGroup}
                accessibilityRole={canJumpGroup ? 'button' : undefined}
                accessibilityLabel={group.subjectName}
                accessibilityHint="시트를 닫고 홈 주간 날짜로 이동합니다"
                onPress={() => {
                  if (groupDate) onStudyPress?.(groupDate);
                }}
                style={({ pressed }) => [
                  styles.subjectChip,
                  {
                    backgroundColor: subjectColor(
                      group.subjectName,
                      group.subjectColor ?? colorByName,
                    ),
                  },
                  pressed && canJumpGroup && styles.pressed,
                ]}>
                <Text
                  style={[styles.subjectChipText, { color: colors.onAccent }]}
                  numberOfLines={1}>
                  {group.subjectName}
                </Text>
              </Pressable>

              <View style={styles.itemList}>
                {group.items.map((study, index) => {
                  const rowDate = study.studiedOn?.trim() ?? '';
                  const canJump = Boolean(onStudyPress && rowDate);
                  const row = (
                    <View style={styles.itemRow} pointerEvents="none">
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
                    </View>
                  );

                  if (canJump) {
                    return (
                      <Pressable
                        key={`${study.studyId ?? study.content}-${study.studiedOn}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`${study.subjectName} ${study.content}`}
                        accessibilityHint="시트를 닫고 홈 주간 날짜로 이동합니다"
                        onPress={() => onStudyPress?.(rowDate)}
                        style={({ pressed }) => [
                          styles.itemPress,
                          pressed && styles.pressed,
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
            </>
          );

          // RN-web maps Pressable → <button>; nesting chip/row Pressables
          // inside a card Pressable throws hydration / nested-button errors.
          // Web: View shell; native: keep whole-card Pressable.
          if (Platform.OS === 'web') {
            return (
              <View key={group.subjectName} style={cardStyle}>
                {cardInner}
              </View>
            );
          }

          return (
            <Pressable
              key={group.subjectName}
              disabled={!canJumpGroup}
              accessibilityRole={canJumpGroup ? 'button' : undefined}
              accessibilityLabel={
                canJumpGroup
                  ? `${group.subjectName} 학습일로 이동`
                  : undefined
              }
              onPress={() => {
                if (groupDate) onStudyPress?.(groupDate);
              }}
              style={({ pressed }) => [
                cardStyle,
                pressed && canJumpGroup && styles.pressed,
              ]}>
              {cardInner}
            </Pressable>
          );
        })
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
    gap: 12,
  },
  header: {
    gap: 6,
    paddingBottom: 2,
  },
  title: {
    fontFamily: fonts.nexonMedium,
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  ago: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  studiedOn: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  itemList: {
    gap: 2,
    alignSelf: 'stretch',
  },
  itemPress: {
    alignSelf: 'stretch',
    width: '100%',
    paddingVertical: 2,
    borderRadius: 6,
  },
  pressed: {
    opacity: 0.88,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  bullet: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    lineHeight: 20,
    width: 12,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  bodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});
