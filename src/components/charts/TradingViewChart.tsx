import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme';
import { CHART_BACKEND_URL } from '../../config/chartBackend';

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
}

export default function TradingViewChart({ symbol, interval, sessionId }: Props) {
  const onMessage = (event: WebViewMessageEvent) => {
    // eslint-disable-next-line no-console
    console.log('[TVChart]', event.nativeEvent.data);
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
    // `key={`${symbol}-${sessionId}`}` forces a full WebView remount when
    // the symbol OR the replay session changes — a bare `source.uri` prop
    // change doesn't reliably trigger a reload. (Interval has no picker
    // this phase; once one lands, fold it into the key too.)
    // TODO v2: postMessage widget.chart().setSymbol() to switch without a full reload.
    <WebView
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
