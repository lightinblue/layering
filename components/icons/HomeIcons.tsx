import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { sizes } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

/** Shared FAB icon stroke — keeps calendar + settings visually matched. */
const FAB_ICON_STROKE = 2.1;

/** Accent ellipse next to day number (Figma Ellipse 27). */
export function EllipseIcon({
  size = sizes.ellipse,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const theme = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Circle cx="14" cy="14" r="14" fill={color ?? theme.primary} />
    </Svg>
  );
}

/** White check mark inside review checkbox. */
export function CheckIcon({
  size = sizes.checkIcon,
}: {
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 23.5872 23.5872" fill="none">
      <Path
        d="M19.9016 6.63443L9.58224 16.9534L4.42254 11.7941"
        stroke="white"
        strokeWidth={2.90304}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Soft checkmark (no box) for study-day todo — color via `color`. */
export function SoftCheckIcon({
  size = 18,
  color,
  strokeWidth = 2.2,
}: {
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 12.5L10 17.5L19 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Chevron for 「자세히」 (mirror with scaleX: -1 for left). */
export function ArrowRightIcon({
  size = sizes.arrow,
  color,
}: {
  size?: number;
  color?: string;
}) {
  const theme = useThemeColors();
  const fill = color ?? theme.muted;
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.20402 11.0419C4.98533 10.8232 4.98533 10.4686 5.20402 10.25L8.45387 7.0001L5.20402 3.75024C4.98533 3.53155 4.98533 3.17698 5.20402 2.95828C5.42271 2.73959 5.77729 2.73959 5.99598 2.95828L9.64181 6.60412C9.86051 6.82281 9.86051 7.17738 9.64181 7.39608L5.99598 11.0419C5.77729 11.2606 5.42271 11.2606 5.20402 11.0419Z"
        fill={fill}
      />
    </Svg>
  );
}

/** Calendar FAB icon — same stroke weight/size as SettingsIcon. */
export function CalendarIcon({ size = sizes.fabIcon }: { size?: number }) {
  const theme = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Rect
        x="4.5"
        y="7.5"
        width="19"
        height="16"
        rx="3"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4.5 12.5h19"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M10 4.5v5"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M18 4.5v5"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Settings FAB icon — same visual weight as CalendarIcon. */
export function SettingsIcon({ size = sizes.fabIcon }: { size?: number }) {
  const theme = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M14.257 2.333h-.514a2.333 2.333 0 0 0-2.333 2.334v.21a2.333 2.333 0 0 1-1.167 2.018l-.502.292a2.333 2.333 0 0 1-2.333 0l-.175-.093a2.333 2.333 0 0 0-3.185.852l-.257.443a2.333 2.333 0 0 0 .852 3.185l.175.117a2.333 2.333 0 0 1 1.167 2.007v.595a2.333 2.333 0 0 1-1.167 2.03l-.175.105a2.333 2.333 0 0 0-.852 3.185l.257.443a2.333 2.333 0 0 0 3.185.852l.175-.093a2.333 2.333 0 0 1 2.333 0l.502.292a2.333 2.333 0 0 1 1.167 2.018v.21a2.333 2.333 0 0 0 2.333 2.333h.514a2.333 2.333 0 0 0 2.333-2.333v-.21a2.333 2.333 0 0 1 1.167-2.018l.502-.292a2.333 2.333 0 0 1 2.333 0l.175.093a2.333 2.333 0 0 0 3.185-.852l.257-.455a2.333 2.333 0 0 0-.852-3.185l-.175-.093a2.333 2.333 0 0 1-1.167-2.03v-.583a2.333 2.333 0 0 1 1.167-2.03l.175-.105a2.333 2.333 0 0 0 .852-3.185l-.257-.443a2.333 2.333 0 0 0-3.185-.852l-.175.093a2.333 2.333 0 0 1-2.333 0l-.502-.292a2.333 2.333 0 0 1-1.167-2.018v-.21a2.333 2.333 0 0 0-2.333-2.334Z"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="14"
        cy="14"
        r="3.5"
        stroke={theme.accentText}
        strokeWidth={FAB_ICON_STROKE}
      />
    </Svg>
  );
}

/** Plus for empty-state add study CTA. */
export function PlusIcon({ size = sizes.plus }: { size?: number }) {
  const theme = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 19.2 19.2" fill="none">
      <Path
        d="M9.6 1.6C9.9031 1.6 10.1943 1.72063 10.4086 1.93496C10.6227 2.14919 10.7425 2.43972 10.7426 2.74258V8.45742H16.4574C16.7603 8.4575 17.0508 8.57733 17.265 8.79141C17.4794 9.00573 17.6 9.2969 17.6 9.6C17.6 9.90303 17.4793 10.1933 17.265 10.4076C17.0508 10.6219 16.7604 10.7425 16.4574 10.7426H10.7426V16.4574C10.7425 16.7603 10.6227 17.0508 10.4086 17.265C10.1943 17.4794 9.9031 17.6 9.6 17.6C9.29697 17.6 9.00668 17.4793 8.79238 17.265C8.57812 17.0508 8.4575 16.7604 8.45742 16.4574V10.7426H2.74258C2.43957 10.7425 2.14922 10.6219 1.93496 10.4076C1.72071 10.1933 1.60003 9.90303 1.6 9.6C1.6 9.2969 1.72063 9.00573 1.93496 8.79141C2.14919 8.57733 2.43971 8.4575 2.74258 8.45742H8.45742V2.74258C8.4575 2.43957 8.57812 2.14922 8.79238 1.93496C9.00668 1.72071 9.29697 1.60002 9.6 1.6Z"
        fill={theme.accentText}
      />
    </Svg>
  );
}

/** Soft-end plus for subject add chip — rounded caps, medium stroke. */
export function SoftPlusIcon({
  size = 16,
  color,
  strokeWidth = 2,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const theme = useThemeColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 3v10M3 8h10"
        stroke={color ?? theme.muted}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
