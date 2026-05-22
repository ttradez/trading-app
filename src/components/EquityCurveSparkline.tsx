import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Easing, StyleSheet, View, Text, PanResponder, GestureResponderEvent,
} from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Path, Line, Circle,
} from 'react-native-svg';

import NumericText from './NumericText';
import { EquityPoint } from '../lib/equitySeries';
import { chart, borders, surface } from '../theme';

/**
 * Equity-curve sparkline (CRAFT_RESEARCH chart pass). Gold line +
 * direction-tinted gradient fill + dashed baseline at the starting
 * balance. Stroke is ALWAYS gold — the underlying fill carries the
 * gain / loss colour signal so the equity line itself stays a
 * single brand colour at every state.
 *
 * Interactive mode (`interactive` prop, default true): touch the
 * chart to scrub a crosshair. The vertical line + dot snap to the
 * nearest data point (so the value always corresponds to a real
 * trade boundary). A floating value label sits above the dot,
 * and a date label sits just outside the chart's bottom edge.
 * Touch-end fades the crosshair over 200ms.
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
  /** Touch-to-scrub crosshair. Default true. Set false for purely
   *  decorative contexts. */
  interactive?: boolean;
  /** Format the crosshair's date label. Caller decides date-only vs
   *  date+time per timeframe. */
  formatTimestamp?: (t: number) => string;
}

