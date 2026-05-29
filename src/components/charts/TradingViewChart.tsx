import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme';
import { CHART_BACKEND_URL } from '../../config/chartBackend';

/**
 * One OHLCV bar in the shape `window.pushBar(bar)` expects on the
 * hosted chart. `time` is **milliseconds** (TV's `activeOnTick`
 * convention) — the parent multiplies the advance API's unix-seconds
 * `time` by 1000 before calling `pushBar`.
 */
export interface ChartBar {
  time: number; // ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Imperative handle the parent (ChartScreen) drives via a ref to
 * append newly-revealed replay candles to the live chart.
 */
export interface TradingViewChartHandle {
  pushBar: (bar: ChartBar) => void;
  /**
   * Refresh the chart IN PLACE after an in-session /timeframe switch. Invokes
   * the hosted page's `window.ptResetData`, which calls
   * `activeChart().resetData()` — TV re-runs getBars at its CURRENT resolution
   * (already the new TF, since the user changed it via the toolbar), re-fetching
   * the new-TF candles for the same period. No remount, no spinner.
   */
  resetData: () => void;
}

/**
 * TradingView Advanced Charts host (Phase 2 — hosted Vercel URL + real datafeed).
 *
 * Loads the chart from `https://pt-chart-host.vercel.app` directly in the
 * WebView. Earlier phases bundled `chart_host.html` + the `charting_library/`
 * tree via `expo-asset` and injected a runtime `library_path` override; that
 * pipeline is gone now that the page is served from a real origin (which the
 * charting library's relative `library_path` resolves against cleanly).
 *
 * `symbol` / `interval` (and the backend URL) are passed through to the hosted
 * page as query params; the page's datafeed reads them to hit FastAPI.
 *
 * Phase 3B-1: when a replay `sessionId` is supplied it's appended as a
 * `&session=` query param. The hosted page's datafeed then fetches session
 * candles from GET /sessions/{id} instead of browse-mode /candles.
 */
interface Props {
  symbol?: string;
  interval?: string;
  sessionId?: string | null;
  /**
   * Phase 3B-3: fired when the USER taps a different timeframe in the hosted
   * chart's top toolbar. The hosted page posts `{type:'intervalChanged',
   * interval}` (TV resolution code) and we surface it here so the parent can
   * restart the replay session at the new TF — the session serves candles at
   * its FIXED start-timeframe, so a TF change requires a session restart, not
   * just a getBars re-fetch.
   */
  onIntervalChange?: (interval: string) => void;
}

function TradingViewChart(
  { symbol, interval, sessionId, onIntervalChange }: Props,
  ref: React.Ref<TradingViewChartHandle>,
) {
  const webviewRef = useRef<WebView>(null);

  // Expose `pushBar` to the parent. The injected JS is guarded against an
  // undefined `window.pushBar` so an early tap (before the hosted page's
  // bundle has run) can never throw inside the WebView. NOTE: even when
  // `window.pushBar` exists, its internal `activeOnTick` is null until the
  // datafeed's `subscribeBars` has fired — so a very-early bar may be
  // silently dropped on the chart side (server still advances). See the
  // early-tap desync note in ChartScreen; not fully solved this phase.
  useImperativeHandle(
    ref,
    () => ({
      pushBar: (bar: ChartBar) => {
        webviewRef.current?.injectJavaScript(
          'if (window.pushBar) { window.pushBar(' + JSON.stringify(bar) + '); } true;',
        );
      },
      resetData: () => {
        webviewRef.current?.injectJavaScript('window.ptResetData && window.ptResetData(); true;');
      },
    }),
    [],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    const data = event.nativeEvent.data;
    // eslint-disable-next-line no-console
    console.log('[TVChart]', data);

    // Most messages are plain `postMsg(...)` log strings (e.g. "getBars: ...")
    // which are NOT JSON — parse defensively so they can't throw. Only treat a
    // message as a typed bridge event if it parses to an object with a `type`.
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return; // non-JSON log line — already logged above
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { type?: unknown }).type === 'intervalChanged'
    ) {
      const next = (parsed as { interval?: unknown }).interval;
      if (typeof next === 'string' && next) {
        onIntervalChange?.(next);
      }
    }
  };

  // Defensive guard: don't load the chart before a session exists. The
  // screen already gates the mount on `sessionId`, but this protects
  // against direct prop misuse. Show a gold spinner instead of the WebView.
  if (!sessionId) {
    return (
      <View style={styles.spinnerWrap}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  const chartUrl =
    'https://pt-chart-host.vercel.app/?backend=' + encodeURIComponent(CHART_BACKEND_URL) +
    '&symbol=' + encodeURIComponent(symbol ?? 'NQ') +
    '&interval=' + encodeURIComponent(interval ?? '5') +
    '&session=' + encodeURIComponent(sessionId ?? '');

  return (
    // `key={`${symbol}-${sessionId}`}` forces a full WebView remount when the
    // symbol OR replay session changes — a bare `source.uri` prop change
    // doesn't reliably trigger a reload. INTERVAL is intentionally NOT in the
    // key: a TF change must NOT remount the chart. The parent now switches the
    // session's timeframe IN PLACE (POST /sessions/{id}/timeframe) and refreshes
    // the chart via `resetData()` — preserving the period, with no full-screen
    // spinner. A symbol change still starts a new session (new sessionId) and
    // remounts, which is correct.
    // TODO v2: postMessage widget.chart().setSymbol() to switch symbol without a full reload.
    <WebView
      ref={webviewRef}
      key={`${symbol}-${sessionId}`}
      source={{ uri: chartUrl }}
      style={styles.web}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      javaScriptEnabled
      mixedContentMode="always"
      onMessage={onMessage}
      onError={(e) => {
        // eslint-disable-next-line no-console
        console.error('[TVChart] WebView error', e.nativeEvent);
      }}
    />
  );
}

const TradingViewChartWithRef = forwardRef<TradingViewChartHandle, Props>(TradingViewChart);
TradingViewChartWithRef.displayName = 'TradingViewChart';

export default TradingViewChartWithRef;

const styles = StyleSheet.create({
  web: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  spinnerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
