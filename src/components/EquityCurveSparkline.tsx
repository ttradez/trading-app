import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Path, Line,
} from 'react-native-svg';

import { EquityPoint } from '../lib/equitySeries';
import { chart } from '../theme';

/**
 * Equity-curve sparkline (CRAFT_RESEARCH chart pass). Gold line +
 * direction-tinted gradient fill + dashed baseline at the starting
 * balance. Stroke is ALWAYS gold — the underlying fill carries the
 * gain / loss colour signal so the equity line itself stays a
 * single brand colour at every state.
 *
 * Empty data → renders a horizontal dashed placeholder at y-center
 * (the parent doesn't need to branch).
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  data: EquityPoint[];
  startingBalance: number;
  width: number;
  height?: number;
  /** Skip the line-draw + fill-fade on first mount. Default true. */
  animateOnMount?: boolean;
}

const DEFAULT_H        = 70;
const DRAW_MS          = 800;
const STROKE_WIDTH     = 2;
const VERTICAL_PADDING = 0.10; // 10% top/bottom breathing room

export default function EquityCurveSparkline({
  data,
  startingBalance,
  width,
  height = DEFAULT_H,
  animateOnMount = true,
}: Props) {
  const hasData = data.length > 0 && width > 0;

  // ── Geometry (memoised; 0-cost when empty) ──────────────────
  const geometry = useMemo(() => {
    if (!hasData) {
      return {
        direction: 'flat' as const,
        linePath: '',
        areaPath: '',
        pathLen: 0,
        baselineY: height / 2,
      };
    }
    const last = data[data.length - 1];
    const direction: 'gain' | 'loss' | 'flat' =
      last.equity > startingBalance ? 'gain'
      : last.equity < startingBalance ? 'loss'
      : 'flat';

    // X scale: even spacing across data indices. Time-based scale
    // is over-engineering for a sparkline (no axis labels).
    const n = data.length;
    const xOf = (i: number) =>
      n === 1 ? width / 2 : (i / (n - 1)) * width;

    // Y scale: include startingBalance so the baseline always
    // sits inside the visible plot, with 10% padding top/bottom.
    const ys = data.map((p) => p.equity).concat(startingBalance);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const span = yMax - yMin || 1;
    const padded = span * (1 + VERTICAL_PADDING * 2);
    const yTop = yMax + span * VERTICAL_PADDING;
    const yOf = (eq: number) =>
      ((yTop - eq) / padded) * height;

    // Line path + length (for the stroke-dashoffset draw-in).
    let linePath = '';
    let segLen = 0;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < data.length; i++) {
      const x = xOf(i);
      const y = yOf(data[i].equity);
      linePath += (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
                          : ` L ${x.toFixed(2)} ${y.toFixed(2)}`);
      if (prev) segLen += Math.hypot(x - prev.x, y - prev.y);
      prev = { x, y };
    }

    // Area path = line then close down-right and along bottom and
    // back up to start.
    const x0 = xOf(0);
    const xN = xOf(data.length - 1);
    const areaPath =
      linePath +
      ` L ${xN.toFixed(2)} ${height}` +
      ` L ${x0.toFixed(2)} ${height} Z`;

    return {
      direction,
      linePath,
      areaPath,
      pathLen: segLen,
      baselineY: yOf(startingBalance),
    };
  }, [data, startingBalance, width, height, hasData]);

  // ── Animation: stroke-dash draw-in + area opacity fade ──────
  const dashOffset = useRef(new Animated.Value(0)).current;
  const areaOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasData) return;
    dashOffset.setValue(animateOnMount ? geometry.pathLen : 0);
    areaOpacity.setValue(animateOnMount ? 0 : 1);
    if (!animateOnMount) return;
    Animated.parallel([
      Animated.timing(dashOffset, {
        toValue: 0,
        duration: DRAW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(areaOpacity, {
        toValue: 1,
        duration: DRAW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [hasData, geometry.pathLen, animateOnMount, dashOffset, areaOpacity]);

  // ── Empty state — dashed placeholder at y-center ────────────
  if (!hasData) {
    return (
      <View style={{ width: Math.max(0, width), height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Line
              x1={0}
              x2={width}
              y1={height / 2}
              y2={height / 2}
              stroke={chart.referenceLine}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </Svg>
        )}
      </View>
    );
  }

  const fillTop = geometry.direction === 'loss'
    ? chart.lossFillTop : chart.gainFillTop;
  const fillBottom = geometry.direction === 'loss'
    ? chart.lossFillBottom : chart.gainFillBottom;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillTop} />
            <Stop offset="1" stopColor={fillBottom} />
          </LinearGradient>
        </Defs>

        {/* Reference baseline at startingBalance. */}
        <Line
          x1={0}
          x2={width}
          y1={geometry.baselineY}
          y2={geometry.baselineY}
          stroke={chart.referenceLine}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </Svg>

      {/* Direction-tinted area fill — its own SVG so we can fade
          it via an Animated.View wrapper without retriggering the
          baseline draw. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: areaOpacity }]}
        pointerEvents="none"
      >
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="eqAreaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={fillTop} />
              <Stop offset="1" stopColor={fillBottom} />
            </LinearGradient>
          </Defs>
          <Path d={geometry.areaPath} fill="url(#eqAreaFill)" />
        </Svg>
      </Animated.View>

      {/* Equity line — always gold. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <AnimatedPath
            d={geometry.linePath}
            stroke={chart.equityStroke}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${geometry.pathLen} ${geometry.pathLen}`}
            strokeDashoffset={dashOffset as unknown as number}
          />
        </Svg>
      </View>
    </View>
  );
}
