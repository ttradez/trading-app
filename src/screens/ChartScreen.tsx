import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, Alert, Dimensions } from 'react-native';

// Narrow-phone breakpoint: anything ≤360dp wide gets a tighter action-row
// layout so Sell / qty stepper / Buy / Next Bar / FF all fit on Galaxy
// A-series and other budget Android devices. iPhone Pro Max (414dp) keeps
// the original spacious layout.
const NARROW_PHONE = Dimensions.get('window').width <= 360;
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart, {
  type ChartBar,
  type ChartLineMessage,
  type TradingViewChartHandle,
} from '../components/charts/TradingViewChart';
import SymbolPickerSheet from '../components/SymbolPickerSheet';
import SessionTimesConfigModal from '../components/SessionTimesConfigModal';
import TradeFillToast, { TradeFillToastData } from '../components/TradeFillToast';
import NewsPanel from '../components/NewsPanel';
import TradeResultCard, { TradeResultData } from '../components/TradeResultCard';
import { useNavigation } from '@react-navigation/native';
import { useJournalStore, JournalEntry } from '../store/journalStore';
// expo-file-system v19 split the surface: the new `File`/`Directory`
// objects live at the package root, but the imperative
// `writeAsStringAsync` + `cacheDirectory` we need are under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import SessionsScreen from './SessionsScreen';
import Button from '../components/ui/Button';
import NumericText from '../components/NumericText';
import { colors, surface, borders } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { apiTimeframeToTvInterval, tvIntervalToApiTimeframe } from '../lib/chartIntervals';
import { useAuthStore } from '../store/authStore';
import { useSessionTimesStore } from '../store/sessionTimesStore';
import { computePnl, POINT_VALUE } from '../data/tradeMath';
import {
  detectAfterTradeClose, detectAfterSessionEnd,
} from '../utils/challengeDetection';
import { useSessionStatsStore } from '../store/sessionStatsStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTrainingTimer } from '../hooks/useTrainingTimer';

/**
 * Session-local open position. Lives in React state only; NO backend
 * persistence yet (the trading mechanic is being rebuilt session-locally
 * before we re-wire to the API). Closing computes realizedPnl via
 * `computePnl` in `src/data/tradeMath.ts`. Resets to null whenever the
 * active session id changes.
 */
