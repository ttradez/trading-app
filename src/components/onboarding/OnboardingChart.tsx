import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { OhlcBar } from '../../data/firstTradeScenario';

/**
 * OnboardingChart — dedicated SVG candlestick used ONLY by the screen-9
 * First Trade activation event. Static render, no touch handling, no
 * indicators, no drawings, no backend round-trip. Pure
 * `react-native-svg` (already in the project — no new deps).
 *
 * Why a dedicated component instead of the main app's TradingChart:
 *  - TradingChart is a WebView host for lightweight-charts with deep
 *    coupling to `sessionStore` / `positions` / `currentPrice` /
 *    backend session endpoints. The earlier audit traced the
 *    "Cannot read property 'c' of undefined" screen-9 crash to that
 *    plumbing reaching for bar data the onboarding flow didn't have.
 *  - The activation event needs to be offline-resilient and bounded.
 *    A simple SVG renderer with a clamped reveal counter makes
 *    out-of-bounds access structurally impossible.
 *  - TradingChart will be replaced wholesale by TradingView Advanced
 *    Charts once the application is approved; any onboarding-mode
 *    plumbing on top of it would be thrown away.
 */

interface Props {
  /** Full candle dataset. Caller passes the entire array; chart
   *  decides what's visible based on `revealedCount`. */
  bars: OhlcBar[];
  /** Number of bars (from index 0) currently visible. The chart slices
   *  `bars` defensively — values <= 0 render nothing, values >
   *  `bars.length` are clamped to `bars.length`. */
  revealedCount: number;
  /** Horizontal price line drawn at this value, if set. Used to mark
   *  the user's entry on screen-9 state C. */
  entryPrice?: number | null;
  /** Color hint for the entry line — caller passes a direction-tinted
   *  color (e.g. green for BUY, red for SELL). */
  entryColor?: string;
  /** Sliding-window size — how many bars fit on screen at once.
   *  Default 20. The right edge of the window stays pinned to the
   *  latest revealed bar so newly-revealed bars appear at the right. */
  windowSize?: number;
  /** Display height in px. Default 320. */
  height?: number;
}

const GREEN = '#00D395';
const RED   = '#FF4757';
const BG    = '#000000';

/** 8% top/bottom whitespace inside the chart so candles don't kiss
 *  the edges. */
const PRICE_PADDING = 0.08;

export default function OnboardingChart({
  bars,
  revealedCount,
  entryPrice = null,
  entryColor = GREEN,
  windowSize = 20,
  height = 320,
}: Props) {
  // Defensive clamping — out-of-range `revealedCount` becomes a no-op
  // instead of a crash.
  const safeCount = Math.max(0, Math.min(revealedCount, bars.length));
  const end = safeCount;
  const start = Math.max(0, end - windowSize);
  const visible = bars.slice(start, end);

  return (
    <View style={[styles.wrap, { height }]}>
      <ChartBody
        bars={visible}
        entryPrice={entryPrice}
        entryColor={entryColor}
        height={height}
      />
    </View>
  );
}

interface BodyProps {
  bars: OhlcBar[];
  entryPrice: number | null;
  entryColor: string;
  height: number;
}

function ChartBody({ bars, entryPrice, entryColor, height }: BodyProps) {
  // `onLayout` gives us the actual pixel width so this works in any
  // flex layout without a hard-coded screen width.
  const [width, setWidth] = useState(0);

  // Y-axis range. Include `entryPrice` so the line stays in view even
  // if the visible bars trend past it.
  const prices = bars.flatMap((c) => [c.h, c.l]);
  if (entryPrice != null) prices.push(entryPrice);
  const minP = prices.length ? Math.min(...prices) : 0;
  const maxP = prices.length ? Math.max(...prices) : 1;
  const range = (maxP - minP) || 1;
  const minY = minP - range * PRICE_PADDING;
  const maxY = maxP + range * PRICE_PADDING;
  const fullRange = maxY - minY;

  const priceToY = (p: number) => height - ((p - minY) / fullRange) * height;

  const N = bars.length || 1;
  const barSlot = width / N;
  const bodyW = Math.max(barSlot * 0.65, 1.5);

  return (
    <View
      style={styles.svgWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {bars.map((c, i) => {
            const cx = i * barSlot + barSlot / 2;
            const bull = c.c >= c.o;
            const color = bull ? GREEN : RED;
            const yHigh  = priceToY(c.h);
            const yLow   = priceToY(c.l);
            const yOpen  = priceToY(c.o);
            const yClose = priceToY(c.c);
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(Math.abs(yOpen - yClose), 1);
            return (
              <React.Fragment key={i}>
                <Line
                  x1={cx} y1={yHigh}
                  x2={cx} y2={yLow}
                  stroke={color} strokeWidth={1}
                />
                <Rect
                  x={cx - bodyW / 2}
                  y={bodyTop}
                  width={bodyW}
                  height={bodyH}
                  fill={color}
                />
              </React.Fragment>
            );
          })}

          {/* Entry-price line — dashed, direction-tinted. */}
          {entryPrice != null && (
            <Line
              x1={0}
              y1={priceToY(entryPrice)}
              x2={width}
              y2={priceToY(entryPrice)}
              stroke={entryColor}
              strokeWidth={1.5}
              strokeDasharray="6,4"
            />
          )}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: BG,
  },
  svgWrap: {
    flex: 1,
  },
});
