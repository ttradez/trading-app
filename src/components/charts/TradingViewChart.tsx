import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import { colors } from '../../theme';

/**
 * TradingView Advanced Charts host (Phase 1.6 — runtime library_path injection).
 *
 * Loads `assets/chart_host.html` inside a WebView. Phase 1 baked in a
 * relative `library_path: './charting_library/'`, which breaks once
 * `expo-asset` serves the HTML from a cache directory that doesn't
 * sit next to the `charting_library/` tree. Phase 1.6 computes the
 * on-disk directory of the charting_library bundle at runtime (using
 * `sameorigin.html` as a non-js anchor — `.js` is in Metro's
 * `sourceExts`, not `assetExts`, so we cannot `require` a .js file
 * through `expo-asset`) and injects it into the page as
 * `window.LIBRARY_PATH_OVERRIDE` before content loads.
 *
 * Phase 2 will wire `symbol` / `interval` through postMessage to drive
 * symbol / interval switching from the React side.
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
  const [libraryDir, setLibraryDir] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const htmlAsset = Asset.fromModule(
        require('../../../assets/chart_host.html'),
      );
      // Anchor the charting_library directory via a non-js file shipped
      // inside it. The directory portion of this asset's localUri is the
      // on-disk root of the entire charting_library tree (expo-asset
      // co-locates assets that were `require`d from sibling paths).
      const libraryAnchor = Asset.fromModule(
        require('../../../assets/charting_library/sameorigin.html'),
      );
      await Promise.all([
        htmlAsset.downloadAsync(),
        libraryAnchor.downloadAsync(),
      ]);
      if (cancelled) return;

      const anchorUri = libraryAnchor.localUri ?? libraryAnchor.uri;
      const dir = anchorUri.substring(0, anchorUri.lastIndexOf('/') + 1);

      setHtmlUri(htmlAsset.localUri ?? htmlAsset.uri);
      setLibraryDir(dir);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!htmlUri || !libraryDir) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  // Injected BEFORE the page's own scripts run so chart_host.html can
  // read `window.LIBRARY_PATH_OVERRIDE` from its top-level widget config.
  // Trailing `true;` is the standard WebView pattern — the injected JS
  // must return a truthy value.
  const injectedJSBeforeContentLoaded = `
    window.LIBRARY_PATH_OVERRIDE = ${JSON.stringify(libraryDir)};
    true;
  `;

  const onMessage = (event: WebViewMessageEvent) => {
    // eslint-disable-next-line no-console
    console.log('[TVChart]', event.nativeEvent.data);
  };

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
      injectedJavaScriptBeforeContentLoaded={injectedJSBeforeContentLoaded}
      onMessage={onMessage}
      onError={(e) => {
        // eslint-disable-next-line no-console
        console.error('[TVChart] WebView error', e.nativeEvent);
      }}
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
