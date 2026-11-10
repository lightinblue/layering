import Svg, { Circle, Path } from 'react-native-svg';

import { colors, sizes } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

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

/** Chevron for 「자세히」. */
export function ArrowRightIcon({ size = sizes.arrow }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.20402 11.0419C4.98533 10.8232 4.98533 10.4686 5.20402 10.25L8.45387 7.0001L5.20402 3.75024C4.98533 3.53155 4.98533 3.17698 5.20402 2.95828C5.42271 2.73959 5.77729 2.73959 5.99598 2.95828L9.64181 6.60412C9.86051 6.82281 9.86051 7.17738 9.64181 7.39608L5.99598 11.0419C5.77729 11.2606 5.42271 11.2606 5.20402 11.0419Z"
        fill={colors.muted}
      />
    </Svg>
  );
}

/** Calendar FAB icon. */
export function CalendarIcon({ size = sizes.fabIcon }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M8.23846 24.5H19.7615C21.9953 24.5 23.1121 24.5 23.8061 23.8061C24.5 23.1121 24.5 21.9953 24.5 19.7615V11.7385C24.5 9.50473 24.5 8.38786 23.8061 7.69393C23.1121 7 21.9953 7 19.7615 7H8.23846C6.00473 7 4.88786 7 4.19393 7.69393C3.5 8.38786 3.5 9.50473 3.5 11.7385V19.7615C3.5 21.9953 3.5 23.1121 4.19393 23.8061C4.88786 24.5 6.00473 24.5 8.23846 24.5Z"
        stroke={colors.accentText}
        strokeWidth={2.36923}
      />
      <Path
        d="M4.66658 12.8337H23.3332"
        stroke={colors.accentText}
        strokeWidth={2.36923}
        strokeLinecap="round"
      />
      <Path
        d="M10.5 18.6674H17.5"
        stroke={colors.accentText}
        strokeWidth={2.36923}
        strokeLinecap="round"
      />
      <Path
        d="M9.33329 3.5L9.33329 8.16667"
        stroke={colors.accentText}
        strokeWidth={2.36923}
        strokeLinecap="round"
      />
      <Path
        d="M18.6666 3.5L18.6666 8.16667"
        stroke={colors.accentText}
        strokeWidth={2.36923}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Settings FAB icon — same visual weight as CalendarIcon. */
export function SettingsIcon({ size = sizes.fabIcon }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path
        d="M14.257 2.333h-.514a2.333 2.333 0 0 0-2.333 2.334v.21a2.333 2.333 0 0 1-1.167 2.018l-.502.292a2.333 2.333 0 0 1-2.333 0l-.175-.093a2.333 2.333 0 0 0-3.185.852l-.257.443a2.333 2.333 0 0 0 .852 3.185l.175.117a2.333 2.333 0 0 1 1.167 2.007v.595a2.333 2.333 0 0 1-1.167 2.03l-.175.105a2.333 2.333 0 0 0-.852 3.185l.257.443a2.333 2.333 0 0 0 3.185.852l.175-.093a2.333 2.333 0 0 1 2.333 0l.502.292a2.333 2.333 0 0 1 1.167 2.018v.21a2.333 2.333 0 0 0 2.333 2.333h.514a2.333 2.333 0 0 0 2.333-2.333v-.21a2.333 2.333 0 0 1 1.167-2.018l.502-.292a2.333 2.333 0 0 1 2.333 0l.175.093a2.333 2.333 0 0 0 3.185-.852l.257-.455a2.333 2.333 0 0 0-.852-3.185l-.175-.093a2.333 2.333 0 0 1-1.167-2.03v-.583a2.333 2.333 0 0 1 1.167-2.03l.175-.105a2.333 2.333 0 0 0 .852-3.185l-.257-.443a2.333 2.333 0 0 0-3.185-.852l-.175.093a2.333 2.333 0 0 1-2.333 0l-.502-.292a2.333 2.333 0 0 1-1.167-2.018v-.21a2.333 2.333 0 0 0-2.333-2.334Z"
        stroke={colors.accentText}
        strokeWidth={2.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="14"
        cy="14"
        r="3.5"
        stroke={colors.accentText}
        strokeWidth={2.1}
      />
    </Svg>
  );
}

/** Plus for empty-state add study CTA. */
export function PlusIcon({ size = sizes.plus }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 19.2 19.2" fill="none">
      <Path
        d="M9.6 1.6C9.9031 1.6 10.1943 1.72063 10.4086 1.93496C10.6227 2.14919 10.7425 2.43972 10.7426 2.74258V8.45742H16.4574C16.7603 8.4575 17.0508 8.57733 17.265 8.79141C17.4794 9.00573 17.6 9.2969 17.6 9.6C17.6 9.90303 17.4793 10.1933 17.265 10.4076C17.0508 10.6219 16.7604 10.7425 16.4574 10.7426H10.7426V16.4574C10.7425 16.7603 10.6227 17.0508 10.4086 17.265C10.1943 17.4794 9.9031 17.6 9.6 17.6C9.29697 17.6 9.00668 17.4793 8.79238 17.265C8.57812 17.0508 8.4575 16.7604 8.45742 16.4574V10.7426H2.74258C2.43957 10.7425 2.14922 10.6219 1.93496 10.4076C1.72071 10.1933 1.60003 9.90303 1.6 9.6C1.6 9.2969 1.72063 9.00573 1.93496 8.79141C2.14919 8.57733 2.43971 8.4575 2.74258 8.45742H8.45742V2.74258C8.4575 2.43957 8.57812 2.14922 8.79238 1.93496C9.00668 1.72071 9.29697 1.60002 9.6 1.6Z"
        fill={colors.accentText}
      />
    </Svg>
  );
}
