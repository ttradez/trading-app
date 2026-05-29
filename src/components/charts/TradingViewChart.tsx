import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme';
import { BASE_URL } from '../../services/api';

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
 * page as query params; the page's datafeed reads them to hit FastAPI /candles.
 */
interface Props {
  symbol?: string;
  interval?: string;
}

export default function TradingViewChart({ symbol, interval }: Props) {
  const onMessage = (event: WebViewMessageEvent) => {
    // eslint-disable-next-line no-console
    console.log('[TVChart]', event.nativeEvent.data);
  };

  const chartUrl =
    'https://pt-chart-host.vercel.app/?backend=' + encodeURIComponent(BASE_URL) +
    '&symbol=' + encodeURIComponent(symbol ?? 'NQ') +
    '&interval=' + encodeURIComponent(interval ?? '5');

  return (
    <WebView
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
});
