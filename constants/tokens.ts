/** Design tokens from Figma Home (zgjHZrcERnHvzlG6cfxE0Y). */

export const colors = {
  mainWhite: '#fafafa',
  white: '#ffffff',
  black: '#000000',
  primary: '#1991ff',
  primarySoft: '#dff0ff',
  surface: '#f2f6fa',
  muted: '#9fb1c1',
  mutedLight: '#ced7e0',
  sectionLabel: '#808080',
  body: '#526477',
  bodyAlt: '#646464',
  accentText: '#708aa2',
  chipBlue: '#62b3f6',
  chipGreen: '#45c775',
  chipGray: '#a0a0a0',
  fabShadow: 'rgba(52, 61, 75, 0.16)',
} as const;

export const spacing = {
  weekGap: 1,
  sectionGap: 28,
  /** Gap between topBlock and sections (and other frame siblings). */
  blockGap: 18,
  /** Gap between date header and week strip (tighter than blockGap). */
  headerWeekGap: 10,
  studyRowGap: 7,
  reviewGap: 10,
  labelPad: 8,
  contentWidth: 332,
  headerWidth: 345,
  frameWidth: 356,
} as const;

export const radii = {
  weekDay: 14,
  chip: 12,
  reviewCard: 12,
  reviewChip: 6,
  checkbox: 9,
  fab: 14,
} as const;

export const sizes = {
  dayNumber: 80,
  ellipse: 24,
  weekCell: { width: 50, height: 58 },
  studyChip: { width: 77, height: 49 },
  studyBodyHeight: 49,
  reviewCheckbox: 38,
  /** Review subject marker: 24×24 color square with first glyph. */
  reviewChip: { width: 24, height: 24 },
  fab: 57,
  fabIcon: 28,
  addStudyHeight: 66,
  checkIcon: 23.587,
  arrow: 14,
  plus: 19.2,
} as const;

/** Subject chip color map used in Figma mocks. */
export const SUBJECT_COLORS: Record<string, string> = {
  분류: colors.chipBlue,
  교육학: colors.chipGreen,
  정검: colors.chipGray,
};

export function subjectColor(name: string): string {
  return SUBJECT_COLORS[name] ?? colors.chipGray;
}
