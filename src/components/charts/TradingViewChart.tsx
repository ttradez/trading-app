import React from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme';

/**
 * TradingView Advanced Charts host (Phase 1.8 — hosted Vercel URL).
 *
 * Loads the chart from `https://pt-chart-host.vercel.app` directly in the
 * WebView. Earlier phases bundled `chart_host.html` + the `charting_library/`
 * tree via `expo-asset` and injected a runtime `library_path` override; that
 * pipeline is gone now that the page is served from a real origin (which the
 * charting library's relative `library_path` resolves against cleanly).
 *
 * Phase 2 will wire `symbol` / `interval` through to drive symbol / interval
 * switching from the React side.
 */
interface Props {
  symbol?: string;
  interval?: string;
}

export default function TradingViewChart({
  symbol: _symbol,
  interval: _interval,
}: Props) {
  const onMessage = (event: WebViewMessageEvent) => {
    // eslint-disable-next-line no-console
    console.log('[TVChart]', event.nativeEvent.data);
  };

  return (
    // TODO Phase 2: pass symbol + interval via URL query params or postMessage
    // once we wire the real FastAPI datafeed
    <WebView
      source={{ uri: 'https://pt-chart-host.vercel.app' }}
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
