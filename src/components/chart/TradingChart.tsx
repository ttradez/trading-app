import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { SessionCandle, SessionPosition } from '../../store/sessionStore';

interface Props {
  candles: SessionCandle[];
  positions: SessionPosition[];
  currentPrice: number;
}

function buildHTML(candles: SessionCandle[], positions: SessionPosition[]): string {
  const seriesData = JSON.stringify(
    candles.map((c) => ({
      time: c.bar,      // bar index — no real date leaks to client
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  );

  const priceLines = JSON.stringify(
    positions.flatMap((p) => {
      const lines = [
        { price: p.entry_price, color: '#58a6ff', title: `Entry (${p.side.toUpperCase()})`, style: 0 },
      ];
      if (p.stop_loss)
        lines.push({ price: p.stop_loss,   color: '#f85149', title: 'SL', style: 2 });
      if (p.take_profit)
        lines.push({ price: p.take_profit, color: '#3fb950', title: 'TP', style: 2 });
      return lines;
    })
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0d1117; overflow: hidden; }
  #chart { width: 100vw; height: 100vh; }
</style>
</head>
<body>
<div id="chart"></div>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<script>
  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    width: window.innerWidth,
    height: window.innerHeight,
    layout: { background: { color: '#0d1117' }, textColor: '#c9d1d9' },
    grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#30363d' },
    timeScale: {
      borderColor: '#30363d',
      tickMarkFormatter: (time) => 'Bar ' + time,
    },
  });

  const series = chart.addCandlestickSeries({
    upColor:      '#3fb950',
    downColor:    '#f85149',
    borderVisible: false,
    wickUpColor:   '#3fb950',
    wickDownColor: '#f85149',
  });

  series.setData(${seriesData});
  chart.timeScale().fitContent();

  const priceLines = ${priceLines};
  priceLines.forEach(({ price, color, title, style }) => {
    series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title });
  });

  window.addEventListener('resize', () => {
    chart.resize(window.innerWidth, window.innerHeight);
  });

  // Receive new candles from React Native
  window.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'append') {
        msg.candles.forEach((c) => series.update(c));
        chart.timeScale().scrollToRealTime();
      }
      if (msg.type === 'pricelines') {
        // rebuild price lines
        series.setData(series.data()); // no-op, lines already added above
      }
    } catch {}
  });
</script>
</body>
</html>`;
}

export default function TradingChart({ candles, positions, currentPrice }: Props) {
  const webviewRef = useRef<WebView>(null);
  const prevCandleCount = useRef(candles.length);

  useEffect(() => {
    if (!webviewRef.current) return;
    const newCount = candles.length;
    if (newCount > prevCandleCount.current) {
      const newCandles = candles.slice(prevCandleCount.current).map((c) => ({
        time: c.bar,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      webviewRef.current.postMessage(JSON.stringify({ type: 'append', candles: newCandles }));
      prevCandleCount.current = newCount;
    }
  }, [candles.length]);

  const html = buildHTML(candles, positions);

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  webview: { flex: 1 },
});
