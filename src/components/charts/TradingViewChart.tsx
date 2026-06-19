import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme';
import { CHART_BACKEND_URL } from '../../config/chartBackend';

/**
 * Chart-host version string. Appended to the WebView URL as ?hostv=…
 * so any change to the chart-host page is treated as a NEW URL by the
 * WebView's HTTP cache — WKWebView aggressively serves the cached
 * index.html for an unchanged URL even when the page sends
 * `Cache-Control: max-age=0, must-revalidate`. Bumping this value
 * after a chart-host deploy guarantees the next mount fetches fresh.
 *
 * KEEP IN SYNC with PT_HOST_VERSION in pt-chart-host/index.html.
 */
const PT_HOST_VERSION = '2026-06-17-revert-v32c';

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
 * A position to draw on the chart via the hosted `window.ptShowPosition`.
 * `pnl` is the live unrealized P&L (colored on the line). `pointValue`
 * is the USD per 1.00-point move per 1 contract for the current symbol
 * (POINT_VALUE[symbol]) — the chart-host uses it to compute the live
 * $ amounts on the draggable TP/SL chips.
 */
export interface ChartPosition {
  side: 'buy' | 'sell';
  qty: number;
  entry: number;
  pnl: number;
  pointValue: number;
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
  /**
   * Phase 4B: trade lines drawn ON the chart (replacing the RN corner box).
   * Each injects the corresponding hosted `window.ptXxx(...)` global, guarded
   * against the global not yet existing (early call before the page bundle ran).
   *  - showPosition: create-or-update the single position line at entry.
   *  - showTP / showSL: create-or-update a draggable TP/SL order line.
   *  - clearTrade: remove all three lines.
   */
  showPosition: (p: ChartPosition) => void;
  /** Capture the chart's main plot canvas as a JPEG dataURL. Async via
   *  postMessage — listen for `chartScreenshot` on `onLineMessage`.
   *  `opts.exitPrice` (optional) adds a horizontal EXIT marker line
   *  to the screenshot — chart-host doesn't know the exit price
   *  natively, so RN passes it in.
   *  `opts.noOverlays` (optional) skips entry/TP/SL/exit overlay
   *  drawing — used for the journal entry's clean chart capture so
   *  the user sees a plain candle chart with no annotations. */
  captureChartImage: (opts?: { exitPrice?: number; noOverlays?: boolean }) => void;
  /** Capture a polished 4:5 trade-card composite (chart + P&L hero +
   *  symbol/side/qty + entry→exit + branding). Async via postMessage
   *  — listen for `tradeCardImage` on `onLineMessage`. The chart-host
   *  renders the composite using the trade data passed in. */
  captureTradeCard: (data: TradeCardData) => void;
  showTP: (price: number) => void;
  showSL: (price: number) => void;
  clearTrade: () => void;
}

/**
 * Typed bridge events the hosted chart posts that the parent acts on:
 *  - tpMoved / slMoved: the user dragged a TP/SL line; `price` is the new value.
 *  - closePosition: the user tapped the position line's close button.
 *  - lineApiStatus: the one-shot runtime probe of whether createOrderLine /
 *    createPositionLine actually work in this (Advanced Charts) bundle.
 */
export type ChartLineMessage =
  | { type: 'tpMoved'; price: number }
  | { type: 'slMoved'; price: number }
  | { type: 'tpCleared' }
  | { type: 'slCleared' }
  | { type: 'closePosition' }
  | { type: 'lineApiStatus'; ok: boolean; detail?: string }
  | { type: 'chartScreenshot'; dataURL: string | null; err?: string }
  | { type: 'tradeCardImage'; dataURL: string | null; err?: string };

/** Shape passed to `captureTradeCard` — matches the polished trade-
 *  card composite the chart-host renders. Keep in sync with
 *  TradeResultData and the chart-host's `data` param. */
export interface TradeCardData {
  side: 'long' | 'short';
  symbol: string;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  pointsMove: number;
  returnPct: number;
  reason: 'tp' | 'sl' | 'manual';
  closedAtMs: number;
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
  /**
   * Phase 4B: fired for the trade-line bridge events the hosted page posts
   * (tpMoved / slMoved / closePosition / lineApiStatus). The parent wires
   * these to update_stops, close, and the line-API availability note.
   */
  onLineMessage?: (msg: ChartLineMessage) => void;
}

