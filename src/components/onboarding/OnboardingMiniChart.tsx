import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';

/**
 * OnboardingMiniChart — minimal candlestick visualization used only
 * in the first-trade screen.
 *
 * Why not reuse the production TradingChart?
 *  - That component is a WebView hosting lightweight-charts with
 *    deep coupling to `sessionStore`, `positions`, `currentPrice`,
 *    the replay mechanic, the backend `/session/*` endpoints, and a
 *    large set of UI affordances (timeframes, indicators, drawings,
 *    news, settings, BUY/SELL panel with TP/SL drag). Plumbing all
 *    of that for an onboarding-only flow — where we explicitly want
 *    a locked dataset, no backend dependency, and almost every UI
 *    affordance disabled — added more accidental complexity than
 *    inheriting the chart engine saved.
 *  - The chart will be replaced wholesale by TradingView Advanced
 *    Charts when the application is approved (PROJECT_CONTEXT.md),
 *    so any onboarding-specific plumbing on top of the current chart
 *    would be thrown away anyway.
 *  - The onboarding flow uses a hardcoded 33-bar dataset and a
 *    sliding window — pure SVG renders this in ~60 lines.
 */

export interface Candle { o: number; h: number; l: number; c: number; }

interface Props {
  /** Full candle array. The chart slices it to `[start..currentIndex]`
   *  internally based on a sliding window. */
  candles: Candle[];
  /** Index of the latest visible bar (inclusive). Bars after this are
   *  hidden — this is the replay cursor. */
  currentIndex: number;
  /** Horizontal price line drawn at this value, if set. */
  entryPrice?: number | null;
  /** Color hint for the entry line (buy = green, sell = red). */
  tradeAction?: 'buy' | 'sell' | null;
  /** Number of bars to show in the sliding window. Default 20. */
  windowSize?: number;
  /** Display height in px. */
  height?: number;
}

const GREEN = '#00D395';
const RED   = '#FF4757';
const PRICE_PADDING = 0.08; // 8% top/bottom whitespace inside the chart

export default function OnboardingMiniChart({
  candles,
  currentIndex,
  entryPrice,
  tradeAction,
  windowSize = 20,
  height = 320,
}: Props) {
  // Slide the window so the current bar always sits near the right edge.
  const end   = Math.max(currentIndex + 1, windowSize);
  const start = Math.max(0, end - windowSize);
  const visible = candles.slice(start, end);

  return (
    <View style={[styles.wrap, { height }]}>
      <ChartBody candles={visible} entryPrice={entryPrice} tradeAction={tradeAction} height={height} />
    </View>
  );
}

function ChartBody({
  candles, entryPrice, tradeAction, height,
}: { candles: Candle[]; entryPrice?: number | null; tradeAction?: 'buy' | 'sell' | null; height: number }) {
  // Use onLayout to derive actual width so this works in any flex layout.
  const [width, setWidth] = React.useState(0);

  // Y-axis range — include the entry price so the line stays in view.
  const allPrices = candles.flatMap((c) => [c.h, c.l]);
  if (entryPrice != null) allPrices.push(entryPrice);
  const minP = allPrices.length ? Math.min(...allPrices) : 0;
  const maxP = allPrices.length ? Math.max(...allPrices) : 1;
  const range = (maxP - minP) || 1;
  const minY = minP - range * PRICE_PADDING;
  const maxY = maxP + range * PRICE_PADDING;
  const fullRange = maxY - minY;

  const priceToY = (p: number) => height - ((p - minY) / fullRange) * height;

  const N = candles.length || 1;
  const barSlot = width / N;
  const bodyW = Math.max(barSlot * 0.65, 1.5);

  return (
    <View
      style={styles.svgWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* Candles */}
          {candles.map((c, i) => {
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
                <Line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth={1} />
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

          {/* Entry-price line — dashed, color matches trade direction. */}
          {entryPrice != null && (
            <Line
              x1={0}
              y1={priceToY(entryPrice)}
              x2={width}
              y2={priceToY(entryPrice)}
              stroke={tradeAction === 'buy' ? GREEN : RED}
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
    backgroundColor: '#000000',
  },
  svgWrap: {
    flex: 1,
  },
});
