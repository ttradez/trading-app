import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart, {
  type ChartBar,
  type ChartLineMessage,
  type TradingViewChartHandle,
} from '../components/charts/TradingViewChart';
import SymbolPickerSheet from '../components/SymbolPickerSheet';
import Button from '../components/ui/Button';
import NumericText from '../components/NumericText';
import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { tvIntervalToApiTimeframe } from '../lib/chartIntervals';
import { useAuthStore } from '../store/authStore';

/**
 * An open replay position as returned by POST /sessions/{id}/trade
 * (action:"open"). We track tp/sl locally so drag-to-adjust can sync them
 * back to the backend via the `update_stops` action and keep the chart lines
 * in sync.
 */
interface OpenPosition {
  id: string;
  side: 'buy' | 'sell';
  lots: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
}

/**
 * Default TP/SL offset as a fraction of entry (~0.25%). Scales sensibly across
 * instruments. Side rules (applied at open):
 *   LONG  (buy):  TP ABOVE entry (entry * 1+OFFSET), SL BELOW (entry * 1−OFFSET)
 *   SHORT (sell): TP BELOW entry (entry * 1−OFFSET), SL ABOVE (entry * 1+OFFSET)
 */
const STOP_OFFSET = 0.0025;

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
      {icon ? <Ionicons name={icon} size={16} color={textColor} /> : null}
      {label ? <Text style={[styles.actionLabel, { color: textColor }]}>{label}</Text> : null}
    </Pressable>
  );
}

/**
 * Compact contract-quantity stepper: [ − ] N [ + ]. Fixed-width so the
 * Sell/Buy/Next Bar cells flex around it. Integer count, min 1. Rendered
 * inert (greyed, taps no-op) while a position is open — you can't resize
 * mid-position.
 */
function QtyStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.stepper, disabled && styles.actionBtnDisabled]}>
      <Pressable
        onPress={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        hitSlop={6}
        style={({ pressed }) => [styles.stepperBtn, pressed && !disabled && styles.actionBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Decrease contracts"
      >
        <Ionicons name="remove" size={16} color={colors.textPrimary} />
      </Pressable>
      <NumericText bold style={styles.stepperValue}>
        {value}
      </NumericText>
      <Pressable
        onPress={() => onChange(value + 1)}
        disabled={disabled}
        hitSlop={6}
        style={({ pressed }) => [styles.stepperBtn, pressed && !disabled && styles.actionBtnPressed]}
        accessibilityRole="button"
        accessibilityLabel="Increase contracts"
      >
        <Ionicons name="add" size={16} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

export default function ChartScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState('NQ');
  const [selectedInterval, setSelectedInterval] = useState('D');
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

  // ── Trade state (Phase 4) ──────────────────────────────────────────────
  // The current REVEALED price = the close of the last revealed candle.
  // There's no live tick in replay, so RN tracks it itself: seeded from the
  // session-start candles and updated on every /advance. Drives both the
  // open `entry_price` and the live unrealized P&L.
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // Contract multiplier for the active symbol (from /markets). Backend uses
  // it for realized P&L; we use the SAME value for the unrealized readout so
  // the two agree. Falls back to 1 if /markets is unreachable (the displayed
  // unrealized may then be off, but the backend still computes realized
  // correctly on close).
  const [contractSize, setContractSize] = useState(1);

  // Contract quantity (integer ≥ 1) sent as `lots` on open. Inert while a
  // position is open — you can't resize mid-position.
  const [qty, setQty] = useState(1);

  // The single open position (one-at-a-time gate). The backend's
  // open_positions is an ARRAY and would allow more, but the UI gates to one
  // for now. null = flat.
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [tradeBusy, setTradeBusy] = useState(false);

  // Phase 4B: position + TP/SL now render as TradingView lines (no corner box).
  //  - lineApiUnavailable: set true if the hosted page reports the line API is
  //    gated out of the Advanced Charts bundle (lineApiStatus ok:false). Drives
  //    a tiny inline note so the user knows lines won't appear — but trading
  //    still works (entry/close/P&L are backend-driven).
  //  - tradeResult: a BRIEF realized-P&L line shown after an auto-close (TP/SL
  //    hit on advance) or manual close. Auto-clears after a few seconds.
  const [lineApiUnavailable, setLineApiUnavailable] = useState(false);
  const [tradeResult, setTradeResult] = useState<string | null>(null);
  const tradeResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show a brief realized-P&L result line, auto-clearing after 4s. Reused by
  // both auto-close (TP/SL hit) and manual close.
  const flashResult = useCallback((text: string) => {
    setTradeResult(text);
    if (tradeResultTimer.current) clearTimeout(tradeResultTimer.current);
    tradeResultTimer.current = setTimeout(() => setTradeResult(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (tradeResultTimer.current) clearTimeout(tradeResultTimer.current);
    },
    [],
  );

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
        // Seed the current revealed price from the last loaded candle's close.
        // The session-start effect used to discard candles; now we keep the
        // last close so opens/unrealized P&L have a price before any advance.
        const candles: any[] = Array.isArray(data?.candles) ? data.candles : [];
        if (candles.length > 0) {
          setCurrentPrice(candles[candles.length - 1].close);
        }
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
    // selectedInterval is intentionally OMITTED: a TF change is handled in
    // place via POST /sessions/{id}/timeframe + resetData() (see
    // handleIntervalChange), NOT by restarting the session. The effect still
    // runs on symbol change / initial mount / Retry (sessionAttempt) and reads
    // the CURRENT selectedInterval from its closure, so a new symbol's session
    // starts at whatever TF is currently selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, sessionAttempt, uid, username]);

  const retrySession = useCallback(() => {
    setSessionAttempt((n) => n + 1);
  }, []);

  // Fetch the contract multiplier for the active symbol from /markets. The
  // SymbolPickerSheet fetches /markets for its UI; here we only need the
  // DATA (contractSize) for the active symbol, so this is a tiny standalone
  // fetch — no duplicated picker UI. Re-runs on symbol change. On failure we
  // keep contractSize = 1 (the unrealized readout may then be off; realized
  // P&L is still computed server-side on close regardless).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/markets`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: any[] = await res.json();
        if (cancelled) return;
        const m = Array.isArray(data)
          ? data.find((x) => x?.symbol === selectedSymbol)
          : null;
        setContractSize(m && typeof m.contractSize === 'number' ? m.contractSize : 1);
      } catch {
        if (cancelled) return;
        setContractSize(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  // Phase 3B-3 → in-place TF switch: the user tapped a different timeframe in
  // the hosted chart's top toolbar. By the time this fires, TV's internal
  // resolution is ALREADY `newInterval` (that's what emitted onIntervalChanged).
  // We switch the session's timeframe IN PLACE via POST /sessions/{id}/timeframe
  // — the server re-fetches candles around the SAME current_time, so the period
  // is preserved (no new random pick) — then refresh the chart with resetData().
  // resetData() makes TV re-run getBars at its current resolution (the new TF),
  // which re-fetches the new-TF candles and remaps them with __resolutionMs
  // recomputed from that resolution. No session restart, no remount, no
  // full-screen spinner.
  //
  // Loop-safety: the hosted page subscribes to onIntervalChanged INSIDE
  // onChartReady (so the initial load doesn't re-emit) and the `=== selectedInterval`
  // guard below is a second line of defence — no switch loop.
  //
  // Fallback for a later phase: if resetData() ever proves insufficient to
  // re-fetch (e.g. TV serves cached bars at the old resolution), we could ALSO
  // inject `window.tvWidget.activeChart().setResolution(newInterval)`. We do NOT
  // call it here because the user already set the resolution via the toolbar, so
  // resetData() alone re-fetches at the new TF. Adding setResolution would be
  // redundant (and could double-fire onIntervalChanged).
  const handleIntervalChange = useCallback(
    async (newInterval: string) => {
      if (newInterval === selectedInterval) return;
      if (!sessionId) return;
      const tf = tvIntervalToApiTimeframe(newInterval);
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/timeframe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeframe: tf }),
        });
        if (!res.ok) throw new Error('timeframe switch failed: ' + res.status);
        // Refresh the chart in place — re-fetches new-TF candles for the same
        // period. No remount, no full-screen spinner.
        chartRef.current?.resetData();
        setSelectedInterval(newInterval);
      } catch (e) {
        // Brief, non-crashing message; keep the current view. Reuses the
        // existing transient advanceError UI strip rather than a full-screen state.
        setAdvanceError('Could not switch timeframe');
      }
    },
    [selectedInterval, sessionId],
  );

  // Reset advance state when the session changes (new symbol/interval, or a
  // Retry-driven restart). Without this, a `done` flag from a finished
  // session would leave Next Bar disabled on a freshly-started one.
  useEffect(() => {
    setDone(false);
    setAdvanceError(null);
    setAdvancing(false);
    // A new session means any prior position belonged to the old session —
    // drop it so the readout doesn't carry over. Reset qty to the default.
    setPosition(null);
    setQty(1);
    setTradeBusy(false);
    // Clear any leftover trade lines + transient result from the prior session.
    chartRef.current?.clearTrade();
    setTradeResult(null);
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

        // Track the current revealed price = the last newly-revealed close.
        // This drives the live unrealized P&L readout (recomputed on render).
        const newPrice =
          candles.length > 0 ? candles[candles.length - 1].close : currentPrice;
        if (candles.length > 0) {
          setCurrentPrice(candles[candles.length - 1].close);
        }

        // auto_closed: positions stopped/targeted out as bars revealed. Keep
        // the existing log. If our open position's id appears, it was closed
        // server-side (TP/SL hit) — clear the chart lines and flash the brief
        // realized result. End-of-data shape omits the key → [].
        const autoClosed: any[] = Array.isArray(data?.auto_closed) ? data.auto_closed : [];
        // eslint-disable-next-line no-console
        console.log('[advance] auto_closed', autoClosed);
        const mine = position
          ? autoClosed.find((t) => t?.position_id === position.id)
          : null;
        if (mine) {
          setPosition(null);
          chartRef.current?.clearTrade();
          const pnl = typeof mine.pnl === 'number' ? mine.pnl : 0;
          const hitLabel = mine.hit === 'tp' ? 'TP hit' : mine.hit === 'sl' ? 'SL hit' : 'Closed';
          flashResult(`${hitLabel} ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`);
        } else if (position && newPrice != null) {
          // Position still open — refresh the line's P&L for the new price.
          const pnl =
            (newPrice - position.entry_price) *
            (position.side === 'buy' ? 1 : -1) *
            contractSize *
            position.lots;
          chartRef.current?.showPosition({
            side: position.side,
            qty: position.lots,
            entry: position.entry_price,
            pnl,
          });
        }

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
    [sessionId, advancing, done, position, currentPrice, contractSize, flashResult],
  );

  // Open a position. Buy = LONG (side:"buy"), Sell = SHORT (side:"sell").
  // We send entry_price = currentPrice so the recorded entry matches the
  // price on screen (the last revealed close). One-at-a-time gate: ignored
  // if a position is already open or we don't yet have a price.
  const openPosition = useCallback(
    async (side: 'buy' | 'sell') => {
      if (!sessionId || position || tradeBusy) return;
      if (currentPrice == null) return;
      setTradeBusy(true);
      setAdvanceError(null);

      // Default TP/SL at ~0.25% of entry, placed on the correct sides. The
      // backend accepts stop_loss/take_profit at open, so we send the defaults
      // in the open body (no separate update_stops needed on entry).
      const entry = currentPrice;
      const up = entry * (1 + STOP_OFFSET);
      const down = entry * (1 - STOP_OFFSET);
      const takeProfit = side === 'buy' ? up : down;
      const stopLoss = side === 'buy' ? down : up;

      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'open',
            side,
            lots: qty,
            entry_price: entry,
            stop_loss: stopLoss,
            take_profit: takeProfit,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data?.position) {
          const p: OpenPosition = {
            id: data.position.id,
            side: data.position.side,
            lots: data.position.lots,
            entry_price: data.position.entry_price,
            stop_loss: data.position.stop_loss ?? stopLoss,
            take_profit: data.position.take_profit ?? takeProfit,
          };
          setPosition(p);
          // Draw the position line + draggable TP/SL on the chart. P&L starts
          // at 0 (entry == current price). These no-op gracefully if the line
          // API is gated (the hosted page reports lineApiStatus ok:false).
          chartRef.current?.showPosition({ side: p.side, qty: p.lots, entry: p.entry_price, pnl: 0 });
          if (p.take_profit != null) chartRef.current?.showTP(p.take_profit);
          if (p.stop_loss != null) chartRef.current?.showSL(p.stop_loss);
        }
      } catch (err: any) {
        setAdvanceError(
          err && err.message ? `Couldn't open: ${err.message}` : 'Couldn’t open position',
        );
      } finally {
        setTradeBusy(false);
      }
    },
    [sessionId, position, tradeBusy, currentPrice, qty],
  );

  // Close the open position. Realized P&L comes back on the {trade} response —
  // logged here; a closed-trade summary UI is a later phase. Balance is also
  // returned ({balance}); we don't currently surface balance on this screen,
  // so there's nothing to update (logged for traceability).
  const closePosition = useCallback(async () => {
    if (!sessionId || !position || tradeBusy) return;
    setTradeBusy(true);
    setAdvanceError(null);
    try {
      const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', position_id: position.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // eslint-disable-next-line no-console
      console.log('[trade] closed', data?.trade);
      setPosition(null);
      // Clear the chart lines and flash the realized P&L.
      chartRef.current?.clearTrade();
      const pnl = typeof data?.trade?.pnl === 'number' ? data.trade.pnl : null;
      if (pnl != null) {
        flashResult(`Closed ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`);
      }
    } catch (err: any) {
      setAdvanceError(
        err && err.message ? `Couldn't close: ${err.message}` : 'Couldn’t close position',
      );
    } finally {
      setTradeBusy(false);
    }
  }, [sessionId, position, tradeBusy, flashResult]);

  // Drag-to-adjust: a TP/SL line was moved on the chart. Persist the new stop
  // to the backend via the STEP-0 `update_stops` action (only the moved stop is
  // sent — the omitted one is left untouched server-side) and keep RN's local
  // tp/sl state in sync so close/auto-close math and re-renders agree.
  const updateStop = useCallback(
    async (which: 'stop_loss' | 'take_profit', price: number) => {
      if (!sessionId || !position) return;
      // Optimistic local sync first so the readout/state is immediately correct.
      setPosition((prev) =>
        prev && prev.id === position.id ? { ...prev, [which]: price } : prev,
      );
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_stops',
            position_id: position.id,
            [which]: price,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err: any) {
        setAdvanceError(
          err && err.message ? `Couldn't update stop: ${err.message}` : 'Couldn’t update stop',
        );
      }
    },
    [sessionId, position],
  );

  // Bridge events from the hosted chart lines: drag → update_stops; close
  // button → close; lineApiStatus → availability note.
  const onLineMessage = useCallback(
    (msg: ChartLineMessage) => {
      if (msg.type === 'tpMoved') {
        updateStop('take_profit', msg.price);
      } else if (msg.type === 'slMoved') {
        updateStop('stop_loss', msg.price);
      } else if (msg.type === 'closePosition') {
        closePosition();
      } else if (msg.type === 'lineApiStatus') {
        if (!msg.ok) {
          // eslint-disable-next-line no-console
          console.warn('[TVChart] line API unavailable (gated):', msg.detail);
          setLineApiUnavailable(true);
        } else {
          setLineApiUnavailable(false);
        }
      }
    },
    [updateStop, closePosition],
  );

  // One-at-a-time gate: Buy/Sell + the stepper are disabled while a position
  // is open or a trade request is in flight.
  const tradeDisabled = !!position || tradeBusy || currentPrice == null;

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
              {/* Phase 4B: the position + TP/SL now render as TradingView
                  lines ON the chart (via the imperative handle). The old
                  top-left corner readout box is gone. Live P&L updates on the
                  position line on every advance; drag the TP/SL lines to adjust
                  (synced to the backend via update_stops). */}
              <TradingViewChart
                ref={chartRef}
                symbol={selectedSymbol}
                interval={selectedInterval}
                sessionId={sessionId}
                onIntervalChange={handleIntervalChange}
                onLineMessage={onLineMessage}
              />
            </View>

            {/* Thin status strip directly above the action row. Takes zero
                height when there's nothing to show, so the row stays put.
                Priority: advanceError > tradeResult (realized close/TP/SL) >
                lineApiUnavailable note > end-of-session. */}
            {(advanceError || tradeResult || lineApiUnavailable || done) && (
              <View style={styles.statusStrip}>
                {advanceError ? (
                  <Text style={styles.advanceErrorText} numberOfLines={1}>
                    {advanceError}
                  </Text>
                ) : tradeResult ? (
                  <Text
                    style={[
                      styles.tradeResultText,
                      { color: tradeResult.includes('-$') ? colors.red : colors.green },
                    ]}
                    numberOfLines={1}
                  >
                    {tradeResult}
                  </Text>
                ) : lineApiUnavailable ? (
                  <Text style={styles.endOfSessionText} numberOfLines={1}>
                    Chart lines unavailable on this build — trading still works
                  </Text>
                ) : (
                  <Text style={styles.endOfSessionText} numberOfLines={1}>
                    End of session
                  </Text>
                )}
              </View>
            )}

            {/* Bottom action row — full-width, pinned below the chart and
                above the app tab bar. Order: Sell | qty | Buy | Next Bar | FF.
                Sell/Buy/Next Bar flex; the qty stepper is a fixed compact
                width; FF is the fixed compact icon button. Sell/Buy +
                stepper are gated to one-at-a-time (disabled while a position
                is open). Next Bar + FF share the single `advance()` path. */}
            <View style={styles.actionRow}>
              {/* Compact close affordance — only shown while a position is
                  open (replaces the old big corner box's Close button). */}
              {position && (
                <Pressable
                  onPress={closePosition}
                  disabled={tradeBusy}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.closeChip,
                    pressed && !tradeBusy && styles.actionBtnPressed,
                    tradeBusy && styles.actionBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close position"
                >
                  <Ionicons name="close" size={14} color={colors.textPrimary} />
                  <Text style={styles.closeChipLabel}>Close</Text>
                </Pressable>
              )}
              <ActionButton
                label="Sell"
                bg={colors.red}
                textColor={colors.textPrimary}
                flex={1}
                disabled={tradeDisabled}
                accessibilityLabel="Sell"
                onPress={() => openPosition('sell')}
              />
              <QtyStepper value={qty} onChange={setQty} disabled={tradeDisabled} />
              <ActionButton
                label="Buy"
                bg={colors.green}
                textColor={colors.textInverse}
                flex={1}
                disabled={tradeDisabled}
                accessibilityLabel="Buy"
                onPress={() => openPosition('buy')}
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
                fixedWidth={44}
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
  // Brief realized-P&L result after a close / TP-SL auto-close. Green/red set
  // inline based on the sign.
  tradeResultText: {
    fontSize: 13,
    fontWeight: '700',
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
    height: 41,
    borderRadius: 11,
    gap: 6,
  },
  actionBtnPressed: { opacity: 0.85 },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Contract-quantity stepper — fixed compact width (~88px) so the flexed
  // Sell/Buy/Next Bar cells share the rest. Matches the action-row height.
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 88,
    height: 41,
    borderRadius: 11,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    width: 28,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  stepperValue: {
    color: colors.textPrimary,
    fontSize: 15,
    minWidth: 18,
    textAlign: 'center',
  },

  // Compact close affordance in the action row — only shown while a position
  // is open. Replaces the old big corner readout box's Close button.
  closeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 41,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeChipLabel: {
    color: colors.textPrimary,
    fontSize: 12,
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
