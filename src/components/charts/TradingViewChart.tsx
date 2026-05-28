import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { colors } from '../../theme';

/**
 * TradingView Advanced Charts host (Phase 1 — scaffolding).
 *
 * Loads `assets/chart_host.html` inside a WebView. The widget is
 * hardcoded to NQ / 5-min in the HTML for Phase 1; the `symbol` and
 * `interval` props are accepted for the call-site contract but unused
 * here — Phase 2 will wire them through postMessage to drive symbol /
 * interval switching from the React side.
 */
interface Props {
  symbol?: string;
  interval?: string;
}

export default function TradingViewChart({
  symbol: _symbol,
  interval: _interval,
}: Props) {
  const [htmlUri, setHtmlUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const htmlAsset = Asset.fromModule(
        require('../../../assets/chart_host.html'),
      );
      await htmlAsset.downloadAsync();
      if (cancelled) return;
      setHtmlUri(htmlAsset.localUri ?? htmlAsset.uri);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!htmlUri) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: htmlUri }}
      style={styles.web}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowUniversalAccessFromFileURLs
      javaScriptEnabled
      mixedContentMode="always"
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  web: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