const DEFAULT_H        = 70;
const DRAW_MS          = 800;
const FADE_OUT_MS      = 200;
const STROKE_WIDTH     = 2;
const VERTICAL_PADDING = 0.10; // 10% top/bottom breathing room
const DATE_LABEL_H     = 18;   // reserved space below chart for the date label
const VALUE_LABEL_H    = 24;   // tooltip height — used for clamping
const VALUE_LABEL_W    = 90;   // typical tooltip width — used for clamping

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function defaultFormatTimestamp(t: number): string {
  const d = new Date(t);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatEquityShort(eq: number): string {
  const rounded = Math.round(eq);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

export default function EquityCurveSparkline({
  data,
  startingBalance,
  width,
  height = DEFAULT_H,
  animateOnMount = true,
  interactive = true,
  formatTimestamp = defaultFormatTimestamp,
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
        xs: [] as number[],
        ys: [] as number[],
      };
    }
    const last = data[data.length - 1];
    const direction: 'gain' | 'loss' | 'flat' =
      last.equity > startingBalance ? 'gain'
      : last.equity < startingBalance ? 'loss'
      : 'flat';

    const n = data.length;
    const xOf = (i: number) =>
      n === 1 ? width / 2 : (i / (n - 1)) * width;

    const valuesForExtent = data.map((p) => p.equity).concat(startingBalance);
    const yMin = Math.min(...valuesForExtent);
    const yMax = Math.max(...valuesForExtent);
    const span = yMax - yMin || 1;
    const padded = span * (1 + VERTICAL_PADDING * 2);
    const yTop = yMax + span * VERTICAL_PADDING;
    const yOf = (eq: number) =>
      ((yTop - eq) / padded) * height;

    const xs: number[] = new Array(n);
    const ys: number[] = new Array(n);
    let linePath = '';
    let segLen = 0;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < n; i++) {
      const x = xOf(i);
      const y = yOf(data[i].equity);
      xs[i] = x;
      ys[i] = y;
      linePath += (i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
                          : ` L ${x.toFixed(2)} ${y.toFixed(2)}`);
      if (prev) segLen += Math.hypot(x - prev.x, y - prev.y);
      prev = { x, y };
    }

    const x0 = xOf(0);
    const xN = xOf(n - 1);
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
      xs,
      ys,
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

  // ── Crosshair state ─────────────────────────────────────────
  // `activeIdx` is the snapped data index; null = inactive. We
  // animate `crosshairOp` on touch-end so the crosshair fades out
  // instead of disappearing instantly.
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const crosshairOp = useRef(new Animated.Value(0)).current;
  const fadeOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findNearestIdx = (touchX: number): number => {
    // Geometry's xs[] is sorted ascending → binary search lands in
    // O(log n). For the typical 100-trade trace this is overkill but
    // free, and keeps the scrub smooth on long histories.
    const xs = geometry.xs;
    const n = xs.length;
    if (n === 0) return 0;
    if (touchX <= xs[0]) return 0;
    if (touchX >= xs[n - 1]) return n - 1;
    let lo = 0;
    let hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= touchX) lo = mid;
      else hi = mid;
    }
    // lo and hi bracket touchX. Pick the closer one.
    return touchX - xs[lo] <= xs[hi] - touchX ? lo : hi;
  };

  const onTouch = (evt: GestureResponderEvent) => {
    if (!hasData) return;
    const x = evt.nativeEvent.locationX;
    const idx = findNearestIdx(x);
    setActiveIdx(idx);
    // Cancel a pending fade-out — re-touching brings the crosshair
    // back instantly.
    if (fadeOutTimer.current) {
      clearTimeout(fadeOutTimer.current);
      fadeOutTimer.current = null;
    }
    crosshairOp.stopAnimation();
    crosshairOp.setValue(1);
  };

  const onTouchEnd = () => {
    if (!hasData) return;
    Animated.timing(crosshairOp, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    // After the fade completes, drop the index so SVG nodes unmount.
    // Re-touching before this fires clears the timer above.
    fadeOutTimer.current = setTimeout(() => {
      setActiveIdx(null);
      fadeOutTimer.current = null;
    }, FADE_OUT_MS);
  };

  const panResponder = useMemo(() => PanResponder.create({
    // Claim the touch early so the parent ScrollView doesn't grab
    // it when the user starts a horizontal scrub. Without
    // `onPanResponderTerminationRequest = false`, the ScrollView
    // can steal the gesture mid-pan and the crosshair vanishes.
    onStartShouldSetPanResponder: () => interactive && hasData,
    onMoveShouldSetPanResponder: () => interactive && hasData,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: onTouch,
    onPanResponderMove: onTouch,
    onPanResponderRelease: onTouchEnd,
    onPanResponderTerminate: onTouchEnd,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [interactive, hasData, geometry.xs]);

  useEffect(() => {
    return () => {
      if (fadeOutTimer.current) clearTimeout(fadeOutTimer.current);
    };
  }, []);

  // ── Empty state — dashed placeholder at y-center ────────────
  if (!hasData) {
    return (
      <View style={{ width: Math.max(0, width), height: height + DATE_LABEL_H }}>
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

  // Crosshair derived layout — clamped so the floating value label
  // never overflows the chart bounds.
  const idx = activeIdx;
  const dotX = idx != null ? geometry.xs[idx] : 0;
  const dotY = idx != null ? geometry.ys[idx] : 0;
  const point = idx != null ? data[idx] : null;
  const valueLabelLeft = Math.max(
    0,
    Math.min(width - VALUE_LABEL_W, dotX - VALUE_LABEL_W / 2),
  );
  // Position the tooltip above the dot; clamp to the top so it never
  // clips out of the chart area.
  const valueLabelTop = Math.max(0, dotY - VALUE_LABEL_H - 8);
  const dateLabelLeft = Math.max(
    0,
    Math.min(width - 80, dotX - 40),
  );

  return (
    <View
      style={{ width, height: height + DATE_LABEL_H }}
      {...(interactive ? panResponder.panHandlers : {})}
    >
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

        {/* Crosshair — only mounts when a scrub is active. The
            Animated.View around it carries the fade-out on
            touch-end. */}
        {idx != null && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: crosshairOp }]}
            pointerEvents="none"
          >
            <Svg width={width} height={height}>
              <Line
                x1={dotX}
                x2={dotX}
                y1={0}
                y2={height}
                stroke={chart.crosshair}
                strokeWidth={1}
              />
              <Circle
                cx={dotX}
                cy={dotY}
                r={4}
                fill={chart.equityStroke}
                stroke={chart.crosshair}
                strokeWidth={1.5}
              />
            </Svg>

            {/* Value tooltip — absolute-positioned over the SVG so
                it can carry real text (Svg doesn't let us border /
                shadow text natively). */}
            {point && (
              <View
                style={[
                  styles.valueLabel,
                  { left: valueLabelLeft, top: valueLabelTop },
                ]}
              >
                <NumericText bold style={styles.valueLabelText} allowFontScaling={false}>
                  {formatEquityShort(point.equity)}
                </NumericText>
              </View>
            )}
          </Animated.View>
        )}
      </View>

      {/* Date label — sits just outside the chart's bottom edge in
          the reserved DATE_LABEL_H gutter. Fades with the rest of
          the crosshair. */}
      {idx != null && point && (
        <Animated.View
          style={[
            styles.dateLabelWrap,
            { top: height, left: dateLabelLeft, opacity: crosshairOp },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.dateLabel} numberOfLines={1}>
            {formatTimestamp(point.t)}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  valueLabel: {
    position: 'absolute',
    width: VALUE_LABEL_W,
    height: VALUE_LABEL_H,
    backgroundColor: surface.l3,
    borderColor: borders.card,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dateLabelWrap: {
    position: 'absolute',
    width: 80,
    height: DATE_LABEL_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