type SessionPosition = {
  side: 'long' | 'short';
  entryPrice: number;
  contracts: number;
  symbol: string;
  status: 'open' | 'closed';
  exitPrice: number | null;
  realizedPnl: number | null;
  /** Index of the last revealed candle in the candles array at open. */
  entryBarIndex: number;
  /** Unix seconds of the last revealed candle at open. */
  entryBarTime: number;
  /**
   * User-set TP/SL prices coming back from the chart-host's draggable
   * chips. Stored only — no auto-fill logic yet (next step). null until
   * the user drops the chip for the first time; the chart-host shows
   * its own default placement until then.
   */
  tpPrice: number | null;
  slPrice: number | null;
};

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
  // Training timer — accumulates session time toward the user's
  // onboarding-picked daily goal. Crossing the goal auto-completes
  // the day in streakStore (currentStreak++), which is what drives
  // the fire-icon count on the Home header. This was previously only
  // mounted on the legacy TradingScreen, so chart-screen sessions
  // never accrued streak progress.
  useTrainingTimer();

  // Used by TradeResultCard's "Journal Trade" action to navigate to the
  // Journal tab. We pull from the navigation container at render-time so
  // the screen doesn't have to be wired with a typed prop.
  const navigation = useNavigation<any>();
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

  // The active session's backend `current_time` (unix seconds). Mirrors
  // sess["current_time"] read from GET /sessions/{id}. Used to time-sync
  // a freshly-picked symbol's shadow session to the user's primary replay
  // cursor so switching markets does NOT jump backward to a random date.
  // Stored in a ref so reads from inside callbacks don't go stale on
  // re-render, and writes don't force a re-render of the chart.
  const currentSessionTimeRef = useRef<number | null>(null);

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
  // Mirror of lastBarRef.current.time as React state so child components
  // (e.g. NewsPanel) re-render on each /advance — useRef updates don't.
  // Used to drive the News panel's current replay-day + past/upcoming
  // split. Always kept in sync with lastBarRef at every update site.
  const [currentBarTimeSec, setCurrentBarTimeSec] = useState<number | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);

  // Contract multiplier for the active symbol (from /markets). Backend uses
  // it for realized P&L; we use the SAME value for the unrealized readout so
  // the two agree. Falls back to 1 if /markets is unreachable (the displayed
  // unrealized may then be off, but the backend still computes realized
  // correctly on close).
  const [contractSize, setContractSize] = useState(1);

  // Contract quantity (integer ≥ 1) sent as `lots` on open. Inert while a
  // position is open — you can't resize mid-position.
  const [qty, setQty] = useState(1);

  // The single open position (one-at-a-time gate). Session-local — no
  // backend persistence yet. null = flat. While `position !== null` Buy/
  // Sell are disabled and a Close chip appears in their place.
  const [position, setPosition] = useState<SessionPosition | null>(null);
  // Kept for compatibility with prior code (chart-line + advance hooks)
  // but no longer toggled by open/close since both are now synchronous.
  const [tradeBusy, setTradeBusy] = useState(false);
  // The last bar that's been "ticked" — drives the live unrealized P&L.
  // Held alongside currentPrice (which is the close of the last revealed
  // candle); these are conceptually the same in replay.
  // We also track the most-recent revealed bar index/time for entryBarIndex
  // / entryBarTime capture at open. These come from the chart push-bar
  // path below, not from a separate candles state.
  const lastBarRef = useRef<{ index: number; time: number } | null>(null);

  // Phase 4B: position + TP/SL now render as TradingView lines (no corner box).
  //  - lineApiUnavailable: set true if the hosted page reports the line API is
  //    gated out of the Advanced Charts bundle (lineApiStatus ok:false). Drives
  //    a tiny inline note so the user knows lines won't appear — but trading
  //    still works (entry/close/P&L are backend-driven).
  //  - tradeResult: a BRIEF realized-P&L line shown after an auto-close (TP/SL
  //    hit on advance) or manual close. Auto-clears after a few seconds.
  const [lineApiUnavailable, setLineApiUnavailable] = useState(false);
  const [tradeResult, setTradeResult] = useState<string | null>(null);
  // TP/SL auto-close toast. Set in the advance loop when a bar's
  // high/low crosses the stored tpPrice/slPrice; the TradeFillToast
  // component handles the slide-in animation + 4s auto-dismiss +
  // tap-× early dismiss. NOT set on manual closes.
  const [fillToast, setFillToast] = useState<TradeFillToastData | null>(null);
  // Post-trade result card — shown after every close (manual + TP/SL auto).
  // Replaces the TradeFillToast popup for closes so we don't stack two
  // popups on top of each other.
  const [tradeResultCard, setTradeResultCard] = useState<TradeResultData | null>(null);
  // One-shot resolver for the next chartScreenshot bridge message. Set
  // by `captureChartScreenshot()` before injecting the JS, called by the
  // onLineMessage handler when the chart-host posts back. Plain ref
  // (not state) because nothing about its value drives a re-render.
  const pendingChartShot = useRef<((uri: string | null) => void) | null>(null);
  // Same shape as pendingChartShot but for the polished trade-card
  // composite (window.ptCaptureTradeCard). Separate resolver so we
  // can have both captures in flight at the same trade-close moment.
  const pendingTradeCardShot = useRef<((uri: string | null) => void) | null>(null);
  const tradeResultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase 3C: Sessions dropdown (NY/London/Asia). The header time-outline
  // button opens a small Modal anchored top-right. Tapping a row fires a
  // POST /sessions/{id}/seek_session that fast-forwards the replay cursor
  // to the next ET wall-clock time matching that session's open, then
  // calls chartRef.current?.resetData() to re-fetch the visible window
  // at the new cursor (Path B — same path TF switching uses, scales to
  // multi-day jumps without a per-bar pushBar walk).
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [jumpError, setJumpError] = useState<string | null>(null);
  const jumpErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Phase B: the Sessions dropdown's three row labels and the seek_session
  // POST both read these from the persisted store. The "⚙ Edit session
  // times" row opens the config sheet.
  const [tzModalVisible, setTzModalVisible] = useState(false);
  const sessionTz = useSessionTimesStore((s) => s.tz);
  const sessionNewYork = useSessionTimesStore((s) => s.newyork);
  const sessionLondon = useSessionTimesStore((s) => s.london);
  const sessionAsia = useSessionTimesStore((s) => s.asia);

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
      if (jumpErrorTimer.current) clearTimeout(jumpErrorTimer.current);
    },
    [],
  );

  // Brief jump-error caption, auto-clearing after 4s. Mirrors flashResult's
  // single-timer pattern. Surfaced in the same status strip as advanceError.
  const flashJumpError = useCallback((text: string) => {
    setJumpError(text);
    if (jumpErrorTimer.current) clearTimeout(jumpErrorTimer.current);
    jumpErrorTimer.current = setTimeout(() => setJumpError(null), 4000);
  }, []);

  // Seed currentPrice whenever the active sessionId changes (resume from
  // SessionsScreen OR brand-new session from CreateSessionSheet). The
  // earlier auto-create-on-mount POST /sessions/start has moved to the
  // CreateSessionSheet; here we just GET the existing session so the
  // chart screen has a current revealed price for opens / unrealized
  // P&L before the user advances. The `cancelled` guard drops a slow
  // response from a stale session so it can't overwrite a newer one.
  useEffect(() => {
    let cancelled = false;

    if (!uid) {
      setSessionLoading(false);
      setSessionError(null);
      return;
    }
    // No active session selected → SessionsScreen is rendered in place
    // of the chart UI, nothing to fetch.
    if (!sessionId) {
      setSessionLoading(false);
      setSessionError(null);
      return;
    }

    setSessionLoading(true);
    setSessionError(null);

    fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Seed the current revealed price from the last loaded candle's close.
        const candles: any[] = Array.isArray(data?.candles) ? data.candles : [];
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          setCurrentPrice(last.close);
          // Capture index/time of the last revealed bar so a Buy/Sell tap
          // before any /advance still records a real entryBarIndex+time.
          const lastIdx = candles.length - 1;
          const lastTime = typeof last.time === 'number' ? last.time : 0;
          lastBarRef.current = { index: lastIdx, time: lastTime };
          setCurrentBarTimeSec(lastTime || null);
        }
        // Resume restores the persisted symbol/interval so the chart
        // mounts at the same TF the session was last viewed on.
        if (typeof data?.symbol === 'string' && data.symbol !== selectedSymbol) {
          setSelectedSymbol(data.symbol);
        }
        // Cache the backend's authoritative current_time so the picker
        // can time-sync shadow sessions to it on the next symbol switch.
        if (typeof data?.current_time === 'number') {
          currentSessionTimeRef.current = data.current_time;
        }
        setSessionLoading(false);
        setSessionError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionError(
          err && err.message ? `Couldn't load session: ${err.message}` : 'Couldn’t load session',
        );
        setSessionLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // selectedSymbol / selectedInterval are intentionally OMITTED: a TF
    // change is handled in place via POST /sessions/{id}/timeframe; a
    // symbol change is owned by the SessionsScreen create flow (which
    // hands back a new session_id). The effect only re-fires when the
    // active session itself changes, when the user retries after an
    // error, or when uid (re-)resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionAttempt, uid]);

  const retrySession = useCallback(() => {
    setSessionAttempt((n) => n + 1);
  }, []);

  // Per-symbol session cache. Keys are uppercase symbol strings (e.g.
  // "YM"), values are the server session_ids the user is currently
  // running for that contract. Lets the picker resume the same session
  // when the user cycles back to a market they've already visited
  // instead of spawning a fresh random session (which would change the
  // candles every time they came back).
  //
  // Lives in a ref so cache writes don't trigger re-renders — it's a
  // pure side-effect lookup, not display state. Bounded to the
  // ChartScreen lifetime: cleared on handleReturnToSessions so a
  // round-trip through SessionsScreen starts cleanly.
  const sessionsBySymbolRef = useRef<Map<string, string>>(new Map());

  // The session_id the user CAME IN on for this chart-screen visit —
  // i.e. the one explicitly chosen via SessionsScreen or just created
  // via CreateSessionSheet. Picker-spawned sessions (visiting other
  // markets via the watchlist) accumulate alongside it in the cache,
  // but only this one is the user's "real" session. On exit, the
  // picker-spawned ones get DELETEd from the backend so they don't
  // pollute the Continue list.
  const entrySessionIdRef = useRef<string | null>(null);

  // Handler shared by SessionsScreen (resume tap) and CreateSessionSheet
  // (new-session success). Sets the active sessionId + persisted
  // symbol/timeframe so the chart mounts on the chosen session. The
  // GET-/sessions/{id}/ seeding effect above runs as a side-effect of
  // sessionId changing.
  const handleSessionSelected = useCallback(
    (sid: string, sym: string, tf: string) => {
      // Convert the API timeframe ('5m', '1D'…) back to a TV interval
      // ('5', 'D'…) so the chart toolbar lines up on mount. We only
      // map the keys we actually ship in CreateSessionSheet today,
      // falling back to 'D' for anything unrecognized.
      const tvInterval = apiTimeframeToTvInterval(tf);
      setSelectedSymbol(sym);
      setSelectedInterval(tvInterval);
      // Record this symbol -> sessionId binding so a future picker tap
      // on the same symbol resumes this exact session. Always-write so
      // restarting a session on the same symbol via SessionsScreen
      // replaces the stale cache entry.
      sessionsBySymbolRef.current.set(sym, sid);
      // Lock in the entry session on the FIRST handleSessionSelected
      // call of this chart-screen visit. Picker-spawned sessions call
      // through here too, but they arrive AFTER the entry is set, so
      // they never overwrite. handleReturnToSessions clears this back
      // to null so a round-trip through SessionsScreen re-locks
      // cleanly on the next chart entry.
      if (entrySessionIdRef.current === null) {
        entrySessionIdRef.current = sid;
      }
      // Bookend any prior session-stats run BEFORE starting fresh.
      // This handles the case where the user closed the app
      // mid-session and the persisted store still has a `currentSession`.
      // No-op when nothing is active.
      const prior = useSessionStatsStore.getState().endSession();
      if (prior) detectAfterSessionEnd(prior);
      // Begin stats tracking for the new chart session. The challenge
      // engine reads this on every trade close + at session-end. We
      // also pass the session_id so per-session trade tallies land
      // in `perSession` for the Continue card on SessionsScreen.
      useSessionStatsStore.getState().startSession(sid);
      setSessionId(sid);
    },
    [],
  );

  // Symbol-picker onSelect handler — fired when the user taps a market
  // in SymbolPickerSheet. Behaviour:
  //
  //   - Same symbol as current → close the picker (no-op).
  //
  //   - Different symbol, NOT yet visited this chart-screen visit →
  //       Spawn a SHADOW session (is_shadow=true) anchored at the user's
  //       current replay time via start_time = currentSessionTime. The
  //       backend's /users/{uid}/sessions hides shadows from the
  //       Continue list, so the picker doesn't pollute the user's real
  //       session list. handleReturnToSessions later DELETES the
  //       shadows when the user exits the chart.
  //
  //   - Different symbol, ALREADY visited (cache hit) →
  //       Resume the cached session, but first POST /seek to sync its
  //       cursor to the user's current replay time. This makes the
  //       chart show the picked market at the SAME date the user is
  //       on — no jumping back to a random older time.
  //
  // The currentSessionTimeRef is fed by the session-load effect, which
  // reads `current_time` from GET /sessions/{id}. It's the user's
  // authoritative replay cursor across markets.
  const handlePickerSelect = useCallback(
    async (symbol: string) => {
      if (symbol === selectedSymbol) {
        setPickerOpen(false);
        return;
      }
      const tf = tvIntervalToApiTimeframe(selectedInterval);
      const anchorTime = currentSessionTimeRef.current;

      // Cache resume — sync the cached target session to the user's
      // current replay cursor first, then bind the chart to it.
      const cached = sessionsBySymbolRef.current.get(symbol);
      if (cached) {
        try {
          if (anchorTime !== null) {
            await fetch(`${CHART_BACKEND_URL}/sessions/${cached}/seek`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target_time: anchorTime }),
            });
          }
        } catch {
          // Seek failure is non-fatal — the cached session keeps
          // whatever cursor it had. Worse: time drift between
          // markets. Better: not blocking the switch.
        }
        handleSessionSelected(cached, symbol, tf);
        setPickerOpen(false);
        return;
      }

      // First-visit path — spawn a shadow session anchored at the
      // user's current replay cursor (so the chart opens at the SAME
      // date, not a random one). is_shadow keeps it out of the Continue
      // list and earmarks it for cleanup on chart exit.
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            username,
            symbol,
            timeframe: tf,
            account_size: 50000,
            // anchorTime is the user's current replay cursor. Pass it
            // as start_time so the new session opens at the same date.
            // Falls back to null (random start) only when the primary
            // session hasn't surfaced a current_time yet, which only
            // happens on first chart mount before /sessions/{id} returns.
            start_time: anchorTime,
            is_shadow: true,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.session_id) throw new Error('Missing session_id');
        const srvSym = typeof data.symbol === 'string' ? data.symbol : symbol;
        const srvTf  = typeof data.timeframe === 'string' ? data.timeframe : tf;
        // handleSessionSelected writes the cache entry — no need to
        // duplicate that here.
        handleSessionSelected(data.session_id, srvSym, srvTf);
        setPickerOpen(false);
      } catch (err: any) {
        // DO NOT mutate selectedSymbol on failure — that would trigger
        // the session-load overwrite path (lines 377-379) and leave
        // the user in an inconsistent state. Leave the picker open so
        // they can retry or cancel out.
        Alert.alert(
          "Couldn't switch market",
          err?.message
            ? `Failed to switch to ${symbol}: ${err.message}`
            : `Failed to switch to ${symbol}.`,
        );
      }
    },
    [selectedSymbol, selectedInterval, uid, username, handleSessionSelected],
  );

  // Return to SessionsScreen from the chart — clears active session +
  // ALL trade state so we don't render stale chart lines / P&L the next
  // time the user picks a session.
  const handleReturnToSessions = useCallback(() => {
    // Finalize the session stats BEFORE wiping local state so the
    // session-end challenge engine sees the real numbers.
    const rec = useSessionStatsStore.getState().endSession();
    if (rec) detectAfterSessionEnd(rec);

    setSessionId(null);
    setSessionError(null);
    setSessionLoading(false);
    setPosition(null);
    setCurrentPrice(null);
    setDone(false);
    setAdvanceError(null);
    setTradeResult(null);
    lastBarRef.current = null;
    setCurrentBarTimeSec(null);
    chartRef.current?.clearTrade();

    // Backend cleanup — delete the sessions the picker auto-spawned
    // when the user browsed other markets via the watchlist. Without
    // this, those scratch sessions accumulate in the Continue list
    // and the user sees N sessions where they only ever intended to
    // start one. The session they CAME IN on (entrySessionIdRef) is
    // preserved — that's their real session.
    //
    // Fire-and-forget: failure here doesn't block navigation back.
    // The worst case is one stale session sticking around until the
    // backend's own cleanup picks it up.
    const entrySid = entrySessionIdRef.current;
    if (uid) {
      sessionsBySymbolRef.current.forEach((sid) => {
        if (sid === entrySid) return;
        fetch(
          `${CHART_BACKEND_URL}/sessions/${sid}?uid=${encodeURIComponent(uid)}`,
          { method: 'DELETE' },
        ).catch(() => {});
      });
    }
    sessionsBySymbolRef.current.clear();
    entrySessionIdRef.current = null;
  }, [uid]);

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
  // resolution is ALREADY `newInterval` and TV's datafeed has auto-invoked
  // getBars at the new resolution. The hosted getBars passes the resolution
  // as ?timeframe= on /sessions/{id}, so the backend resamples around the
  // SAME current_time at the new TF AND persists session.timeframe in one
  // race-free request. There's nothing this handler needs to do server-side
  // any more — just track the selected interval for our local UI state.
  //
  // Loop-safety: the hosted page subscribes to onIntervalChanged INSIDE
  // onChartReady (so the initial load doesn't re-emit) and the `=== selectedInterval`
  // guard below is a second line of defence — no switch loop.
  const handleIntervalChange = useCallback(
    async (newInterval: string) => {
      if (newInterval === selectedInterval) return;
      setSelectedInterval(newInterval);

      // RN's currentPrice / lastBarRef.time / currentBarTimeSec were
      // all seeded from the OLD TF's last-bar close (via session-load
      // or /advance). The chart-host independently re-fetches at the
      // new TF on intervalChanged, so the visual chart now shows a
      // possibly-different last close than RN remembers — symptom:
      // enter on 1h at 21,336, switch to 1m where the last 1m close
      // is 21,336.50, and RN's P&L stays $0 against the stale entry
      // even though the chart's "current price" disagrees.
      //
      // Fix: refetch the session at the new TF and re-seed RN from
      // the new last bar. Pass ?timeframe= explicitly so we don't
      // race the chart-host's getBars persisting the same field.
      if (!sessionId) return;
      try {
        const tf = tvIntervalToApiTimeframe(newInterval);
        const res = await fetch(
          `${CHART_BACKEND_URL}/sessions/${sessionId}?timeframe=${encodeURIComponent(tf)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        const candles: any[] = Array.isArray(data?.candles) ? data.candles : [];
        if (candles.length === 0) return;
        const last = candles[candles.length - 1];
        if (typeof last.close === 'number') {
          setCurrentPrice(last.close);
        }
        if (typeof last.time === 'number' && last.time > 0) {
          const idx = candles.length - 1;
          lastBarRef.current = { index: idx, time: last.time };
          setCurrentBarTimeSec(last.time);
        }
      } catch {
        // Non-fatal — the chart-host's own re-fetch will still update
        // the visual. RN just stays on the pre-switch price until the
        // next /advance.
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
    // Also drop the last-bar ref so a Buy/Sell tap before the new session
    // seeds can't read a stale index from the prior session's candles.
    setPosition(null);
    setQty(1);
    setTradeBusy(false);
    lastBarRef.current = null;
    setCurrentBarTimeSec(null);
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

        // Walk candles one at a time, pushing each to the chart and
        // checking against the open position's TP/SL on EACH bar (per
        // spec). If a level is hit, close at the fill price and stop
        // pushing further bars. Bars after the trigger stay unprocessed
        // — `done` is suppressed in that case so the user can continue
        // advancing them next tap.
        let hitInfo: {
          reason: 'tp' | 'sl';
          fillPrice: number;
          barIdxInBatch: number;
        } | null = null;
        let processedCount = 0;

        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          const bar: ChartBar = {
            time: c.time * 1000, // API unix seconds → TV ms
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          };
          chartRef.current?.pushBar(bar);
          processedCount += 1;

          // TP/SL hit check — only when the position is open. If BOTH
          // levels fall inside this bar's range, SL wins (worst-case
          // fill) per spec, hence the SL check runs first.
          if (position && position.status === 'open') {
            const tp = position.tpPrice;
            const sl = position.slPrice;
            const high = Number(c.high);
            const low = Number(c.low);
            let detected: 'tp' | 'sl' | null = null;
            if (position.side === 'long') {
              if (sl != null && low <= sl) {
                hitInfo = { reason: 'sl', fillPrice: sl, barIdxInBatch: i };
                detected = 'sl';
              } else if (tp != null && high >= tp) {
                hitInfo = { reason: 'tp', fillPrice: tp, barIdxInBatch: i };
                detected = 'tp';
              }
            } else {
              // SHORT
              if (sl != null && high >= sl) {
                hitInfo = { reason: 'sl', fillPrice: sl, barIdxInBatch: i };
                detected = 'sl';
              } else if (tp != null && low <= tp) {
                hitInfo = { reason: 'tp', fillPrice: tp, barIdxInBatch: i };
                detected = 'tp';
              }
            }
            // eslint-disable-next-line no-console
            console.log(
              `[tpsl-fill] bar ${i + 1}/${candles.length} side=${position.side}`
                + ` entry=${position.entryPrice} tp=${tp ?? 'null'} sl=${sl ?? 'null'}`
                + ` h=${high} l=${low} c=${c.close} hit=${detected ?? 'no'}`,
            );
            if (hitInfo) break;
          } else {
            // eslint-disable-next-line no-console
            console.log(
              `[tpsl-fill] bar ${i + 1}/${candles.length} no-open-position`
                + ` (positionPresent=${!!position} status=${position?.status ?? 'n/a'})`,
            );
          }
        }

        // Track the current revealed price = the last newly-revealed close.
        // This drives the live unrealized P&L readout (recomputed on render).
        const lastProcessed =
          processedCount > 0 ? candles[processedCount - 1] : null;
        const newPrice = lastProcessed ? lastProcessed.close : currentPrice;
        if (lastProcessed) {
          setCurrentPrice(lastProcessed.close);
          // Advance the last-bar pointer so a Buy/Sell tap right after
          // this /advance captures the bar that just landed.
          const prevIdx = lastBarRef.current?.index ?? -1;
          const newBarTime =
            typeof lastProcessed.time === 'number' ? lastProcessed.time : 0;
          lastBarRef.current = {
            index: prevIdx + processedCount,
            time: newBarTime,
          };
          setCurrentBarTimeSec(newBarTime || null);
        }

        // Auto-close on TP/SL hit. Close at the FILL PRICE (not the
        // bar's close) and flash the realized P&L like the manual close
        // path. Bars after the trigger were intentionally not pushed.
        // `closedThisAdvance` GATES the P&L-refresh block below so we
        // don't re-show the pill we just cleared (that's the bug that
        // made TP/SL appear to "snap back to the line" — the legacy
        // refresh fired ptShowPosition right after clearTrade and the
        // chart-host happily re-created the pill + reset chips to unset).
        let closedThisAdvance = false;
        if (hitInfo && position && position.status === 'open') {
          const realized = computePnl({
            side: position.side,
            entryPrice: position.entryPrice,
            currentPrice: hitInfo.fillPrice,
            contracts: position.contracts,
            symbol: position.symbol,
          });
          const pointsMove =
            position.side === 'long'
              ? hitInfo.fillPrice - position.entryPrice
              : position.entryPrice - hitInfo.fillPrice;

          // Hold-duration + R-multiple challenge inputs.
          // opened_at: bar time captured at position open.
          // closed_at: bar time of the candle that triggered the
          //            TP/SL fill (c.time from the hitInfo loop).
          // r_multiple: signed realized R = pointsMove / |entry - SL|.
          //            Undefined when no SL was set (no R reference).
          const closeBarTime =
            typeof candles[hitInfo.barIdxInBatch]?.time === 'number'
              ? candles[hitInfo.barIdxInBatch].time
              : 0;
          let rMultiple: number | undefined;
          if (position.slPrice != null) {
            const riskPoints = Math.abs(position.entryPrice - position.slPrice);
            if (riskPoints > 0) rMultiple = pointsMove / riskPoints;
          }

          // ── STATS FIRST ────────────────────────────────────────────
          // Same reasoning as the manual closePosition path: fire the
          // challenge detection + session-stats overlay BEFORE the
          // async captures so a slow / failing capture can't strand
          // the trade out of the Continue card's perSession overlay.
          const tradeId = `local-${Date.now()}`;
          detectAfterTradeClose(
            {
              id: tradeId,
              symbol: position.symbol,
              pnl: realized,
              opened_at: position.entryBarTime,
              closed_at: closeBarTime,
              r_multiple: rMultiple,
              stop_loss: position.slPrice ?? null,
              take_profit: position.tpPrice ?? null,
            },
            selectedInterval,
          );
          useSessionStatsStore.getState().recordTradeClose({
            pnl: realized,
            hadStop: position.slPrice != null,
            hadTp:   position.tpPrice != null,
          });

          // ── CAPTURES ───────────────────────────────────────────────
          // Two captures, both fault-tolerant:
          //   cleanChartUri    — chart with NO overlay markers
          //                      (journal entry attachment)
          //   shareCardImageUri — polished 4:5 trade-card composite
          //                      (Share button output)
          let cleanChartUri: string | null = null;
          let cardImageUri:  string | null = null;
          try {
            cleanChartUri = await captureChartScreenshot({ noOverlays: true });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[tpsl-fill] clean chart capture failed:', e);
          }
          try {
            cardImageUri = await captureTradeCardImage({
              side: position.side,
              symbol: position.symbol,
              qty: position.contracts,
              entryPrice: position.entryPrice,
              exitPrice: hitInfo.fillPrice,
              pnlUsd: realized,
              pointsMove,
              returnPct: 0,
              reason: hitInfo.reason,
              closedAtMs: Date.now(),
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[tpsl-fill] trade card capture failed:', e);
          }

          setPosition(null);
          chartRef.current?.clearTrade();
          closedThisAdvance = true;
          const reasonLabel = hitInfo.reason === 'tp' ? 'TP' : 'SL';
          flashResult(
            `${reasonLabel} hit · ${realized >= 0 ? '+' : '-'}$${Math.abs(realized).toFixed(2)}`,
          );
          const cardData = {
            cleanChartUri,
            shareCardImageUri: cardImageUri,
            side: position.side,
            symbol: position.symbol,
            qty: position.contracts,
            entryPrice: position.entryPrice,
            exitPrice: hitInfo.fillPrice,
            pnlUsd: realized,
            pointsMove,
            returnPct: 0,
            reason: hitInfo.reason,
            closedAtMs: Date.now(),
          };
          // Respect the user's "show trade-result card" setting.
          // When off, the trade still records + the toast flashes —
          // we just skip the modal.
          if (useSettingsStore.getState().tradeResultCardEnabled) {
            setTradeResultCard(cardData);
          }
          // Stats refresh — see manual-close path for rationale.
          recordClosedTradeAsJournalEntry(cardData, {
            slPrice: position.slPrice,
            tpPrice: position.tpPrice,
            entryBarTime: position.entryBarTime,
          });

          // eslint-disable-next-line no-console
          console.log(
            `[tpsl-fill] CLOSED reason=${hitInfo.reason} fillPrice=${hitInfo.fillPrice}`
              + ` realized=${realized.toFixed(2)} entry=${position.entryPrice}`
              + ` side=${position.side} qty=${position.contracts}`,
          );
        }

        // auto_closed comes from the legacy backend trade flow. We're now
        // session-local — no backend position exists, so this should
        // always be empty for our open positions. Left intact so the
        // replay engine itself isn't disturbed. Log only.
        const autoClosed: any[] = Array.isArray(data?.auto_closed) ? data.auto_closed : [];
        if (autoClosed.length > 0) {
          // eslint-disable-next-line no-console
          console.log('[advance] auto_closed (ignored — local-only positions)', autoClosed);
        }

        // Refresh the chart's position line P&L using the shared math
        // helper so the on-chart line and the readout below agree.
        // Gated by !closedThisAdvance — otherwise we'd re-show the pill
        // immediately after auto-close-driven clearTrade and the chips
        // would visually snap back to their unset state.
        if (!closedThisAdvance && position && position.status === 'open' && newPrice != null) {
          const pnl = computePnl({
            side: position.side,
            entryPrice: position.entryPrice,
            currentPrice: newPrice,
            contracts: position.contracts,
            symbol: position.symbol,
          });
          chartRef.current?.showPosition({
            side: position.side === 'long' ? 'buy' : 'sell',
            qty: position.contracts,
            entry: position.entryPrice,
            pnl,
            pointValue: POINT_VALUE[position.symbol] ?? 1,
          });
        }

        // Only flip end-of-data when we actually processed every bar
        // the server sent. A TP/SL hit can leave unprocessed bars in
        // the batch; we don't want to permanently disable Next Bar
        // when those bars are still pending.
        if (data?.done === true && processedCount === candles.length) {
          setDone(true);
        }
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

  // Phase 3C/B: jump the replay forward to the next wall-clock time (in the
  // user's chosen tz) matching one of the three session opens. Phase A had
  // hardcoded NY=09:30 ET / London=03:00 ET / Asia=20:00 ET; Phase B reads
  // both the HH:MM and the IANA tz from `useSessionTimesStore`, so the same
  // dropdown can mean "09:30 LONDON" or "09:30 TOKYO" without changing the
  // backend contract. Backend still handles DST + weekend/holiday roll-forward
  // + auto-close walking across the jumped range; we just refresh the chart
  // via resetData() so it re-fetches the visible window at the new cursor
  // (Path B). Mirrors /advance's auto_closed handling so a TP/SL hit during
  // the jump correctly clears the position + flashes the realized P&L.
  const handleSessionJump = useCallback(
    async (label: 'NY' | 'London' | 'Asia') => {
      if (!sessionId || jumping) return;
      const targets = {
        NY:     sessionNewYork,
        London: sessionLondon,
        Asia:   sessionAsia,
      } as const;
      setSessionMenuOpen(false);
      setJumping(true);
      setJumpError(null);
      try {
        const t = targets[label];
        const res = await fetch(`${CHART_BACKEND_URL}/sessions/${sessionId}/seek_session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_hh: t.hh, target_mm: t.mm, tz: sessionTz }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data?.success) {
          // Backend rolled off the end of data, or target already revealed.
          flashJumpError(`Could not jump to ${label}`);
          return;
        }

        // Auto-close from the backend is no longer relevant — positions
        // are session-local and unknown to the server. Logged only so we
        // can still see what the replay engine reports during jumps.
        const autoClosed: any[] = Array.isArray(data?.auto_closed) ? data.auto_closed : [];
        if (autoClosed.length > 0) {
          // eslint-disable-next-line no-console
          console.log('[trade] auto_closed during jump (ignored — local-only positions)', autoClosed);
        }

        // Path B refresh — let the chart re-fetch the new visible window at
        // the session's stored TF via the existing TF-aware getBars path.
        // No per-bar pushBar walk; scales cleanly to multi-day jumps.
        chartRef.current?.resetData();

        // The jump moved the replay cursor forward by potentially many
        // bars, but did NOT push individual bars through the advance
        // loop, so lastBarRef + currentPrice + currentBarTimeSec are
        // all stale. Bumping sessionAttempt re-runs the session-load
        // effect (keyed on [sessionId, sessionAttempt, uid]) which
        // GETs /sessions/{id}, reads the new last revealed candle,
        // and writes all three back from a single source of truth.
        // Without this, the News panel would keep showing the
        // pre-jump ET date because currentBarTimeSec hadn't moved.
        setSessionAttempt((n) => n + 1);

        // A successful jump invalidates the end-of-data flag and any prior
        // advance error — the cursor moved, Next Bar should be live again.
        setDone(false);
        setAdvanceError(null);
      } catch (err: any) {
        flashJumpError(`Could not jump to ${label}`);
      } finally {
        setJumping(false);
      }
    },
    [
      sessionId,
      jumping,
      position,
      flashResult,
      flashJumpError,
      sessionTz,
      sessionNewYork,
      sessionLondon,
      sessionAsia,
    ],
  );

  // Open a session-local position at the EXACT current revealed price.
  // Buy = 'long', Sell = 'short'. One-at-a-time gate: ignored if a
  // position is already open or we don't yet have a price.
  //
  // NO BACKEND CALL — the legacy POST /sessions/{id}/trade path has
  // been removed for this step. The mechanic lives in React state only;
  // a new session resets it.
  const openPosition = useCallback(
    (side: 'buy' | 'sell') => {
      if (!sessionId || position || currentPrice == null) return;
      setAdvanceError(null);

      const sidePos: 'long' | 'short' = side === 'buy' ? 'long' : 'short';
      const last = lastBarRef.current;
      const newPos: SessionPosition = {
        tpPrice: null,
        slPrice: null,
        side: sidePos,
        entryPrice: currentPrice,
        contracts: qty,
        symbol: selectedSymbol,
        status: 'open',
        exitPrice: null,
        realizedPnl: null,
        entryBarIndex: last?.index ?? 0,
        entryBarTime: last?.time ?? 0,
      };
      setPosition(newPos);

      // Draw the position line on the chart at entry (P&L starts at 0).
      // No-op gracefully if the line API is gated.
      chartRef.current?.showPosition({
        side,
        qty,
        entry: currentPrice,
        pnl: 0,
        pointValue: POINT_VALUE[selectedSymbol] ?? 1,
      });
    },
    [sessionId, position, currentPrice, qty, selectedSymbol],
  );

  // Async helper that triggers a chart screenshot via the WebView bridge,
  // waits up to 1.5s for the chart-host to post a `chartScreenshot`
  // message back, decodes the base64 JPEG dataURL into a temp file via
  // expo-file-system, and returns the file:// URI. Returns null on any
  // failure (capture rejected, taint, timeout, write error). The temp
  // file lives in the app's cache and is overwritten on the next call.
  //
  // Why a file URI and not the dataURL directly:
  //   - `<Image source={{uri: dataURI}} />` and `Share.share` accept
  //     dataURIs, but `expo-sharing.shareAsync` requires a file path,
  //     and persisting dataURIs in the journal store would bloat
  //     AsyncStorage. A real file is the universal handle.
  const captureChartScreenshot = useCallback(async (
    opts?: { exitPrice?: number; noOverlays?: boolean },
  ): Promise<string | null> => {
    // Resolve any previous pending capture before starting a new one —
    // safety against overlapping closes.
    if (pendingChartShot.current) {
      try { pendingChartShot.current(null); } catch { /* noop */ }
      pendingChartShot.current = null;
    }

    const dataURL = await new Promise<string | null>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (pendingChartShot.current) {
          pendingChartShot.current = null;
          resolve(null);
        }
      }, 1500);
      pendingChartShot.current = (uri) => {
        clearTimeout(timeoutId);
        pendingChartShot.current = null;
        resolve(uri);
      };
      try {
        chartRef.current?.captureChartImage(opts);
      } catch {
        clearTimeout(timeoutId);
        pendingChartShot.current = null;
        resolve(null);
      }
    });

    if (!dataURL) return null;
    // dataURL format: "data:image/jpeg;base64,<...>"
    const commaIdx = dataURL.indexOf(',');
    if (commaIdx < 0) return null;
    const base64 = dataURL.slice(commaIdx + 1);
    const filename = `trade-${Date.now()}.jpg`;
    const path = `${FileSystem.cacheDirectory ?? ''}${filename}`;
    try {
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return path;
    } catch {
      return null;
    }
  }, []);

  // Parallel to captureChartScreenshot — triggers the polished 4:5
  // trade-card composite the chart-host renders, writes the dataURL
  // to a temp file, returns the file path. Used as the SHARE image
  // (and the journal entry's auto-attached image, since the card
  // embeds the chart-with-overlays inside).
  const captureTradeCardImage = useCallback(
    async (cardData: {
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
    }): Promise<string | null> => {
      if (pendingTradeCardShot.current) {
        try { pendingTradeCardShot.current(null); } catch { /* noop */ }
        pendingTradeCardShot.current = null;
      }
      const dataURL = await new Promise<string | null>((resolve) => {
        const timeoutId = setTimeout(() => {
          if (pendingTradeCardShot.current) {
            pendingTradeCardShot.current = null;
            resolve(null);
          }
        }, 2000);
        pendingTradeCardShot.current = (uri) => {
          clearTimeout(timeoutId);
          pendingTradeCardShot.current = null;
          resolve(uri);
        };
        try {
          chartRef.current?.captureTradeCard(cardData);
        } catch {
          clearTimeout(timeoutId);
          pendingTradeCardShot.current = null;
          resolve(null);
        }
      });

      if (!dataURL) return null;
      const commaIdx = dataURL.indexOf(',');
      if (commaIdx < 0) return null;
      const base64 = dataURL.slice(commaIdx + 1);
      const filename = `card-${Date.now()}.jpg`;
      const path = `${FileSystem.cacheDirectory ?? ''}${filename}`;
      try {
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return path;
      } catch {
        return null;
      }
    },
    [],
  );

  // Auto-write a journal entry for every closed trade so the Stats
  // screen (equity, win rate, profit factor, etc.) updates after EVERY
  // trade — not just when the user taps "Journal Trade" on the result
  // card. Without this, dismissing the card without journaling would
  // leave the trade invisible to journalStore-driven metrics.
  //
  // addEntry de-dupes by tradeId, so the "Journal Trade" button still
  // works — it navigates to the same tradeId and EntryEditModal opens
  // the already-existing entry for emotion/notes/grade.
  //
  // Position info (sl/tp price + entry bar time) is passed in directly
  // so the journal entry has accurate stops/targets and open time —
  // not just the close-time fallbacks the TradeResultCard data carried.
  const recordClosedTradeAsJournalEntry = useCallback(
    (
      d: NonNullable<typeof tradeResultCard>,
      pos: { slPrice: number | null; tpPrice: number | null; entryBarTime: number },
    ) => {
      const tradeId = `local-${d.closedAtMs}`;
      const openedAtMs = pos.entryBarTime > 0 ? pos.entryBarTime * 1000 : d.closedAtMs;
      const entry: JournalEntry = {
        id: tradeId,
        tradeId,
        symbol: d.symbol,
        side: d.side === 'long' ? 'buy' : 'sell',
        lots: d.qty,
        entryPrice: d.entryPrice,
        exitPrice: d.exitPrice,
        stopLoss: pos.slPrice,
        takeProfit: pos.tpPrice,
        pnl: d.pnlUsd,
        rMultiple: null,
        rrAchieved: null,
        riskAmount: null,
        openedAt: openedAtMs,
        closedAt: d.closedAtMs,
        planSetupType: null,
        planStopPrice: null,
        planTargetPrice: null,
        planSkipped: true,
        setupId: null,
        rating: null,
        checklistPassed: false,
        checklistSkipped: true,
        intendedStop: 0,
        intendedTarget: 0,
        positionSize: d.qty,
        intendedRisk: 0,
        intendedRR: 0,
        notes: '',
        mistakes: '',
        wentWell: '',
        emotion: null,
        confidence: null,
        strategy: '',
        tags: [
          d.reason === 'tp' ? 'tp-hit'
            : d.reason === 'sl' ? 'sl-hit'
            : 'manual-close',
        ],
        savedAt: Date.now(),
        imageUri: d.cleanChartUri,
      };
      useJournalStore.getState().addEntry(entry);
    },
    [],
  );

  // Close the open position session-locally. Captures exitPrice from
  // currentPrice and computes realizedPnl via the shared helper so the
  // value matches what the live readout was showing one tick ago. Then
  // clears the position back to null so Buy/Sell re-enable.
  const closePosition = useCallback(async () => {
    if (!position || currentPrice == null) return;
    const realized = computePnl({
      side: position.side,
      entryPrice: position.entryPrice,
      currentPrice,
      contracts: position.contracts,
      symbol: position.symbol,
    });
    const pointsMove =
      position.side === 'long'
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;

    // Hold-duration + R-multiple challenge inputs.
    // opened_at: bar time captured at position open.
    // closed_at: bar time of the latest revealed candle (best
    //            available proxy for "now" on the replay clock).
    // r_multiple: signed realized R = pointsMove / |entry - SL|.
    //            Undefined when no SL was set.
    const closeBarTime = lastBarRef.current?.time ?? 0;
    let rMultiple: number | undefined;
    if (position.slPrice != null) {
      const riskPoints = Math.abs(position.entryPrice - position.slPrice);
      if (riskPoints > 0) rMultiple = pointsMove / riskPoints;
    }

    // ── STATS FIRST ─────────────────────────────────────────────────
    // Fire the side-effects that MUST happen on close (challenge
    // detection + session-stats overlay for the SessionsScreen
    // Continue card) BEFORE the async chart-host captures below.
    // Earlier this lived after both `await captureChartScreenshot`
    // and `await captureTradeCardImage` — if either rejected (slow
    // tunnel, WebView remount mid-capture, chart-host not responding),
    // the recordTradeClose never ran and the trade was lost from the
    // Continue card's "N trades / $X" overlay even though the user
    // saw it close. Moving these up makes stats independent of the
    // image pipeline.
    const tradeId = `local-${Date.now()}`;
    detectAfterTradeClose(
      {
        id: tradeId,
        symbol: position.symbol,
        pnl: realized,
        opened_at: position.entryBarTime,
        closed_at: closeBarTime,
        r_multiple: rMultiple,
        stop_loss: position.slPrice ?? null,
        take_profit: position.tpPrice ?? null,
      },
      selectedInterval,
    );
    useSessionStatsStore.getState().recordTradeClose({
      pnl: realized,
      hadStop: position.slPrice != null,
      hadTp:   position.tpPrice != null,
    });

    // ── CAPTURES ────────────────────────────────────────────────────
    // Both captures need to land BEFORE setPosition(null) — they read
    // overlay markers that get wiped by clearTrade. Wrap each in
    // try/catch so a failure produces null instead of rejecting,
    // letting the trade close + result card render cleanly.
    let cleanChartUri: string | null = null;
    let cardImageUri:  string | null = null;
    try {
      cleanChartUri = await captureChartScreenshot({ noOverlays: true });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[closePosition] clean chart capture failed:', e);
    }
    try {
      cardImageUri = await captureTradeCardImage({
        side: position.side,
        symbol: position.symbol,
        qty: position.contracts,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        pnlUsd: realized,
        pointsMove,
        returnPct: 0,
        reason: 'manual',
        closedAtMs: Date.now(),
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[closePosition] trade card capture failed:', e);
    }

    // Single-frame transition: clear immediately so Buy/Sell re-enable
    // (per the spec — "lives during the session, clears on close").
    setPosition(null);
    chartRef.current?.clearTrade();
    flashResult(`Closed ${realized >= 0 ? '+' : '-'}$${Math.abs(realized).toFixed(2)}`);
    const cardData = {
      cleanChartUri,
      shareCardImageUri: cardImageUri,
      side: position.side,
      symbol: position.symbol,
      qty: position.contracts,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnlUsd: realized,
      pointsMove,
      returnPct: 0,
      reason: 'manual' as const,
      closedAtMs: Date.now(),
    };
    // Respect the user's "show trade-result card" setting. When off,
    // the trade still records + the toast flashes — we just skip the
    // modal.
    if (useSettingsStore.getState().tradeResultCardEnabled) {
      setTradeResultCard(cardData);
    }
    // Stats refresh — journal entry created BEFORE the user touches
    // the result card so the Stats screen updates whether they tap
    // Journal Trade, share, or just dismiss.
    recordClosedTradeAsJournalEntry(cardData, {
      slPrice: position.slPrice,
      tpPrice: position.tpPrice,
      entryBarTime: position.entryBarTime,
    });
  }, [position, currentPrice, flashResult, selectedInterval, recordClosedTradeAsJournalEntry]);

  // Bridge events from the hosted chart lines. tpMoved/slMoved come
  // from the chart-host when the user drops a TP/SL drag chip; we
  // store the price on the SessionPosition only — no auto-fill logic
  // yet (that's the next step).
  const onLineMessage = useCallback(
    (msg: ChartLineMessage) => {
      if (msg.type === 'closePosition') {
        closePosition();
      } else if (msg.type === 'lineApiStatus') {
        if (!msg.ok) {
          // eslint-disable-next-line no-console
          console.warn('[TVChart] line API unavailable (gated):', msg.detail);
          setLineApiUnavailable(true);
        } else {
          setLineApiUnavailable(false);
        }
      } else if (msg.type === 'tpMoved') {
        setPosition((prev) => (prev ? { ...prev, tpPrice: msg.price } : prev));
      } else if (msg.type === 'slMoved') {
        setPosition((prev) => (prev ? { ...prev, slPrice: msg.price } : prev));
      } else if (msg.type === 'tpCleared') {
        setPosition((prev) => (prev ? { ...prev, tpPrice: null } : prev));
      } else if (msg.type === 'slCleared') {
        setPosition((prev) => (prev ? { ...prev, slPrice: null } : prev));
      } else if (msg.type === 'chartScreenshot') {
        // Hand off to whoever called captureChartScreenshot(). The
        // dataURL is forwarded as-is; the helper turns it into a file.
        const resolver = pendingChartShot.current;
        if (resolver) {
          pendingChartShot.current = null;
          resolver(msg.dataURL);
        }
      } else if (msg.type === 'tradeCardImage') {
        const resolver = pendingTradeCardShot.current;
        if (resolver) {
          pendingTradeCardShot.current = null;
          resolver(msg.dataURL);
        }
      }
    },
    [closePosition],
  );

  // One-at-a-time gate: Buy/Sell + the stepper are disabled while a position
  // is open. The open/close paths are synchronous now (session-local), so the
  // legacy `tradeBusy` flag is purely a noop guard.
  const tradeDisabled = !!position || tradeBusy || currentPrice == null;

  // Live unrealized P&L — recomputed every render. Re-fires whenever
  // currentPrice changes (every /advance) so the readout below stays
  // in lock-step with the chart.
  const livePnl = useMemo(() => {
    if (!position || position.status !== 'open' || currentPrice == null) return null;
    return computePnl({
      side: position.side,
      entryPrice: position.entryPrice,
      currentPrice,
      contracts: position.contracts,
      symbol: position.symbol,
    });
  }, [position, currentPrice]);
  const livePointMove = useMemo(() => {
    if (!position || position.status !== 'open' || currentPrice == null) return null;
    return position.side === 'long'
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;
  }, [position, currentPrice]);

  // Entry point: when there's no active session selected, the Chart
  // tab shows the SessionsScreen (Continue list + New Session CTA).
  // ChartScreen owns the activeSessionId state itself rather than
  // pushing a separate route on a stack — keeps all session-driven
  // state (currentPrice, position, sessionLoading, etc.) co-located
  // with the chart UI that consumes it, and avoids re-architecting
  // App.tsx's stack to introduce a nested navigator under the Chart
  // tab. Tapping the header "Sessions" button below clears
  // sessionId and brings us back here.
  if (uid && !sessionId && !sessionLoading && !sessionError) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <SessionsScreen onSessionSelected={handleSessionSelected} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.symbol}>{selectedSymbol}</Text>
        <View style={styles.headerActions}>
          {/* Return to SessionsScreen. Only shown once a session is
              loaded so the user can swap between sessions or start a
              new one without backing all the way out of the tab. */}
          <Pressable
            onPress={handleReturnToSessions}
            disabled={!sessionId}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.headerIconBtn, !sessionId && styles.headerIconBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Sessions"
          >
            <Ionicons name="layers-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <Pressable
            onPress={() => setNewsOpen(true)}
            disabled={!sessionId}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.headerIconBtn,
              !sessionId && styles.headerIconBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="News for current replay day"
          >
            <Ionicons name="newspaper-outline" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>

          <Pressable
            onPress={() => setSessionMenuOpen(true)}
            disabled={!sessionId || jumping}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.headerIconBtn, (jumping || !sessionId) && styles.headerIconBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Jump to session"
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
                Priority: jumpError > advanceError > tradeResult (realized
                close/TP/SL) > jumping caption > lineApiUnavailable note >
                end-of-session. */}
            {(jumpError || advanceError || tradeResult || jumping || lineApiUnavailable || done) && (
              <View style={styles.statusStrip}>
                {jumpError ? (
                  <Text style={styles.advanceErrorText} numberOfLines={1}>
                    {jumpError}
                  </Text>
                ) : advanceError ? (
                  <Text style={styles.advanceErrorText} numberOfLines={1}>
                    {advanceError}
                  </Text>
                ) : jumping ? (
                  <Text style={styles.endOfSessionText} numberOfLines={1}>
                    Jumping…
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
                ) : (
                  <Text style={styles.endOfSessionText} numberOfLines={1}>
                    End of session
                  </Text>
                )}
              </View>
            )}

            {/* Live P&L readout — only rendered while a session-local
                position is open. Recomputes every render (every bar
                advance updates currentPrice → useMemo recomputes →
                this Text re-renders). Side · contracts × symbol @ entry
                on the left; dollar P&L (green/red) + point move on the
                right. Color is white when flat, green > 0, red < 0. */}
            {position && position.status === 'open' && livePnl != null && (
              <View style={styles.pnlReadout}>
                <Text style={styles.pnlReadoutMeta} numberOfLines={1}>
                  <Text
                    style={[
                      styles.pnlReadoutSide,
                      { color: position.side === 'long' ? colors.green : colors.red },
                    ]}
                  >
                    {position.side === 'long' ? 'LONG' : 'SHORT'}
                  </Text>
                  {'  ·  '}
                  {position.contracts} {position.symbol} @{' '}
                  {position.entryPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <View style={styles.pnlReadoutRight}>
                  <Text
                    style={[
                      styles.pnlReadoutValue,
                      {
                        // Flat (livePnl === 0) reads as muted secondary
                        // text — green for 0 makes the user think
                        // they're already in profit. Green ONLY for
                        // strictly positive, red ONLY for negative.
                        color:
                          livePnl > 0
                            ? colors.green
                            : livePnl < 0
                              ? colors.red
                              : colors.textSecondary,
                      },
                    ]}
                  >
                    {livePnl > 0 ? '+' : livePnl < 0 ? '-' : ''}$
                    {Math.abs(livePnl).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                  {livePointMove != null && (
                    <Text style={styles.pnlReadoutPoints}>
                      {/* Zero is unsigned; toFixed handles negative sign natively. */}
                      {livePointMove > 0 ? '+' : ''}
                      {livePointMove.toFixed(2)} pt
                    </Text>
                  )}
                </View>
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
        onSelect={handlePickerSelect}
        onClose={() => setPickerOpen(false)}
      />

      {/* Phase 3C: Sessions dropdown — small popup anchored top-right under
          the header icon row. Three rows (NY / London / Asia) with the
          hardcoded ET wall-clock subtitle. Modal + backdrop dismiss; the
          dropdown shape (vs full bottom-sheet) is appropriate for three
          items. Brand-locked surfaces — surface.l3 + borders.card. */}
      <Modal
        visible={sessionMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionMenuOpen(false)}
      >
        <Pressable style={styles.sessionMenuBackdrop} onPress={() => setSessionMenuOpen(false)}>
          {/* Inner pressable swallows taps on the popup itself so the backdrop
              dismiss doesn't fire when the user taps inside the menu. */}
          <Pressable style={styles.sessionMenu} onPress={() => {}}>
            <Pressable
              style={({ pressed }) => [styles.sessionMenuRow, pressed && styles.sessionMenuRowPressed]}
              onPress={() => handleSessionJump('NY')}
              accessibilityRole="button"
              accessibilityLabel="Jump to New York open"
            >
              <Text style={styles.sessionMenuLabel}>New York</Text>
              <Text style={styles.sessionMenuSub}>
                {pad2(sessionNewYork.hh)}:{pad2(sessionNewYork.mm)}
              </Text>
            </Pressable>
            <View style={styles.sessionMenuDivider} />
            <Pressable
              style={({ pressed }) => [styles.sessionMenuRow, pressed && styles.sessionMenuRowPressed]}
              onPress={() => handleSessionJump('London')}
              accessibilityRole="button"
              accessibilityLabel="Jump to London open"
            >
              <Text style={styles.sessionMenuLabel}>London</Text>
              <Text style={styles.sessionMenuSub}>
                {pad2(sessionLondon.hh)}:{pad2(sessionLondon.mm)}
              </Text>
            </Pressable>
            <View style={styles.sessionMenuDivider} />
            <Pressable
              style={({ pressed }) => [styles.sessionMenuRow, pressed && styles.sessionMenuRowPressed]}
              onPress={() => handleSessionJump('Asia')}
              accessibilityRole="button"
              accessibilityLabel="Jump to Asia open"
            >
              <Text style={styles.sessionMenuLabel}>Asia</Text>
              <Text style={styles.sessionMenuSub}>
                {pad2(sessionAsia.hh)}:{pad2(sessionAsia.mm)}
              </Text>
            </Pressable>
            {/* Phase B: trailing "Edit session times" row opens the config
                sheet. Closes the dropdown first so the two modals don't
                stack visually. */}
            <View style={styles.sessionMenuDivider} />
            <Pressable
              style={({ pressed }) => [styles.sessionMenuRow, pressed && styles.sessionMenuRowPressed]}
              onPress={() => {
                setSessionMenuOpen(false);
                setTzModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit session times"
            >
              <Text style={styles.sessionMenuLabel}>⚙ Edit session times</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <SessionTimesConfigModal
        visible={tzModalVisible}
        onClose={() => setTzModalVisible(false)}
      />

      {/* TP/SL toast — superseded by TradeResultCard for closes but
          kept rendered so the existing `fillToast` state can still
          be set in the future for non-close events (currently never
          set; safe no-op until then). */}
      <TradeFillToast
        data={fillToast}
        onDismiss={() => setFillToast(null)}
      />

      {/* Trade-result card — appears centered after every position close
          (manual, TP, or SL). The Share button image-captures the card
          on supported builds and falls back to RN Share's text flow if
          react-native-view-shot isn't linked (Expo Go). The Journal Trade
          button persists a journal entry pre-filled with the trade data
          AND navigates to the Journal tab with openEntryId set — the
          screen's existing route-param flow then opens EntryEditModal on
          that entry so the user can log emotion / notes / a screenshot. */}
      <TradeResultCard
        data={tradeResultCard}
        onDismiss={() => setTradeResultCard(null)}
        onJournal={() => {
          const d = tradeResultCard;
          if (!d) return;
          // The journal entry was already created at trade-close time
          // by `recordClosedTradeAsJournalEntry` so the Stats screen
          // updates even when the user just dismisses the card. The
          // "Journal Trade" button here is now purely a navigation
          // shortcut — open EntryEditModal on the existing entry so
          // the user can add emotion / notes / a screenshot / rating.
          const tradeId = `local-${d.closedAtMs}`;
          setTradeResultCard(null);
          try {
            navigation.navigate('Journal', { openEntryId: tradeId });
          } catch {
            /* non-fatal */
          }
        }}
      />

      {/* News panel — slides up over the chart with the day's USD
          economic events. Derives the date from the current replay
          bar's unix-seconds, fetches /news, and splits past vs
          upcoming relative to that same clock. Re-fetches on day
          rollover; past/upcoming re-evaluates on every advance. */}
      <NewsPanel
        visible={newsOpen}
        onClose={() => setNewsOpen(false)}
        currentBarTimeSec={currentBarTimeSec}
      />
    </SafeAreaView>
  );
}

/** Two-digit zero-padded integer ("09", "30", "20"). Module-local so the
 *  dropdown rows don't recreate it on every render. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
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
  // Mid-jump: dim the Session icon so it visually disables. Matches the
  // generic actionBtnDisabled opacity used by the bottom action row.
  headerIconBtnDisabled: {
    opacity: 0.4,
  },
  // ── Phase 3C: Sessions dropdown ────────────────────────────────────────
  // Backdrop matches SymbolPickerSheet's 0.6-black scrim. The menu itself
  // anchors near the top-right (under the header icon row); the outer
  // backdrop Pressable uses flex-start + flex-end to position it. Brand-
  // locked: surface.l3 surface, borders.card outline, no raw hex.
  sessionMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 56,        // clear the SafeArea + header (≈56pt to the icon row baseline)
    paddingRight: 12,
  },
  sessionMenu: {
    minWidth: 180,
    backgroundColor: surface.l3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borders.card,
    overflow: 'hidden',
  },
  sessionMenuRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sessionMenuRowPressed: {
    backgroundColor: colors.cardAlt,
  },
  sessionMenuLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Subtitle = the hardcoded ET wall-clock for Phase A. Phase B can swap
  // this for user-configurable times without touching the layout.
  sessionMenuSub: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  sessionMenuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: borders.hairline,
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
  // Live unrealized P&L readout — only mounted while a position is open.
  // Two-column layout: meta on the left, dollar value + point move on the
  // right. Sized to slot above the action row without pushing the chart.
  pnlReadout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 12,
  },
  pnlReadoutMeta: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pnlReadoutSide: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pnlReadoutRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  pnlReadoutValue: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  pnlReadoutPoints: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Full-width bottom action row — a real layout sibling below the chart,
  // above the app tab bar. Sell / Buy / Next Bar flex equally; FF is fixed.
  // On narrow Androids (≤360dp) we tighten gap + padding so the 3 flexed
  // buttons keep enough width to display their labels.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NARROW_PHONE ? 6 : 8,
    paddingHorizontal: NARROW_PHONE ? 10 : 16,
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

  // Contract-quantity stepper — fixed compact width so the flexed
  // Sell/Buy/Next Bar cells share the rest. Matches the action-row height.
  // Narrow phones get a tighter 72dp variant to free up ~16dp for the
  // flexed buttons' labels.
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: NARROW_PHONE ? 72 : 88,
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
