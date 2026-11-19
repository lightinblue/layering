import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HomeReviewStudy } from '@/constants/home-types';
import { fonts } from '@/constants/fonts';
import { radii, subjectColor } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

export type ReviewDetailContentProps = {
  studies: HomeReviewStudy[];
  /** Optional chip fills from current subject list. */
  colorByName?: Record<string, string>;
  /** Tap a study card → jump home week strip to that 학습일. */
  onStudyPress?: (studiedOn: string) => void;
};

/** 「복습 내용」 sheet — that day’s study content for the selected reviews. */
export function ReviewDetailContent({
  studies,
  colorByName,
  onStudyPress,
}: ReviewDetailContentProps) {
  const colors = useThemeColors();

  return (
    <ScrollView
      bounces={false}
      style={styles.scroll}
      contentContainerStyle={[styles.body, { backgroundColor: colors.white }]}
      keyboardShouldPersistTaps="handled">
      {studies.length === 0 ? (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.bodyText, { color: colors.body }]}>
            연결된 공부 기록이 없어요
          </Text>
        </View>
      ) : (
        studies.map((study, index) => {
          const memo = study.memo?.trim();
          const canJump = Boolean(onStudyPress && study.studiedOn);
          const card = (
            <>
              <View
                style={[
                  styles.subjectChip,
                  {
                    backgroundColor: subjectColor(
                      study.subjectName,
                      colorByName,
                    ),
                  },
                ]}>
                <Text
                  style={[styles.subjectChipText, { color: colors.onAccent }]}
                  numberOfLines={1}>
                  {study.subjectName}
                </Text>
              </View>
              {study.studiedOn ? (
                <Text
                  style={[styles.studiedOn, { color: colors.accentText }]}
                  numberOfLines={1}>
                  학습일 {study.studiedOn}
                </Text>
              ) : null}
              <Text style={[styles.bodyText, { color: colors.body }]}>
                {study.content}
              </Text>
              {memo ? (
                <Text style={[styles.memo, { color: colors.muted }]}>{memo}</Text>
              ) : null}
            </>
          );

          if (canJump) {
            return (
              <Pressable
                key={`${study.subjectName}-${study.studiedOn}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${study.subjectName} 학습일로 이동`}
                accessibilityHint="시트를 닫고 홈 주간 날짜로 이동합니다"
                onPress={() => onStudyPress?.(study.studiedOn)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.surface },
                  pressed && styles.cardPressed,
                ]}>
                {card}
              </Pressable>
            );
          }

          return (
            <View
              key={`${study.subjectName}-${study.studiedOn}-${index}`}
              style={[styles.card, { backgroundColor: colors.surface }]}>
              {card}
            </View>
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
    gap: 14,
  },
  // Width follows label; padding tuned for a 3-char Hangul baseline.
  // Sheet-local radius (not radii.chip) so home study chips stay at 12.
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
    gap: 8,
  },
  cardPressed: {
    opacity: 0.88,
  },
  studiedOn: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  bodyText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  memo: {
    fontFamily: fonts.nexonRegular,
    fontSize: 13,
    lineHeight: 19,
  },
});
