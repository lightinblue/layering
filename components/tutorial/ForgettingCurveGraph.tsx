import { StyleSheet, View } from 'react-native';
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

const VB_W = 320;
const VB_H = 168;
const PAD = { l: 36, r: 12, t: 28, b: 30 } as const;
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

/** Map retention % + normalized time → SVG coords. */
function pt(t: number, retention: number) {
  return {
    x: PAD.l + t * PLOT_W,
    y: PAD.t + (1 - retention / 100) * PLOT_H,
  };
}

function M(t: number, r: number) {
  const p = pt(t, r);
  return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}

function L(t: number, r: number) {
  const p = pt(t, r);
  return `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
}

/** Quadratic segment — control at midpoint with given retention. */
function Q(tCtrl: number, rCtrl: number, tEnd: number, rEnd: number) {
  const c = pt(tCtrl, rCtrl);
  const e = pt(tEnd, rEnd);
  return `Q ${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

/** Review markers on a visually spaced timeline. */
const REVIEWS = [
  { t: 0.18, label: '10분', valley: 48 },
  { t: 0.4, label: '24시간', valley: 60 },
  { t: 0.62, label: '1주일', valley: 72 },
  { t: 0.82, label: '1달', valley: 84 },
] as const;

/**
 * No-review decay: steep drop toward the bottom.
 */
const NO_REVIEW_PATH = [
  M(0, 100),
  Q(0.12, 42, 0.28, 24),
  Q(0.5, 12, 0.72, 9),
  Q(0.88, 7, 1, 6),
].join(' ');

/**
 * Reviewed path: decay → sharp reset to 100% → flatter decay each time.
 */
function buildReviewedPath(): string {
  const parts: string[] = [M(0, 100)];
  let prevT = 0;
  for (const rev of REVIEWS) {
    const mid = (prevT + rev.t) / 2;
    // Soft decay into the valley just before the review.
    parts.push(Q(mid, rev.valley + 8, rev.t - 0.012, rev.valley));
    // Sharp reset toward 100%.
    parts.push(L(rev.t, 100));
    prevT = rev.t;
  }
  // After final review: flatter plateau + slight fade.
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
  const height = (width * VB_H) / VB_W;
  const lastReview = pt(REVIEWS[3].t, 100);
  const hintEnd = pt(0.97, 97);

  return (
    <View
      accessibilityLabel="망각곡선 그래프. 복습할수록 기억이 더 오래 남아요."
      style={[
        styles.wrap,
        {
          width,
          height,
          backgroundColor: colors.surface,
          borderRadius: radii.reviewCard,
        },
      ]}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <LinearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.16} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        <Path
          d={`M ${axisX0} ${PAD.t} L ${axisX0} ${axisY} L ${axisX1} ${axisY}`}
          stroke={colors.mutedLight}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path d={FILL_PATH} fill="url(#curveFill)" />

        <Path
          d={NO_REVIEW_PATH}
          stroke={colors.muted}
          strokeWidth={1.55}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <Path
          d={REVIEWED_PATH}
          stroke={colors.primary}
          strokeWidth={2.15}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {REVIEWS.map((r) => {
          const p = pt(r.t, 100);
          return (
            <Circle
              key={r.label}
              cx={p.x}
              cy={p.y}
              r={3.3}
              fill={colors.mainWhite}
              stroke={colors.primary}
              strokeWidth={1.7}
            />
          );
        })}

        <Path
          d={`M ${lastReview.x + 5} ${lastReview.y + 1} Q ${(lastReview.x + hintEnd.x) / 2} ${lastReview.y - 9}, ${hintEnd.x} ${hintEnd.y}`}
          stroke={colors.chipBlue}
          strokeWidth={1.25}
          fill="none"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />

        <SvgText
          x={PAD.l - 8}
          y={PAD.t + 2}
          fill={colors.sectionLabel}
          fontSize={9}
          fontFamily={fonts.nexonMedium}
          textAnchor="end">
          100
        </SvgText>
        <SvgText
          x={10}
          y={PAD.t + PLOT_H / 2 + 18}
          fill={colors.sectionLabel}
          fontSize={9}
          fontFamily={fonts.nexonRegular}
          transform={`rotate(-90, 10, ${PAD.t + PLOT_H / 2 + 18})`}>
          회상된 양
        </SvgText>
        <SvgText
          x={PAD.l + PLOT_W / 2}
          y={VB_H - 8}
          fill={colors.sectionLabel}
          fontSize={9}
          fontFamily={fonts.nexonRegular}
          textAnchor="middle">
          시간 경과
        </SvgText>

        {REVIEWS.map((r) => {
          const p = pt(r.t, 100);
          return (
            <SvgText
              key={`lbl-${r.label}`}
              x={p.x}
              y={PAD.t - 10}
              fill={colors.primary}
              fontSize={9}
              fontFamily={fonts.nexonMedium}
              textAnchor="middle">
              {r.label}
            </SvgText>
          );
        })}

        <SvgText
          x={pt(0.78, 16).x}
          y={pt(0.78, 16).y - 4}
          fill={colors.muted}
          fontSize={9}
          fontFamily={fonts.nexonRegular}
          textAnchor="middle">
          복습하지 않은 경우
        </SvgText>

        <SvgText
          x={hintEnd.x - 2}
          y={hintEnd.y - 6}
          fill={colors.chipBlue}
          fontSize={9}
          fontFamily={fonts.nexonMedium}
          textAnchor="end">
          가끔 복습
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
