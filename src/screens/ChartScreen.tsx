import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart, {
  type ChartBar,
  type TradingViewChartHandle,
} from '../components/charts/TradingViewChart';
import SymbolPickerSheet from '../components/SymbolPickerSheet';
import Button from '../components/ui/Button';
import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { tvIntervalToApiTimeframe } from '../lib/chartIntervals';
import { useAuthStore } from '../store/authStore';

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

/**
 * One cell of the bottom action row. `label` and `icon` are both
 * optional: Sell/Buy/Next Bar are text, FF is icon-only. Flexed cells
 * (`flex`) share the remaining width; FF uses a fixed compact width.
 */
function ActionButton({
  label,
  icon,
  bg,
  textColor,
  onPress,
  disabled,
  flex,
  fixedWidth,
  accessibilityLabel,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  bg: string;
  textColor: string;
  onPress: () => void;
  disabled?: boolean;
  flex?: number;
  fixedWidth?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: bg },
        flex != null && { flex },
        fixedWidth != null && { width: fixedWidth },
        pressed && !disabled && styles.actionBtnPressed,
        disabled && styles.actionBtnDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      {label ? <Text style={[styles.actionLabel, { color: textColor }]}>{label}</Text> : null}
    </Pressable>
  );
}

export default function ChartScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState('NQ');
  const [selectedInterval] = useState('5');
  const [pickerOpen, setPickerOpen] = useState(false);

  // The logged-in Firebase user. App.tsx's onAuthStateChanged listener
  // writes this exact `uid` both into the auth store (setUser) AND into
  // the backend `users` table (upsertUser) — so the value read here is
  // guaranteed to match the FK target of trading_sessions.uid. Read
  // reactively so a late async-auth hydration re-runs the effect below.
  const uid = useAuthStore((s) => s.uid);
  const username = useAuthStore((s) => s.username);

  // Replay session state. The chart only mounts once `sessionId` is set.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // A monotonic token to force a session restart on Retry. Bumping it
  // re-runs the effect below with the same symbol/interval.
  const [sessionAttempt, setSessionAttempt] = useState(0);

  // Imperative handle to the chart WebView — used to push newly-revealed
  // replay candles in via `pushBar`.
  const chartRef = useRef<TradingViewChartHandle>(null);

  // "Next Bar" advance state.
  //  - advancing: in-flight guard so a double-tap can't fire two advances.
  //  - done: the session has hit end-of-data; the button is disabled.
  //  - advanceError: a brief, non-crashing message; cleared on the next tap.
  const [advancing, setAdvancing] = useState(false);
  const [done, setDone] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);

  // Start a fresh replay session whenever the symbol or interval changes.
  // The `cancelled` guard drops a slow response from a stale symbol so it
  // can't overwrite a newer session (cancel-on-unmount / cancel-on-change).
  useEffect(() => {
    let cancelled = false;

    // Defensive fallback: in practice auth gates entry to MainTabs, so by
    // the time the Chart tab mounts there's always a signed-in user. But if
    // the uid hasn't resolved yet (async auth hydration) we must NOT call
    // /sessions/start — the session's uid FKs to users(uid) and a missing/
    // empty uid throws a FOREIGN KEY constraint 500. Leave sessionId null so
    // the chart area shows the "Sign in to trade" state below. The effect
    // re-runs once uid resolves (uid is in the dep array).
    if (!uid) {
      setSessionLoading(false);
      setSessionError(null);
      setSessionId(null);
      return;
    }

    setSessionLoading(true);
    setSessionError(null);
    // Clear the previous session id so the chart unmounts while the new
    // session is being created (avoids showing stale-symbol candles).
    setSessionId(null);

    // Real logged-in Firebase identity. App.tsx syncs this same uid to the
    // backend `users` table via upsertUser, so it satisfies the FK on
    // trading_sessions.uid.
    const body = {
      uid,
      username,
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
  }, [selectedSymbol, selectedInterval, sessionAttempt, uid, username]);

  const retrySession = useCallback(() => {
    setSessionAttempt((n) => n + 1);
  }, []);

  // Reset advance state when the session changes (new symbol/interval, or a
  // Retry-driven restart). Without this, a `done` flag from a finished
  // session would leave Next Bar disabled on a freshly-started one.
  useEffect(() => {
    setDone(false);
    setAdvanceError(null);
    setAdvancing(false);
  }, [sessionId]);

  // Advance the replay `count` bar(s) and append the newly-revealed candle(s)
  // to the chart. Single reusable path for BOTH Next Bar (count:1) and FF
  // (count:5) — no duplicate advance logic. The advance API returns one of
  // two shapes:
  //   normal:      { candles: [...newly revealed], done: false, auto_closed: [...] }
  //   end-of-data: { candles: [], done: true }   ← no `auto_closed` key
  // We push every candle in `candles` and flip `done` when the server says so.
  // `auto_closed` is logged only — trade UI is out of scope.
  //
  // The `advancing` in-flight guard covers BOTH callers: while a request is
  // outstanding, a second Next Bar / FF tap is ignored so we can't double-fire.
  const advance = useCallback(
    async (count: number) => {
      if (!sessionId || advancing || done) return; // debounce + end-of-data guard

      setAdvancing(true);
      setAdvanceError(null);
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const candles: any[] = Array.isArray(data?.candles) ? data.candles : [];
        for (const c of candles) {
          const bar: ChartBar = {
            time: c.time * 1000, // API unix seconds → TV ms
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          };
          chartRef.current?.pushBar(bar);
        }

        // auto_closed is out of scope this phase — log and move on. The
        // end-of-data shape omits the key, so default to [] (no choke).
        // eslint-disable-next-line no-console
        console.log('[advance] auto_closed', data?.auto_closed ?? []);

        if (data?.done === true) setDone(true);
      } catch (err: any) {
        // Non-crashing: surface a brief message, keep the button usable.
        setAdvanceError(
          err && err.message ? `Couldn't advance: ${err.message}` : 'Couldn’t advance',
        );
      } finally {
        setAdvancing(false);
      }
    },
    [sessionId, advancing, done],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.symbol}>{selectedSymbol}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              /* Phase 3D: news for current replay date */
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="News"
          >
            <Ionicons name="newspaper-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <Pressable
            onPress={() => {
              /* Phase 3C: Asia/London/NY session zone selector */
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel="Session"
          >
            <Ionicons name="time-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

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
      </View>

      <View style={styles.chartWrap}>
        {!uid && (
          <View style={styles.chartCenter}>
            <Text style={styles.signInText}>Sign in to trade</Text>
          </View>
        )}

        {uid && sessionLoading && (
          <View style={styles.chartCenter}>
            <ActivityIndicator size="large" color={colors.gold} />
          </View>
        )}

        {uid && !sessionLoading && sessionError && (
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

        {uid && !sessionLoading && !sessionError && sessionId && (
          <View style={styles.chartLayout}>
            {/* Chart fills the space above the bottom action row. The row is
                a real layout sibling below (not a floating overlay), so the
                chart is slightly shorter than full-bleed by design. */}
            <View style={styles.chartFill}>
              <TradingViewChart
                ref={chartRef}
                symbol={selectedSymbol}
                interval={selectedInterval}
                sessionId={sessionId}
              />
            </View>

            {/* Thin status strip directly above the action row. Takes zero
                height when there's nothing to show, so the row stays put.
                advanceError wins over the end-of-session note when both
                could apply (an error is the more urgent signal). */}
            {(advanceError || done) && (
              <View style={styles.statusStrip}>
                {advanceError ? (
                  <Text style={styles.advanceErrorText} numberOfLines={1}>
                    {advanceError}
                  </Text>
                ) : (
                  <Text style={styles.endOfSessionText} numberOfLines={1}>
                    End of session
                  </Text>
                )}
              </View>
            )}

            {/* Bottom action row — full-width, pinned below the chart and
                above the app tab bar. Sell / Buy / Next Bar flex; FF is a
                fixed compact icon button. Next Bar + FF share the single
                `advance()` path (counts 1 and 5). */}
            <View style={styles.actionRow}>
              <ActionButton
                label="Sell"
                bg={colors.red}
                textColor={colors.textPrimary}
                flex={1}
                accessibilityLabel="Sell"
                onPress={() => {
                  /* Phase 4: open short/sell position */
                }}
              />
              <ActionButton
                label="Buy"
                bg={colors.green}
                textColor={colors.textInverse}
                flex={1}
                accessibilityLabel="Buy"
                onPress={() => {
                  /* Phase 4: open long/buy position */
                }}
              />
              <ActionButton
                label="Next Bar"
                bg={colors.gold}
                textColor={colors.textInverse}
                flex={1}
                disabled={done || advancing}
                accessibilityLabel="Advance to next bar"
                onPress={() => advance(1)}
              />
              <ActionButton
                icon="play-forward"
                bg={colors.gold}
                textColor={colors.textInverse}
                fixedWidth={52}
                disabled={done || advancing}
                accessibilityLabel="Fast-forward five bars"
                onPress={() => advance(5)}
              />
            </View>
          </View>
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
  // Right-side header cluster: News + Session icon buttons followed by the
  // gold Watchlist button. Small gaps keep tap targets distinct.
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
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
  // Vertical stack: chart (flex) → status strip (auto) → action row (auto).
  chartLayout: { flex: 1 },
  chartFill: { flex: 1 },
  // Thin status strip above the action row — only rendered when there's
  // something to show, so it costs zero height otherwise.
  statusStrip: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
  },
  endOfSessionText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 13,
  },
  advanceErrorText: {
    color: colors.red,
    fontSize: 13,
  },
  // Full-width bottom action row — a real layout sibling below the chart,
  // above the app tab bar. Sell / Buy / Next Bar flex equally; FF is fixed.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
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
  signInText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    minWidth: 140,
  },
});