function TradingViewChart(
  { symbol, interval, sessionId, onIntervalChange, onLineMessage }: Props,
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
      showPosition: (p: ChartPosition) => {
        webviewRef.current?.injectJavaScript(
          'if (window.ptShowPosition) { window.ptShowPosition(' + JSON.stringify(p) + '); } true;',
        );
      },
      showTP: (price: number) => {
        webviewRef.current?.injectJavaScript(
          'if (window.ptShowTP) { window.ptShowTP(' + JSON.stringify(price) + '); } true;',
        );
      },
      showSL: (price: number) => {
        webviewRef.current?.injectJavaScript(
          'if (window.ptShowSL) { window.ptShowSL(' + JSON.stringify(price) + '); } true;',
        );
      },
      clearTrade: () => {
        webviewRef.current?.injectJavaScript('window.ptClearTrade && window.ptClearTrade(); true;');
      },
      captureChartImage: (opts?: { exitPrice?: number; noOverlays?: boolean }) => {
        const json = JSON.stringify(opts ?? {});
        webviewRef.current?.injectJavaScript(
          'window.ptCaptureChart && window.ptCaptureChart(' + json + '); true;',
        );
      },
      captureTradeCard: (data: TradeCardData) => {
        // Stringify-safe payload — JSON.stringify quotes the JSON
        // inside the JS so chart-host sees a real object literal
        // when window.ptCaptureTradeCard is called.
        const json = JSON.stringify(data);
        webviewRef.current?.injectJavaScript(
          'if (window.ptCaptureTradeCard) { window.ptCaptureTradeCard(' + json + '); } true;',
        );
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
    if (!parsed || typeof parsed !== 'object') return;
    const type = (parsed as { type?: unknown }).type;

    if (type === 'intervalChanged') {
      const next = (parsed as { interval?: unknown }).interval;
      if (typeof next === 'string' && next) {
        onIntervalChange?.(next);
      }
      return;
    }

    // Phase 4B trade-line bridge events. Forward the typed ones to the parent.
    if (type === 'tpMoved' || type === 'slMoved') {
      const price = (parsed as { price?: unknown }).price;
      if (typeof price === 'number') {
        onLineMessage?.({ type, price });
      }
      return;
    }
    if (type === 'tpCleared' || type === 'slCleared') {
      onLineMessage?.({ type });
      return;
    }
    if (type === 'closePosition') {
      onLineMessage?.({ type: 'closePosition' });
      return;
    }
    if (type === 'lineApiStatus') {
      const ok = (parsed as { ok?: unknown }).ok;
      const detail = (parsed as { detail?: unknown }).detail;
      onLineMessage?.({
        type: 'lineApiStatus',
        ok: !!ok,
        detail: typeof detail === 'string' ? detail : undefined,
      });
      return;
    }
    if (type === 'chartScreenshot') {
      const dataURL = (parsed as { dataURL?: unknown }).dataURL;
      const err     = (parsed as { err?: unknown }).err;
      onLineMessage?.({
        type: 'chartScreenshot',
        dataURL: typeof dataURL === 'string' ? dataURL : null,
        err: typeof err === 'string' ? err : undefined,
      });
      return;
    }
    if (type === 'tradeCardImage') {
      const dataURL = (parsed as { dataURL?: unknown }).dataURL;
      const err     = (parsed as { err?: unknown }).err;
      onLineMessage?.({
        type: 'tradeCardImage',
        dataURL: typeof dataURL === 'string' ? dataURL : null,
        err: typeof err === 'string' ? err : undefined,
      });
      return;
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

  // The WebView `source.uri` is FROZEN against the live `interval` prop: a
  // `source` change alone reloads a WebView, so if the URL carried the live
  // interval, every TF switch (which does setSelectedInterval) would change the
  // uri and reload the chart (blue pull-to-refresh bar + camera reset). We key
  // the memo ONLY on [symbol, sessionId] (CHART_BACKEND_URL is a stable module
  // constant) and read the `interval` prop's value at compute time. So:
  //  - symbol change → new sessionId → memo recomputes → uri reflects the
  //    then-current interval (session starts at the selected TF).
  //  - TF switch only → deps unchanged → cached uri returned → no reload; the
  //    new TF is applied via injection (resetData) instead.
  // EDGE (not solved, rare): the interval baked into the uri is frozen at
  // session-creation. If the WebView ever spontaneously reloaded (crash
  // recovery) AFTER a TF switch, it'd re-init at the session-creation interval
  // while the server session is at the switched TF. WebViews don't reload
  // spontaneously, so this is left unhandled.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chartUrl = useMemo(
    () =>
      'https://pt-chart-host.vercel.app/?backend=' + encodeURIComponent(CHART_BACKEND_URL) +
      '&symbol=' + encodeURIComponent(symbol ?? 'NQ') +
      '&interval=' + encodeURIComponent(interval ?? '5') +
      '&session=' + encodeURIComponent(sessionId ?? '') +
      // Cache-buster — see PT_HOST_VERSION comment up top.
      '&hostv=' + encodeURIComponent(PT_HOST_VERSION),
    // interval intentionally OMITTED — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbol, sessionId],
  );

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
      key={`${symbol}-${sessionId}-${PT_HOST_VERSION}`}
      source={{ uri: chartUrl }}
      style={styles.web}
      // Kill the iOS pull-to-refresh control: the blue "Refreshing…" bar was
      // the pull-to-refresh spinner appearing during reloads. We never want a
      // user-driven reload of the chart WebView (TF switches refresh in place
      // via resetData), so disable it entirely.
      pullToRefreshEnabled={false}
      // Disable the WebView's persistent HTTP cache for the chart-host page.
      // WKWebView ignores Cache-Control: max-age=0 + must-revalidate for HTML
      // surprisingly often and serves stale index.html across app launches.
      // Combined with the ?hostv= cache-buster above, this guarantees the
      // newest chart-host code is loaded on every mount. The TradingView
      // charting_library/ assets it then loads are separate URLs and are
      // still allowed to cache normally (they're path-versioned by us).
      cacheEnabled={false}
      // NOTE: `incognito` was REMOVED. On iOS it sets the WebView to
      // WKWebsiteDataStore.nonPersistentDataStore, which wipes
      // localStorage on every WebView mount. TradingView's Advanced
      // Charts library persists user chart settings (colors, drawing
      // tools, indicators, time-axis prefs, etc.) to localStorage by
      // default — chart-host doesn't override its save adapter — so
      // turning the data store ephemeral was destroying those settings
      // on every reload. The HTTP-cache concern is already handled by
      // cacheEnabled={false} + ?hostv= above, which is independent of
      // localStorage. Keeping the persistent data store lets the
      // library's auto-save survive app restarts.
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
