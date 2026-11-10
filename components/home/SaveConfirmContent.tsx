import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SuccessCheckIcon } from '@/components/icons/HomeIcons';
import { fonts } from '@/constants/fonts';
import { radii } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';
import { scheduleDateLabel } from '@/utils/date';
import { buildReviewDueDates } from '@/utils/review-schedule';

export type SaveConfirmPayload = {
  subject: string;
  content: string;
  studiedOn: string;
};

type SaveConfirmContentProps = {
  payload: SaveConfirmPayload;
  onConfirm: () => void;
};

/**
 * Post-save success body: check + summary + generated review schedule.
 * Mounted inside BottomSheetModal after 「공부 기록 추가」.
 */
export function SaveConfirmContent({
  payload,
  onConfirm,
}: SaveConfirmContentProps) {
  const colors = useThemeColors();
  const schedule = buildReviewDueDates(payload.studiedOn);
  const studyYear = Number(payload.studiedOn.slice(0, 4));
  const studied = scheduleDateLabel(payload.studiedOn);

  return (
    <View style={[styles.root, { backgroundColor: colors.white }]}>
      <View style={styles.header}>
        <SuccessCheckIcon color={colors.primary} />
        <Text style={[styles.headline, { color: colors.black }]}>
          저장됐어요
        </Text>
      </View>

      <View style={[styles.summary, { backgroundColor: colors.surface }]}>
        <Text style={[styles.summaryMeta, { color: colors.sectionLabel }]}>
          {payload.subject} · {studied} 학습
        </Text>
        <Text
          style={[styles.summaryTitle, { color: colors.black }]}
          numberOfLines={2}>
          {payload.content}
        </Text>
      </View>

      <View style={styles.scheduleBlock}>
        <Text style={[styles.scheduleLabel, { color: colors.black }]}>
          복습 일정
        </Text>
        <View style={styles.scheduleList}>
          {schedule.map((row, index) => {
            const isLast = index === schedule.length - 1;
            return (
              <View
                key={row.intervalDays}
                style={[
                  styles.scheduleRow,
                  !isLast && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.mutedLight,
                  },
                ]}>
                <Text style={[styles.interval, { color: colors.black }]}>
                  +{row.intervalDays}일
                </Text>
                <Text style={[styles.dueDate, { color: colors.body }]}>
                  {scheduleDateLabel(row.dueOn, studyYear)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="확인"
        onPress={onConfirm}
        style={[styles.confirmBtn, { backgroundColor: colors.primary }]}>
        <Text style={styles.confirmText}>확인</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headline: {
    fontFamily: fonts.nexonBold,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  summary: {
    borderRadius: radii.chip,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  summaryMeta: {
    fontFamily: fonts.nexonMedium,
    fontSize: 13,
  },
  summaryTitle: {
    fontFamily: fonts.nexonBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  scheduleBlock: {
    gap: 10,
  },
  scheduleLabel: {
    fontFamily: fonts.nexonBold,
    fontSize: 14,
  },
  scheduleList: {
    width: '100%',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  interval: {
    fontFamily: fonts.nexonBold,
    fontSize: 15,
  },
  dueDate: {
    fontFamily: fonts.nexonMedium,
    fontSize: 14,
  },
  confirmBtn: {
    marginTop: 4,
    height: 52,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontFamily: fonts.nexonMedium,
    fontSize: 16,
    color: '#ffffff',
  },
});
