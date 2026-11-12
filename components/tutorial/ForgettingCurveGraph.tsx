import { PixelRatio, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { fonts } from '@/constants/fonts';
import { radii } from '@/constants/tokens';
import { useThemeColors } from '@/theme/ThemeProvider';

/**
 * High internal resolution so strokes stay crisp when scaled to layout width.
 * Layout size stays ~332×174; viewBox is 2× for sharper paths on retina.
 */
const VB_W = 640;
const VB_H = 336;
const PAD = { l: 72, r: 28, t: 36, b: 56 } as const;
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

/** Map retention % + normalized time → SVG coords. */
function pt(t: number, retention: number) {
  return {
    x: PAD.l + t * PLOT_W,
    y: PAD.t + (1 - retention / 100) * PLOT_H,
  };
}

function fmt(n: number) {
  return n.toFixed(2);
}

function M(t: number, r: number) {
  const p = pt(t, r);
  return `M ${fmt(p.x)} ${fmt(p.y)}`;
}

function L(t: number, r: number) {
  const p = pt(t, r);
  return `L ${fmt(p.x)} ${fmt(p.y)}`;
}

/** Quadratic segment — control at midpoint with given retention. */
function Q(tCtrl: number, rCtrl: number, tEnd: number, rEnd: number) {
  const c = pt(tCtrl, rCtrl);
  const e = pt(tEnd, rEnd);
  return `Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(e.x)} ${fmt(e.y)}`;
}

/** Review resets on a visually spaced timeline (no time labels). */
const REVIEWS = [
  { t: 0.18, valley: 48 },
  { t: 0.4, valley: 60 },
  { t: 0.62, valley: 72 },
  { t: 0.82, valley: 84 },
] as const;

/** No-review decay: steep drop toward the bottom. */
const NO_REVIEW_PATH = [
  M(0, 100),
  Q(0.12, 42, 0.28, 24),
  Q(0.5, 12, 0.72, 9),
  Q(0.88, 7, 1, 6),
].join(' ');

/** Reviewed path: decay → sharp reset to 100% → flatter decay each time. */
function buildReviewedPath(): string {
  const parts: string[] = [M(0, 100)];
  let prevT = 0;
  for (const rev of REVIEWS) {
    const mid = (prevT + rev.t) / 2;
    parts.push(Q(mid, rev.valley + 8, rev.t - 0.012, rev.valley));
    parts.push(L(rev.t, 100));
    prevT = rev.t;
  }
  parts.push(Q(0.9, 93, 1, 90));
  return parts.join(' ');
}

const REVIEWED_PATH = buildReviewedPath();
const FILL_PATH = `${REVIEWED_PATH} ${L(1, 0)} ${L(0, 0)} Z`;

const axisY = PAD.t + PLOT_H;
const axisX0 = PAD.l;
const axisX1 = PAD.l + PLOT_W;

type ForgettingCurveGraphProps = {
  width?: number;
};

/**
 * Compact Ebbinghaus-style forgetting curve for the first tutorial page.
 * Inspired by textbook diagrams — not a pixel clone.
 */
export function ForgettingCurveGraph({
  width = 332,
}: ForgettingCurveGraphProps) {
  const colors = useThemeColors();
  // Snap layout to the device pixel grid so strokes don’t sit on half-pixels.
  const layoutW = PixelRatio.roundToNearestPixel(width);
  const layoutH = PixelRatio.roundToNearestPixel((layoutW * VB_H) / VB_W);

  return (
    <View
      accessibilityLabel="망각곡선 그래프. 복습할수록 기억이 더 오래 남아요."
      style={[
        styles.wrap,
        {
          width: layoutW,
          height: layoutH,
          backgroundColor: colors.surface,
          borderRadius: radii.reviewCard,
        },
      ]}>
      <Svg width={layoutW} height={layoutH} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.14} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Path
          d={`M ${axisX0} ${PAD.t} L ${axisX0} ${axisY} L ${axisX1} ${axisY}`}
          stroke={colors.mutedLight}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />

        <Path d={FILL_PATH} fill="url(#curveFill)" />

        <Path
          d={NO_REVIEW_PATH}
          stroke={colors.muted}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d={REVIEWED_PATH}
          stroke={colors.primary}
          strokeWidth={4.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {REVIEWS.map((r, i) => {
          const p = pt(r.t, 100);
          return (
            <Circle
              key={`peak-${i}`}
              cx={p.x}
              cy={p.y}
              r={7}
              fill={colors.mainWhite}
              stroke={colors.primary}
              strokeWidth={3.5}
            />
          );
        })}

        <SvgText
          x={PAD.l - 14}
          y={PAD.t + 6}
          fill={colors.sectionLabel}
          fontSize={18}
          fontFamily={fonts.nexonMedium}
          textAnchor="end">
          100
        </SvgText>
        <SvgText
          x={22}
          y={PAD.t + PLOT_H / 2 + 36}
          fill={colors.sectionLabel}
          fontSize={18}
          fontFamily={fonts.nexonRegular}
          transform={`rotate(-90, 22, ${PAD.t + PLOT_H / 2 + 36})`}>
          회상된 양
        </SvgText>
        <SvgText
          x={PAD.l + PLOT_W / 2}
          y={VB_H - 14}
          fill={colors.sectionLabel}
          fontSize={18}
          fontFamily={fonts.nexonRegular}
          textAnchor="middle">
          시간 경과
        </SvgText>

        <SvgText
          x={pt(0.78, 16).x}
          y={pt(0.78, 16).y - 10}
          fill={colors.muted}
          fontSize={17}
          fontFamily={fonts.nexonRegular}
          textAnchor="middle">
          복습하지 않은 경우
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
});
