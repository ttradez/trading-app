import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart from '../components/charts/TradingViewChart';
import SymbolPickerSheet from '../components/SymbolPickerSheet';
import Button from '../components/ui/Button';
import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { tvIntervalToApiTimeframe } from '../lib/chartIntervals';

/**
 * ChartScreen — the live Chart tab. Hosts the TradingView WebView
 * with a compact header bar showing the current symbol and a
 * Watchlist button that opens a bottom-sheet symbol picker.
 *
 * Phase 3B-1: the screen now starts a REPLAY SESSION (POST
 * /sessions/start) whenever the symbol/interval changes, and only
 * mounts the chart once a `session_id` is available. The chart then
 * reads session candles from GET /sessions/{id}. Next Bar (3B-2) and
 * date-anonymity (3B-1b) build on this foundation but are not in scope.
 */
export default function ChartScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState('NQ');
  const [selectedInterval] = useState('5');
  const [pickerOpen, setPickerOpen] = useState(false);

  // Replay session state. The chart only mounts once `sessionId` is set.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // A monotonic token to force a session restart on Retry. Bumping it
  // re-runs the effect below with the same symbol/interval.
  const [sessionAttempt, setSessionAttempt] = useState(0);

  // Start a fresh replay session whenever the symbol or interval changes.
  // The `cancelled` guard drops a slow response from a stale symbol so it
  // can't overwrite a newer session (cancel-on-unmount / cancel-on-change).
  useEffect(() => {
    let cancelled = false;

    setSessionLoading(true);
    setSessionError(null);
    // Clear the previous session id so the chart unmounts while the new
    // session is being created (avoids showing stale-symbol candles).
    setSessionId(null);

    // TODO: wire real Firebase uid/username. They're one line away — the
    // app already tracks the auth user in `useAuthStore` (src/store/authStore.ts):
    //   const { uid, username } = useAuthStore.getState();
    // (NOTE: state shape is flat — `uid`/`username` live on the store root,
    // there is no `.user` wrapper.) Using placeholders per the 3B-1 spec.
    const body = {
      uid: 'dev_user',
      username: 'Dev',
      symbol: selectedSymbol,
      timeframe: tvIntervalToApiTimeframe(selectedInterval),
      account_size: 50000,
      start_time: null,
    };

    fetch(`${CHART_BACKEND_URL}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSessionId(data.session_id);
        setSessionLoading(false);
        setSessionError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionError(
          err && err.message ? `Couldn't start session: ${err.message}` : 'Couldn’t start session',
        );
        setSessionLoading(false);
        // Keep sessionId null on failure so the chart stays unmounted.
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, selectedInterval, sessionAttempt]);

  const retrySession = useCallback(() => {
    setSessionAttempt((n) => n + 1);
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.symbol}>{selectedSymbol}</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.watchlistBtn}
          accessibilityRole="button"
          accessibilityLabel="Open watchlist"
        >
          <Ionicons name="bookmarks-outline" size={20} color={colors.gold} />
          <Text style={styles.watchlistLabel}>Watchlist</Text>
        </Pressable>
      </View>

      <View style={styles.chartWrap}>
        {sessionLoading && (
          <View style={styles.chartCenter}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        )}

        {!sessionLoading && sessionError && (
          <View style={styles.chartCenter}>
            <Text style={styles.errorText}>{sessionError}</Text>
            <Button
              label="Retry"
              variant="secondary"
              onPress={retrySession}
              style={styles.retryBtn}
            />
          </View>
        )}

        {!sessionLoading && !sessionError && sessionId && (
          <TradingViewChart
            symbol={selectedSymbol}
            interval={selectedInterval}
            sessionId={sessionId}
          />
        )}
      </View>

      <SymbolPickerSheet
        visible={pickerOpen}
        selectedSymbol={selectedSymbol}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  symbol: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  watchlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchlistLabel: {
    marginLeft: 6,
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  chartWrap: { flex: 1 },
  chartCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    minWidth: 140,
  },
});
