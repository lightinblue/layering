import { MAX_SUBJECT_NAME_LENGTH, withSubjectColor } from '@/storage/app-data';
import { subjectColor } from '@/constants/tokens';
import type { AppData } from '@/types/domain';
import { todayKey } from '@/utils/date';
import {
  findDayInWeeks,
  homeScreenDataFromAppData,
} from '@/utils/home-from-app-data';

/** 포개 — 「오늘 할 복습」위젯 스냅샷 (study title 없음). */
export type TodayReviewWidgetSubject = {
  /** 풀 네임 ≤4자. */
  name: string;
  color: string;
  /** 극단 축소 시 폴백 (홈 칩과 동일: 첫 글자). */
  glyph: string;
};

export type TodayReviewWidgetItem = {
  id: string;
  intervalDays: number;
  completed: boolean;
  subjects: TodayReviewWidgetSubject[];
};

export type TodayReviewWidgetSnapshot = {
  updatedAt: string;
  todayKey: string;
  totalCount: number;
  remainingCount: number;
  items: TodayReviewWidgetItem[];
};

function subjectGlyph(name: string): string {
  return name.charAt(0) || '?';
}

function clampSubjectName(name: string): string {
  return name.trim().slice(0, MAX_SUBJECT_NAME_LENGTH);
}

/**
 * Resolve chip fill for a subject name: live chip → study snapshot → name map.
 */
function resolveSubjectColor(
  data: AppData,
  subjectName: string,
  studyColors: Map<string, string | undefined>,
): string {
  const chip = data.subjects.find((s) => s.name === subjectName);
  if (chip) {
    return withSubjectColor(chip).color ?? subjectColor(subjectName);
  }
  const snapped = studyColors.get(subjectName)?.trim();
  if (snapped) return snapped;
  return subjectColor(subjectName);
}

/**
 * Build a widget-ready snapshot from AppData for the device-local today.
 * Items follow home review card grouping (interval ascending); no study title.
 */
export function buildTodayReviewWidgetSnapshot(
  data: AppData,
  now = new Date(),
): TodayReviewWidgetSnapshot {
  const key = todayKey(now);
  const home = homeScreenDataFromAppData(data, now);
  const day = findDayInWeeks(home.weeks, key);
  const reviews = day?.reviews ?? [];

  const items: TodayReviewWidgetItem[] = reviews.map((card) => {
    const studyColors = new Map<string, string | undefined>();
    for (const study of card.studies) {
      if (!studyColors.has(study.subjectName)) {
        studyColors.set(study.subjectName, study.subjectColor);
      }
    }

    const subjects: TodayReviewWidgetSubject[] = card.subjectNames.map(
      (rawName) => {
        const name = clampSubjectName(rawName);
        return {
          name,
          color: resolveSubjectColor(data, rawName, studyColors),
          glyph: subjectGlyph(name),
        };
      },
    );

    return {
      id: card.id,
      intervalDays: card.intervalDays,
      completed: card.completed,
      subjects,
    };
  });

  const remainingCount = items.filter((item) => !item.completed).length;

  return {
    updatedAt: now.toISOString(),
    todayKey: key,
    totalCount: items.length,
    remainingCount,
    items,
  };
}
