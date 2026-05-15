import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Modal, Pressable, TextInput,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TradingChart, { DEFAULT_CHART_THEME, ChartTheme } from '../components/chart/TradingChart';
import ChartSettingsModal from '../components/chart/ChartSettingsModal';
import WheelPickerModal, { WheelHandle, WheelAnchor } from '../components/WheelPickerModal';
import DrawingToolbar from '../components/chart/DrawingToolbar';
import DrawingSettingsModal from '../components/chart/DrawingSettingsModal';
import DrawingFavoritesBar from '../components/chart/DrawingFavoritesBar';
import MagnetToggle from '../components/chart/MagnetToggle';
import TradeCardModal from '../components/TradeCardModal';
import NewsPanel from '../components/NewsPanel';
import { useDrawingsStore } from '../store/drawingsStore';
import { useJournalStore } from '../store/journalStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startSession, advanceSession, getSession, fetchMarkets, openTrade, closeTrade, getAccount,
  changeSessionTimeframe, seekSession,
} from '../services/api';
import { useInterstitialAd } from '../services/adService';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';
import { useTrainingTimer } from '../hooks/useTrainingTimer';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';

// ── Timezone helpers for session-jump (Asia/London/NY/Custom) ──────────────
// Pure Intl. Two operations only:
//   1. tzPartsOf(unixMs, tz)     — what calendar y/m/d/h/mi does this UTC moment
//                                   look like inside `tz`?
//   2. zonedToUtcSec(parts, tz)  — what UTC unix-second IS that wall-clock
//                                   time inside `tz`?  (DST-correct, including
//                                   edge cases like 1:30 AM on a DST switch.)
type ZParts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

function tzPartsOf(unixMs: number, tz: string): ZParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date(unixMs));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return {
    y:  parseInt(m.year, 10),
    mo: parseInt(m.month, 10),
    d:  parseInt(m.day, 10),
    h:  parseInt(m.hour, 10) % 24,
    mi: parseInt(m.minute, 10),
    s:  parseInt(m.second, 10),
  };
}

// Convert "y-mo-d h:mi in tz" → unix seconds (UTC). DST-correct via a 2-pass
// fixed-point: guess the offset from a naive UTC, recompute at that guess,
// and re-apply. One iteration handles DST transitions correctly.
function zonedToUtcSec(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  // Pass 1: pretend the local time IS UTC, see where that lands in `tz`,
  //         use the diff as our first offset estimate.
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  const p1 = tzPartsOf(naive, tz);
  const asUtc1 = Date.UTC(p1.y, p1.mo - 1, p1.d, p1.h, p1.mi, p1.s);
  const offset1 = asUtc1 - naive;          // (tz-local of `naive`) − UTC of `naive`
  let utc = naive - offset1;

  // Pass 2: re-check at the guessed UTC. If we crossed a DST boundary the
  //         offset shifts; one more correction is sufficient.
  const p2 = tzPartsOf(utc, tz);
  const asUtc2 = Date.UTC(p2.y, p2.mo - 1, p2.d, p2.h, p2.mi, p2.s);
  const offset2 = asUtc2 - utc;
  utc = naive - offset2;

  return Math.floor(utc / 1000);
}

function dateOnlyInTZ(unixSec: number, tz: string): { y: number; mo: number; d: number } {
  const p = tzPartsOf(unixSec * 1000, tz);
  return { y: p.y, mo: p.mo, d: p.d };
}

// Short timezone abbreviation ("ET", "PDT", "GMT", "JST"…) for `tz` at moment `atMs`.
function tzAbbr(tz: string, atMs: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(new Date(atMs));
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz;
}

// Format a UTC unix-second as "9:30 AM" (or 24h variant) inside `tz`.
function formatTimeInTZ(unixSec: number, tz: string, hour12 = true): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12,
  }).format(new Date(unixSec * 1000));
}

// Display equivalent of an exchange-tz session open in the user's chosen
// display tz. Uses TODAY's date to pick the right DST offset for the
// answer (the date doesn't matter for the wall-clock result, only the
// DST regime, and "today" is always in some valid regime).
function sessionSublabel(exchangeTz: string, hour: number, minute: number, displayTz: string): string {
  const now = new Date();
  const utcSec = zonedToUtcSec(
    now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
    hour, minute, exchangeTz,
  );
  return formatTimeInTZ(utcSec, displayTz, true);
}

const TZ_PRESETS: { id: string; label: string }[] = [
  { id: 'auto',                  label: 'Auto (device timezone)' },
  { id: 'America/New_York',      label: 'New York (ET)' },
  { id: 'America/Chicago',       label: 'Chicago (CT)' },
  { id: 'America/Denver',        label: 'Denver (MT)' },
  { id: 'America/Los_Angeles',   label: 'Los Angeles (PT)' },
  { id: 'Europe/London',         label: 'London (GMT/BST)' },
  { id: 'Europe/Paris',          label: 'Paris (CET)' },
  { id: 'Asia/Tokyo',            label: 'Tokyo (JST)' },
  { id: 'Asia/Hong_Kong',        label: 'Hong Kong (HKT)' },
  { id: 'Asia/Dubai',            label: 'Dubai (GST)' },
  { id: 'Australia/Sydney',      label: 'Sydney (AEST)' },
];

// Real session opens, anchored to each market's home timezone. Convert to the
// user's local TZ at jump time (handles DST automatically via tzOffsetMs).
const SESSIONS: { key: string; label: string; tz: string; hour: number; minute: number }[] = [
  { key: 'asia',   label: 'Asia',   tz: 'Asia/Tokyo',       hour: 9, minute: 0  },
  { key: 'london', label: 'London', tz: 'Europe/London',    hour: 8, minute: 0  },
  { key: 'ny',     label: 'NY',     tz: 'America/New_York', hour: 9, minute: 30 },
];

// All 8 timeframes have data — intraday is synthetic (generated from daily OHLC)
// until real Kaggle CC0 1-min data is imported via fetch_kaggle_intraday.py.
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'] as const;

interface Market {
  symbol: string;
  name: string;
  pip: number;
  contractSize: number;
}

const DEFAULT_MARKET: Market = { symbol: 'NQ', name: 'NASDAQ 100 E-mini Futures', pip: 0.25, contractSize: 1 };

// Configurator modal for overriding session open times. Each row lets the
// user customize the hour:minute used by the matching pill (NY/London/Asia).
// Times always stay in each session's exchange timezone — only the hour:minute
// is editable, never the tz.
function CustomSessionConfig({
  visible, onClose, overrides, onSave,
}: {
  visible: boolean;
  onClose: () => void;
  overrides: Record<string, { hour: number; minute: number }>;
  onSave: (next: Record<string, { hour: number; minute: number }>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, { h: string; m: string }>>({});
  // Seed draft from overrides + presets each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const initial: Record<string, { h: string; m: string }> = {};
    for (const s of SESSIONS) {
      const o = overrides[s.key];
      const h = o ? o.hour : s.hour;
      const mi = o ? o.minute : s.minute;
      initial[s.key] = { h: String(h).padStart(2, '0'), m: String(mi).padStart(2, '0') };
    }
    setDraft(initial);
  }, [visible, overrides]);

  const setField = (key: string, field: 'h' | 'm', val: string) => {
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: val } }));
  };
  const resetRow = (key: string) => {
    setDraft((d) => {
      const next = { ...d };
      delete next[key];
      return next;
    });
  };
  const handleSave = () => {
    const next: Record<string, { hour: number; minute: number }> = {};
    for (const s of SESSIONS) {
      const v = draft[s.key];
      if (!v) continue;
      const h = parseInt(v.h, 10);
      const mi = parseInt(v.m, 10);
      if (!isFinite(h) || !isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) {
        Alert.alert('Invalid time', `${s.label}: HH must be 0-23 and MM must be 0-59.`);
        return;
      }
      // Skip writing an override if it equals the preset.
      if (h === s.hour && mi === s.minute) continue;
      next[s.key] = { hour: h, minute: mi };
    }
    onSave(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.customSeekBackdrop} onPress={onClose}>
        <Pressable style={styles.customConfigCard} onPress={() => {}}>
          <Text style={styles.customSeekTitle}>Custom session times</Text>
          <Text style={styles.customSeekSub}>
            Override the open time for any preset. Stays anchored to that session's exchange timezone.
          </Text>
          {SESSIONS.map((s) => {
            const v = draft[s.key] ?? { h: '', m: '' };
            const tzAbbrev = tzAbbr(s.tz);
            const hasOverride = !!overrides[s.key];
            return (
              <View key={s.key} style={styles.customConfigRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customConfigLabel}>{s.label}{hasOverride ? ' *' : ''}</Text>
                  <Text style={styles.customConfigSub}>{tzAbbrev} · default {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')}</Text>
                </View>
                <TextInput
                  value={v.h}
                  onChangeText={(t) => setField(s.key, 'h', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.customConfigInput}
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.customSeekColon}>:</Text>
                <TextInput
                  value={v.m}
                  onChangeText={(t) => setField(s.key, 'm', t)}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.customConfigInput}
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity onPress={() => resetRow(s.key)} style={styles.customConfigReset}>
                  <Ionicons name="refresh-outline" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={styles.customSeekActions}>
            <TouchableOpacity style={styles.customSeekCancel} onPress={onClose}>
              <Text style={styles.customSeekCancelText}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.customSeekJump} onPress={handleSave}>
              <Text style={styles.customSeekJumpText}>SAVE</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function TradingScreen() {
  // Streak training timer — ticks every 10 s while this screen is
  // mounted + the app is foregrounded; pauses on background; flushes
  // any partial interval on unmount. Auto-fires completeDaily() the
  // moment today's bucket crosses the user's daily goal.
  useTrainingTimer();

  const { uid, username } = useAuthStore();

  const [market, setMarket] = useState<Market>(DEFAULT_MARKET);
  const [timeframe, setTimeframe] = useState('1D');
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [accountSize, setAccountSize] = useState(25_000);

  const [tfWheelOpen, setTfWheelOpen] = useState(false);
  const [marketWheelOpen, setMarketWheelOpen] = useState(false);
  const [recentClosedTrade, setRecentClosedTrade] = useState<any | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);

  const [lots, setLots] = useState('1');
  // Pending order — when non-null, the chart shows draggable TP/SL lines and
  // the action bar shows CONFIRM/CANCEL instead of BUY/SELL.
  const [pendingPosition, setPendingPosition] = useState<{
    side: 'buy' | 'sell'; entry: number; tp: number | null; sl: number | null;
    dollarPerPoint: number;
  } | null>(null);

  const [advancing, setAdvancing] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [seeking, setSeeking] = useState(false);
  // Custom session-times overrides — keyed by SESSIONS.key ('asia'/'london'/'ny').
  // null/missing entry = use the preset default. Persisted across launches.
  // The user opens the Custom configurator to edit these; pressing the NY/London/
  // Asia pills uses the override if set, otherwise the hard-coded preset.
  type SessionOverride = { hour: number; minute: number };
  const [customSessions, setCustomSessions] = useState<Record<string, SessionOverride>>({});
  const [customConfigOpen, setCustomConfigOpen] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('@custom_sessions').then((v) => {
      if (v) try { setCustomSessions(JSON.parse(v)); } catch {}
    }).catch(() => {});
  }, []);
  const saveCustomSessions = (next: Record<string, SessionOverride>) => {
    setCustomSessions(next);
    AsyncStorage.setItem('@custom_sessions', JSON.stringify(next)).catch(() => {});
  };
  // Resolve a session pill's effective hour/minute (override or preset).
  const effectiveSessionTime = (key: string): { hour: number; minute: number } => {
    const o = customSessions[key];
    if (o) return o;
    const preset = SESSIONS.find((s) => s.key === key)!;
    return { hour: preset.hour, minute: preset.minute };
  };
  // Tracks the last session pill the user pressed AND the timestamp it landed
  // on. If they press the same pill again WHILE still on that timestamp, we
  // jump to the SAME session on the NEXT day. Used by jumpToSession.
  const lastSessionRef = useRef<{ key: string; ts: number } | null>(null);

  // Display timezone — purely cosmetic. Affects chart axis, crosshair, session
  // sublabels. NEVER fed to the seek logic (sessions are fixed exchange tzs).
  // 'auto' resolves to Intl.DateTimeFormat().resolvedOptions().timeZone.
  const [displayTzPref, setDisplayTzPref] = useState<string>('auto');
  const [tzPickerOpen, setTzPickerOpen] = useState(false);
  const resolvedDisplayTz = displayTzPref === 'auto'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : displayTzPref;
  useEffect(() => {
    AsyncStorage.getItem('@display_tz').then((v) => { if (v) setDisplayTzPref(v); }).catch(() => {});
  }, []);
  const pickDisplayTz = (id: string) => {
    setDisplayTzPref(id);
    AsyncStorage.setItem('@display_tz', id).catch(() => {});
    setTzPickerOpen(false);
  };
  const [autoStarting, setAutoStarting] = useState(false);
  const [autoStartError, setAutoStartError] = useState<string | null>(null);

  // Chart theme — persisted to AsyncStorage so user's choice sticks
  const [chartTheme, setChartTheme] = useState<ChartTheme>(DEFAULT_CHART_THEME);
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false);

  // Refs into the two wheel pickers — used so a vertical drag started on the
  // button forwards directly into the wheel scroll (no intermediate tap).
  const tfWheelRef = useRef<WheelHandle>(null);
  const marketWheelRef = useRef<WheelHandle>(null);
  const dragStartOffsetRef = useRef(0);
  // Button refs + cached anchors so the wheel pops up centered on the button.
  const tfBtnRef = useRef<View>(null);
  const marketBtnRef = useRef<View>(null);
  const [tfAnchor, setTfAnchor] = useState<WheelAnchor | null>(null);
  const [marketAnchor, setMarketAnchor] = useState<WheelAnchor | null>(null);
  const measureBtn = (ref: React.RefObject<View | null>, set: (a: WheelAnchor) => void) => {
    ref.current?.measureInWindow((x, y, w, h) => {
      set({ centerX: x + w / 2, centerY: y + h / 2, width: 160 });
    });
  };

  // Load saved theme + persisted drawings on mount
  useEffect(() => {
    AsyncStorage.getItem('@pocket_trade_chart_theme').then((v) => {
      if (!v) return;
      try {
        const saved = JSON.parse(v);
        if (saved && saved.background) setChartTheme(saved);
      } catch {}
    });
    useDrawingsStore.getState().hydrate();
    useJournalStore.getState().hydrate();
  }, []);

  const applyChartTheme = (t: ChartTheme) => {
    setChartTheme(t);
    AsyncStorage.setItem('@pocket_trade_chart_theme', JSON.stringify(t)).catch(() => {});
  };

  const {
    sessionId, candles, positions, balance, closedTrades,
    startSession: setSession, restoreSession, appendCandles,
    addPosition, removePosition, addClosedTrade, setBalance,
    reset, getSavedSessionId,
  } = useSessionStore();

  const { startAdTimer, stopAdTimer } = useInterstitialAd();

  // Load markets list + user's saved account size
  useEffect(() => {
    fetchMarkets().then((mks) => {
      setAllMarkets(mks);
      // pick default if not in list
      if (!mks.find((m: any) => m.symbol === market.symbol) && mks.length) {
        setMarket(mks[0]);
      }
    }).catch(() => {});
    if (uid) {
      getAccount(uid).then((acc) => {
        if (acc?.starting_balance) setAccountSize(acc.starting_balance);
      }).catch(() => {});
    }
  }, [uid]);

  // Resume saved session OR auto-start one
  useEffect(() => {
    startAdTimer();
    (async () => {
      if (sessionId) return;  // already have a session in memory
      const savedId = await getSavedSessionId();
      if (savedId) {
        try {
          const data = await getSession(savedId);
          if (data.status === 'active') {
            restoreSession(data);
            return;
          }
          await reset();
        } catch { await reset(); }
      }
    })();
    return () => stopAdTimer();
  }, []);

  // If still no session after resume attempt, auto-start one
  useEffect(() => {
    if (sessionId || autoStarting || !uid) return;
    autoStart();
  }, [sessionId, uid, market.symbol, timeframe]);

  const autoStart = async () => {
    if (!uid || autoStarting) return;
    setAutoStarting(true);
    setAutoStartError(null);
    try {
      const data = await startSession(uid, username || 'guest', market.symbol, timeframe, accountSize);
      await setSession(data);
    } catch (e: any) {
      console.warn('auto-start failed:', e.message);
      setAutoStartError(e.message ?? 'Could not start session — backend unreachable?');
    } finally {
      setAutoStarting(false);
    }
  };

  /**
   * Build a PanResponder that handles both tap AND drag on the button:
   *  - Drag vertically  → wheel opens immediately and tracks the finger,
   *                        commits + closes on release.
   *  - Tap (no drag)    → wheel opens; user can scroll inside it.
   * The View claims the gesture from the start so no child Touchable steals it.
   */
  const buildWheelPanResponder = (
    wheelRef: React.RefObject<WheelHandle | null>,
    openWheel: () => void,
    getStartIdx: () => number,
  ) => {
    const dragState = { started: false };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragState.started = false;
        const handle = wheelRef.current;
        const itemH = handle?.itemHeight ?? 44;
        dragStartOffsetRef.current = getStartIdx() * itemH;
      },
      onPanResponderMove: (_, g) => {
        if (!dragState.started && Math.abs(g.dy) > 4) {
          dragState.started = true;
          openWheel();
        }
        if (dragState.started) {
          wheelRef.current?.scrollToOffset(dragStartOffsetRef.current - g.dy);
        }
      },
      onPanResponderRelease: () => {
        if (dragState.started) {
          // Don't commit/close yet — snap to the row under the finger and let
          // the wheel's own grace timer commit if the user doesn't keep going.
          wheelRef.current?.snapToFocused();
        } else {
          openWheel();   // pure tap
        }
      },
      onPanResponderTerminate: () => {
        if (dragState.started) {
          wheelRef.current?.snapToFocused();
        }
      },
    });
  };

  const tfPanResponder = useMemo(
    () => buildWheelPanResponder(
      tfWheelRef,
      () => setTfWheelOpen(true),
      () => Math.max(0, (TIMEFRAMES as unknown as string[]).indexOf(timeframe)),
    ),
    [timeframe],
  );

  const marketPanResponder = useMemo(
    () => buildWheelPanResponder(
      marketWheelRef,
      () => setMarketWheelOpen(true),
      () => Math.max(0, allMarkets.findIndex((m) => m.symbol === market.symbol)),
    ),
    [market.symbol, allMarkets],
  );

  const switchMarket = async (m: Market) => {
    setMarket(m);
    if (sessionId) {
      await reset();  // discard current session silently (no leaderboard post)
      // will be auto-restarted by useEffect
    }
  };

  // Build the absolute UTC unix-second for "9:30 AM in `tz`" on the calendar
  // date the user is currently looking at (date taken in their LOCAL tz —
  // matches what's shown on the chart's right edge), plus `dayOffset` days.
  //
  //   step 1 — read the date the user sees:        (y, mo, d) in user-local tz
  //   step 2 — interpret hour:minute in exchange:  (y, mo, d, h, mi) inside `tz`
  //   step 3 — collapse to UTC unix-second:        zonedToUtcSec(...)
  // No double-offsetting; offsets only ever come from Intl, never from us.
  const sessionTimestampFor = (tz: string, hour: number, minute: number, dayOffset: number): number | null => {
    if (!candles.length) return null;
    const lastBar = candles[candles.length - 1];
    if (!lastBar) return null;
    const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { y, mo, d } = dateOnlyInTZ(lastBar.time as number, userTZ);
    // Day-step in UTC math — never crosses DST in either tz, since we're only
    // adding 86400-second multiples and all calendar arithmetic happens here.
    const noonUtcMs = Date.UTC(y, mo - 1, d, 12, 0, 0) + dayOffset * 86400000;
    const shifted   = new Date(noonUtcMs);
    return zonedToUtcSec(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth() + 1,
      shifted.getUTCDate(),
      hour, minute, tz,
    );
  };

  // Jump current_time to a target session open. Press the same pill twice in a
  // row → advances to the NEXT day's session (multi-day session stepping).
  const jumpToSession = async (key: string, tz: string, hour: number, minute: number) => {
    if (!sessionId || !candles.length || seeking) return;
    // Daily/Weekly: intraday session opens have no meaning at that resolution.
    if (timeframe === '1D' || timeframe === '1W') {
      Alert.alert('Not available', 'Session jumps need an intraday timeframe (1m–1h).');
      return;
    }
    let dayOffset = 0;
    const lastBarTime = (candles[candles.length - 1]!.time) as number;
    const todaysTarget = sessionTimestampFor(tz, hour, minute, 0);
    if (todaysTarget == null) return;
    if (
      lastSessionRef.current?.key === key &&
      Math.abs(lastBarTime - lastSessionRef.current.ts) < 60 * 60
    ) {
      dayOffset = 1;
    }
    let target = dayOffset === 0 ? todaysTarget : sessionTimestampFor(tz, hour, minute, dayOffset)!;

    setSeeking(true);
    try {
      let res: any = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          res = await seekSession(sessionId, target);
          break;
        } catch {
          target = sessionTimestampFor(tz, hour, minute, dayOffset + 1 + attempt)!;
        }
      }
      if (!res) throw new Error('No data near that session');
      useSessionStore.setState({
        candles: res.candles,
        currentBar: res.current_bar,
      });
      const newLast = res.candles[res.candles.length - 1];
      lastSessionRef.current = { key, ts: newLast?.time ?? target };
    } catch (e: any) {
      Alert.alert('Jump failed', e.message ?? 'Could not jump to session.');
    } finally {
      setSeeking(false);
    }
  };

  const switchTimeframe = async (tf: string) => {
    if (tf === timeframe) return;
    setTimeframe(tf);
    if (sessionId) {
      // Switch TF on the backend WITHOUT picking a new period — same hidden_start, just resampled.
      try {
        const data = await changeSessionTimeframe(sessionId, tf);
        // Replace candles in store; positions/balance/closedTrades stay intact
        useSessionStore.setState({
          candles: data.candles,
          currentBar: data.current_bar,
          timeframe: tf,
        });
      } catch (e: any) {
        Alert.alert('Switch failed', e.message ?? 'Could not switch timeframe.');
        setTimeframe(timeframe); // revert
      }
    }
  };

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  const pnl = useMemo(() => {
    const realized = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
    const unrealized = positions.reduce((sum, p) => {
      const dir = p.side === 'buy' ? 1 : -1;
      const pips = ((currentPrice - p.entry_price) / market.pip) * dir;
      return sum + pips * market.pip * market.contractSize * p.lots;
    }, 0);
    return realized + unrealized;
  }, [closedTrades, positions, currentPrice, market]);

  const pnlPct = accountSize > 0 ? (pnl / accountSize) * 100 : 0;

  // ── Actions ──────────────────────────────────────────────────────────────

  // Spam-click coalescing: instead of dropping clicks while a request is in
  // flight (the old behavior), each extra click bumps `queuedAdvances`. When
  // the in-flight request returns, if anything is queued we fire ONE batched
  // request with count=N — so 10 rapid clicks → 1 round-trip, not 10.
  const queuedAdvances = useRef(0);
  const handleAdvance = useCallback(async () => {
    if (!sessionId) return;
    if (advancing) { queuedAdvances.current += 1; return; }
    setAdvancing(true);
    let count = 1;
    try {
      while (count > 0) {
        const res = await advanceSession(sessionId, count);
        if (res.done) { Alert.alert('End of data', 'No more bars available.'); break; }
        appendCandles(res.candles);
        if (res.auto_closed?.length) {
          res.auto_closed.forEach((t: any) => { removePosition(t.position_id ?? t.id); addClosedTrade(t); });
          setRecentClosedTrade(res.auto_closed[res.auto_closed.length - 1]);
        }
        // Drain any clicks that came in while the request was in flight.
        count = queuedAdvances.current;
        queuedAdvances.current = 0;
      }
    } catch (e: any) {
      Alert.alert('Advance failed', e.message);
    } finally {
      queuedAdvances.current = 0;
      setAdvancing(false);
    }
  }, [sessionId, advancing]);

  /**
   * BUY/SELL is now a two-step flow:
   *   1. beginPending(side) — stages a pending order with default TP/SL
   *      offsets that the user can drag on the chart
   *   2. confirmPendingOrder() — sends the API request with the dragged TP/SL
   */
  const beginPending = (side: 'buy' | 'sell') => {
    const px = side === 'buy' ? buyPrice : sellPrice;
    if (!px || !isFinite(px)) return;
    const lotsNum = parseFloat(lots) || 1;
    // TradingView mobile: TP/SL start INACTIVE (null). User drags the small
    // floating TP/SL buttons away from the entry line to create the levels.
    setPendingPosition({
      side, entry: px, tp: null, sl: null,
      dollarPerPoint: market.contractSize * lotsNum,
    });
  };

  const confirmPendingOrder = async () => {
    if (!sessionId || !pendingPosition) return;
    const lotsNum = parseFloat(lots);
    if (isNaN(lotsNum) || lotsNum <= 0) { Alert.alert('Invalid contract size'); return; }
    setPlacing(true);
    try {
      const res = await openTrade(
        sessionId, pendingPosition.side, lotsNum,
        pendingPosition.sl ?? undefined, pendingPosition.tp ?? undefined,
        pendingPosition.entry,
      );
      addPosition({
        id: res.position.id,
        side: res.position.side,
        lots: res.position.lots,
        entry_price: res.position.entry_price,
        stop_loss: res.position.stop_loss,
        take_profit: res.position.take_profit,
        opened_at: res.position.opened_at,
      });
      setPendingPosition(null);
    } catch (e: any) {
      Alert.alert('Order failed', e.message);
    } finally {
      setPlacing(false);
    }
  };

  const closePosition = async (id: string) => {
    if (!sessionId) return;
    try {
      const res = await closeTrade(sessionId, id);
      removePosition(id);
      addClosedTrade(res.trade);
      setBalance(res.balance);
      setCloseConfirmId(null);
      setRecentClosedTrade(res.trade);
    } catch (e: any) {
      Alert.alert('Close failed', e.message);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const fmt = (n: number) => n.toFixed(market.pip < 0.01 ? 5 : 2);
  // Backend uses bar close as the entry price for both buy/sell — no synthetic
  // spread. Frontend matches so the entry line stays exactly where it was when
  // the user clicked CONFIRM.
  const buyPrice  = currentPrice;
  const sellPrice = currentPrice;
  const lotsNum   = parseFloat(lots) || 0;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>

      {/* Top bar — symbol + balance + P&L */}
      <View style={styles.topBar}>
        <View
          ref={marketBtnRef}
          onLayout={() => measureBtn(marketBtnRef, setMarketAnchor)}
          {...marketPanResponder.panHandlers}
          style={styles.symbolBtn}
        >
          <Text style={styles.symbolText}>{market.symbol}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textPrimary} style={{ marginLeft: 4 }} />
        </View>

        <View style={styles.balanceWrap}>
          <Text style={styles.balanceLabel}>EQUITY</Text>
          <Text style={styles.balanceValue}>
            ${(balance + (pnl - closedTrades.reduce((s, t) => s + t.pnl, 0))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={[styles.pnlBadge, pnl >= 0 ? styles.pnlBadgePos : styles.pnlBadgeNeg]}>
          <Text style={styles.pnlBadgeLabel}>P&amp;L</Text>
          <Text style={styles.pnlBadgeValue}>
            {pnl >= 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Chart toolbar — secondary tools */}
      <View style={styles.chartToolbar}>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => Alert.alert('Indicators', 'Coming in v2')}>
          <Ionicons name="bar-chart-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => Alert.alert('Drawing tools', 'Coming in v2 (Block 17)')}>
          <Ionicons name="pencil-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => Alert.alert('Layouts', 'Coming in v2')}>
          <Ionicons name="grid-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <Text style={styles.toolbarPrice}>{fmt(currentPrice)}</Text>
        <Text style={[styles.toolbarPriceChange, pnl >= 0 ? styles.green : styles.red]}>
          {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
        </Text>

        <TouchableOpacity style={styles.toolbarIconBtn} onPress={() => setChartSettingsOpen(true)}>
          <Ionicons name="settings-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Chart row: LEFT drawing-tools sidebar + chart + OHLC overlay */}
      <View style={styles.chartRow}>
        {/* Left vertical drawing tools — full TradingView-style palette. */}
        <DrawingToolbar />

        {/* Chart with OHLC overlay */}
        <View style={styles.chartArea}>
          {/* OHLC overlay readout */}
          {candles.length > 0 && (
            <View style={styles.ohlcOverlay}>
              <Text style={styles.symbolInline}>
                <Text style={styles.symbolInlineStrong}>{market.symbol}</Text>
                {' · '}{timeframe}{' · '}
                <Text style={{ color: colors.textTertiary }}>{market.name}</Text>
              </Text>
              <Text style={styles.ohlcRow}>
                O <Text style={styles.ohlcVal}>{fmt(candles[candles.length - 1].open)}</Text>{'  '}
                H <Text style={styles.ohlcVal}>{fmt(candles[candles.length - 1].high)}</Text>{'  '}
                L <Text style={styles.ohlcVal}>{fmt(candles[candles.length - 1].low)}</Text>{'  '}
                C <Text style={[styles.ohlcVal, pnl >= 0 ? styles.green : styles.red]}>{fmt(candles[candles.length - 1].close)}</Text>
              </Text>
            </View>
          )}

          {/* Floating favorites bar — quick access to starred drawing tools.
              Positions itself absolutely just below the OHLC readout. */}
          {candles.length > 0 && <DrawingFavoritesBar />}

          {sessionId && candles.length > 0 ? (
            <TradingChart
              candles={candles}
              positions={positions}
              currentPrice={currentPrice}
              theme={chartTheme}
              timeframe={timeframe}
              displayTz={resolvedDisplayTz}
              pendingPosition={pendingPosition}
              onPendingDrag={(kind, price) => {
                setPendingPosition((p) => p ? { ...p, [kind]: price } : p);
              }}
            />
          ) : autoStartError ? (
            <View style={styles.chartOverlay}>
              <Ionicons name="alert-circle-outline" size={36} color={colors.red} />
              <Text style={styles.chartOverlayTitle}>Couldn't load market</Text>
              <Text style={styles.chartOverlaySub}>{autoStartError}</Text>
              <TouchableOpacity onPress={autoStart} style={styles.chartRetryBtn}>
                <Text style={styles.chartRetryText}>RETRY</Text>
              </TouchableOpacity>
              <Text style={styles.chartOverlayHint}>
                Make sure the backend is running on your laptop and your phone is on the same WiFi.
              </Text>
            </View>
          ) : (
            <View style={styles.chartOverlay}>
              <ActivityIndicator color={colors.gold} size="large" />
              <Text style={styles.chartOverlaySub}>Loading market…</Text>
            </View>
          )}
        </View>
      </View>

      {/* Session jump pills — Asia / London / NY / Custom + display-TZ pill (centered) */}
      <View style={styles.sessionJumpRow}>
        {SESSIONS.map((s) => {
          const dailyTF = timeframe === '1D' || timeframe === '1W';
          const disabled = seeking || dailyTF;
          const isActive = lastSessionRef.current?.key === s.key && !dailyTF;
          const eff = effectiveSessionTime(s.key);
          const customized = !!customSessions[s.key];
          return (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.sessionPill,
                isActive && styles.sessionPillActive,
                disabled && { opacity: 0.35 },
              ]}
              disabled={disabled}
              onPress={() => jumpToSession(s.key, s.tz, eff.hour, eff.minute)}
              activeOpacity={0.85}
            >
              <Text style={[styles.sessionPillText, isActive && styles.sessionPillTextActive]}>
                {s.label}{customized ? '*' : ''}
              </Text>
              <Text style={[styles.sessionPillSub, isActive && styles.sessionPillSubActive]}>
                {sessionSublabel(s.tz, eff.hour, eff.minute, resolvedDisplayTz)}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.sessionPill, styles.sessionPillCustom]}
          onPress={() => setCustomConfigOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="settings-outline" size={11} color={colors.textPrimary} style={{ marginRight: 4 }} />
          <Text style={styles.sessionPillText}>Custom</Text>
        </TouchableOpacity>
        {/* Display-timezone pill — DISPLAY ONLY, never feeds the seek logic. */}
        <TouchableOpacity
          style={[styles.sessionPill, styles.tzPill]}
          onPress={() => setTzPickerOpen(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="globe-outline" size={11} color={colors.textPrimary} style={{ marginRight: 4 }} />
          <Text style={styles.sessionPillText}>{tzAbbr(resolvedDisplayTz)}</Text>
        </TouchableOpacity>
      </View>

      {/* Top ribbon — TIMEFRAME wheel + NEXT BAR */}
      <View style={styles.orderRibbon}>
        <View
          ref={tfBtnRef}
          onLayout={() => measureBtn(tfBtnRef, setTfAnchor)}
          {...tfPanResponder.panHandlers}
          style={styles.tfPickerActive}
        >
          <Text style={styles.tfPickerText}>{timeframe}</Text>
          <Ionicons name="chevron-down" size={12} color={colors.bg} style={{ marginLeft: 4 }} />
        </View>
        <View style={{ flex: 1 }} />
        <MagnetToggle />
        <TouchableOpacity
          style={styles.newsBtn}
          onPress={() => setNewsOpen(true)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="newspaper-outline" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBarBtn, (advancing || !!pendingPosition) && { opacity: 0.4 }]}
          onPress={handleAdvance}
          disabled={advancing || !!pendingPosition}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBarText}>NEXT BAR</Text>
          <Ionicons name="play-forward" size={12} color={colors.bg} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>


      {/* Bottom action bar — swaps to CONFIRM/CANCEL when a pending order
           is being staged via the on-chart TP/SL drag. */}
      {pendingPosition ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.sellBtn, { backgroundColor: colors.cardAlt }]}
            onPress={() => setPendingPosition(null)}
            activeOpacity={0.85}
          >
            <Text style={[styles.sellBtnLabel, { color: colors.textPrimary }]}>CANCEL</Text>
          </TouchableOpacity>

          <View style={styles.qtyBlock}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setLots(Math.max(1, Math.floor(lotsNum) - 1).toString())}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.qtyValueBox}>
              <Text style={styles.qtyValue}>{lots}</Text>
              <Text style={styles.qtyLabel}>${(currentPrice * market.contractSize * lotsNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setLots((Math.floor(lotsNum) + 1).toString())}>
              <Ionicons name="add" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.buyBtn,
              { backgroundColor: pendingPosition.side === 'buy' ? colors.green : colors.red },
            ]}
            onPress={confirmPendingOrder}
            activeOpacity={0.85}
            disabled={placing}
          >
            <Text style={styles.buyBtnLabel}>
              {placing ? '...' : `CONFIRM ${pendingPosition.side.toUpperCase()}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={styles.sellBtn}
            onPress={() => beginPending('sell')}
            activeOpacity={0.85}
          >
            <Text style={styles.sellBtnLabel}>SELL</Text>
          </TouchableOpacity>

          <View style={styles.qtyBlock}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setLots(Math.max(1, Math.floor(lotsNum) - 1).toString())}>
              <Ionicons name="remove" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.qtyValueBox}>
              <Text style={styles.qtyValue}>{lots}</Text>
              <Text style={styles.qtyLabel}>${(currentPrice * market.contractSize * lotsNum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setLots((Math.floor(lotsNum) + 1).toString())}>
              <Ionicons name="add" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.buyBtn} onPress={() => beginPending('buy')} activeOpacity={0.85}>
            <Text style={styles.buyBtnLabel}>BUY</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── Modals ───────────────────────────────────────────────────────── */}

      {/* Chart Settings — sectioned (Symbol / Canvas / Trading / Alerts) */}
      <ChartSettingsModal
        visible={chartSettingsOpen}
        theme={chartTheme}
        onChange={applyChartTheme}
        onClose={() => setChartSettingsOpen(false)}
      />

      {/* Per-drawing settings — appears whenever a drawing on the chart is selected. */}
      <DrawingSettingsModal />

      {/* Trade summary card — pops after every closed trade (manual or SL/TP hit). */}
      <TradeCardModal
        trade={recentClosedTrade}
        onClose={() => setRecentClosedTrade(null)}
      />

      {/* Display-timezone picker — purely cosmetic; never feeds the seek logic. */}
      <Modal visible={tzPickerOpen} transparent animationType="fade" onRequestClose={() => setTzPickerOpen(false)}>
        <Pressable style={styles.customSeekBackdrop} onPress={() => setTzPickerOpen(false)}>
          <Pressable style={styles.tzPickerCard} onPress={() => {}}>
            <Text style={styles.customSeekTitle}>Display timezone</Text>
            <Text style={styles.customSeekSub}>
              Affects chart axis, crosshair, and session sublabels. Session jumps still use real exchange times.
            </Text>
            {TZ_PRESETS.map((p) => {
              const isSelected = p.id === displayTzPref;
              const liveAbbr = p.id === 'auto'
                ? `Auto · ${tzAbbr(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
                : tzAbbr(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.tzPickerRow, isSelected && styles.tzPickerRowActive]}
                  onPress={() => pickDisplayTz(p.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.tzPickerLabel, isSelected && styles.tzPickerLabelActive]}>{p.label}</Text>
                  <Text style={[styles.tzPickerAbbr, isSelected && styles.tzPickerLabelActive]}>{liveAbbr}</Text>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Custom session configurator — override the open time for any preset
          session. Times stay anchored to each session's exchange tz. */}
      <CustomSessionConfig
        visible={customConfigOpen}
        onClose={() => setCustomConfigOpen(false)}
        overrides={customSessions}
        onSave={(next) => { saveCustomSessions(next); setCustomConfigOpen(false); }}
      />

      {/* Historical news panel — shows headlines up to (and only including) the current session time. */}
      <NewsPanel
        visible={newsOpen}
        onClose={() => setNewsOpen(false)}
        symbol={market.symbol}
        currentTime={candles.length ? (candles[candles.length - 1].time ?? Math.floor(Date.now() / 1000)) : Math.floor(Date.now() / 1000)}
      />

      {/* Timeframe wheel — small floating popup centered on the button. */}
      <WheelPickerModal<string>
        ref={tfWheelRef}
        visible={tfWheelOpen}
        onClose={() => setTfWheelOpen(false)}
        items={TIMEFRAMES as unknown as string[]}
        value={timeframe}
        onChange={switchTimeframe}
        anchor={tfAnchor ?? undefined}
        visibleItems={5}
      />

      {/* Market wheel — floats centered on the button */}
      <WheelPickerModal<Market>
        ref={marketWheelRef}
        visible={marketWheelOpen}
        onClose={() => setMarketWheelOpen(false)}
        items={allMarkets.length ? allMarkets : [market]}
        value={market}
        onChange={switchMarket}
        formatLabel={(m) => m.symbol}
        anchor={marketAnchor ?? undefined}
      />

      {/* Close-position confirm */}
      <Modal visible={closeConfirmId !== null} animationType="fade" transparent>
        <Pressable style={styles.backdrop} onPress={() => setCloseConfirmId(null)}>
          <View style={styles.tfModalBox}>
            <Text style={styles.sheetTitle}>CLOSE POSITION?</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setCloseConfirmId(null)}>
                <Text style={[styles.dialogBtnText, { color: colors.textPrimary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogBtn, { backgroundColor: colors.red }]} onPress={() => closeConfirmId && closePosition(closeConfirmId)}>
                <Text style={styles.dialogBtnText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  symbolBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  symbolText: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  headerCenter: { flex: 1, paddingHorizontal: spacing.sm },
  headerSymbolName: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  headerPrice: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginTop: 2 },

  headerIconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  tfIconText: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.xs },

  // Stats
  statsStrip: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statLabel: { ...labelStyle, fontSize: 9, marginBottom: 2 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  // Chart row (left tools + chart)
  chartRow: { flex: 1, flexDirection: 'row' },
  leftTools: {
    width: 36,
    backgroundColor: colors.bg,
    borderRightWidth: 1, borderRightColor: colors.border,
    paddingVertical: 4,
    alignItems: 'center',
  },
  leftToolBtn: {
    width: 32, height: 30,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: 1,
  },

  // OHLC overlay over chart
  ohlcOverlay: {
    position: 'absolute', top: 6, left: 8, zIndex: 10,
    paddingRight: spacing.md,
  },
  symbolInline: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginBottom: 2 },
  symbolInlineStrong: { color: colors.textPrimary, fontWeight: fontWeight.bold },
  ohlcRow: { color: colors.textSecondary, fontSize: 10, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  ohlcVal: { color: colors.textPrimary, fontWeight: fontWeight.bold },

  // Date axis row
  dateAxisRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.sm,
  },
  dateRangeBtn: { flexDirection: 'row', alignItems: 'center' },
  dateRangeText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  dateAxisTime: { color: colors.textSecondary, fontSize: fontSize.xs, flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] },
  dateAxisToggle: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, paddingHorizontal: 6 },

  // Chart
  chartArea: { flex: 1, minHeight: 240, position: 'relative' },
  chartOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  chartOverlayTitle: { color: colors.red, fontWeight: fontWeight.bold, marginTop: spacing.sm, textAlign: 'center' },
  chartOverlaySub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.sm, textAlign: 'center' },
  chartOverlayHint: { color: colors.textTertiary, fontSize: 11, marginTop: spacing.md, textAlign: 'center' },
  chartRetryBtn: {
    marginTop: spacing.md, backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.md,
  },
  chartRetryText: { color: colors.bg, fontWeight: fontWeight.bold, letterSpacing: 1.5, fontSize: fontSize.xs },

  // Open position bar
  posBar: { flexGrow: 0, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  posPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
    marginRight: spacing.sm,
    gap: 8,
  },
  posPillBuy:  { backgroundColor: colors.greenDim },
  posPillSell: { backgroundColor: colors.redDim },
  posPillSide: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  posPillPnl:  { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  // Next bar
  nextBarRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  nextBarHint: { color: colors.textSecondary, fontSize: fontSize.xs },
  nextBarBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  nextBarText: { color: colors.bg, fontWeight: fontWeight.bold, fontSize: fontSize.xs, letterSpacing: 1.5 },

  // Action bar (Sell | qty | Buy) — compact
  actionBar: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: colors.card,
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    gap: 6,
    height: 56,
  },
  sellBtn: {
    flex: 1, backgroundColor: colors.red,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  buyBtn: {
    flex: 1, backgroundColor: colors.green,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  sellBtnLabel: { color: '#fff', fontWeight: fontWeight.black, fontSize: fontSize.sm, letterSpacing: 1 },
  sellBtnPrice: { color: '#fff', fontWeight: fontWeight.bold, fontSize: 10, fontVariant: ['tabular-nums'] },
  buyBtnLabel:  { color: '#fff', fontWeight: fontWeight.black, fontSize: fontSize.sm, letterSpacing: 1 },
  buyBtnPrice:  { color: '#fff', fontWeight: fontWeight.bold, fontSize: 10, fontVariant: ['tabular-nums'] },

  qtyBlock: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 130,
  },
  qtyBtn: {
    width: 32, height: '100%', alignItems: 'center', justifyContent: 'center',
  },
  qtyValueBox: { alignItems: 'center', paddingHorizontal: 4, justifyContent: 'center', flex: 1 },
  qtyValue: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] },
  qtyLabel: { color: colors.textSecondary, fontSize: 8, fontWeight: fontWeight.semibold, letterSpacing: 0.8, marginTop: -1 },

  // Modals
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, marginBottom: spacing.md },
  sheetTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.black, letterSpacing: 1.5, marginBottom: spacing.lg },

  marketRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  marketRowActive: { backgroundColor: colors.cardAlt },
  marketRowSymbol: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  marketRowName: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },

  tfModalBox: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, marginHorizontal: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  tfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tfBtn: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  tfBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tfText: { color: colors.textSecondary, fontWeight: fontWeight.semibold },
  tfTextActive: { color: colors.bg, fontWeight: fontWeight.bold },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  menuItemText: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold, flex: 1 },

  fieldLabel: { ...labelStyle, marginBottom: 6 },
  modalInput: {
    backgroundColor: colors.bg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    color: colors.textPrimary, fontSize: fontSize.md,
    marginBottom: spacing.md, fontVariant: ['tabular-nums'],
  },
  confirmBtn: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md },
  confirmBtnText: { color: '#fff', fontWeight: fontWeight.black, fontSize: fontSize.md, letterSpacing: 2 },

  dialogBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  dialogBtnText: { color: '#fff', fontWeight: fontWeight.bold, letterSpacing: 1.5, fontSize: fontSize.sm },

  green: { color: colors.green },
  red:   { color: colors.red },

  // ─── Top bar (compact) ───────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  balanceWrap: { flex: 1, paddingHorizontal: spacing.sm },
  balanceLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
  balanceValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginTop: 1 },
  pnlBadge: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md, alignItems: 'center',
  },
  pnlBadgePos: { backgroundColor: colors.greenDim },
  pnlBadgeNeg: { backgroundColor: colors.redDim },
  pnlBadgeLabel: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1.5 },
  pnlBadgeValue: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  // ─── Chart toolbar (dropdowns row) ───────────────────────────────────────
  chartToolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 4,
  },
  toolbarPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
  },
  toolbarPillText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  toolbarDivider: { width: 1, height: 18, backgroundColor: colors.border, marginHorizontal: 4 },
  toolbarIconBtn: { padding: 6, alignItems: 'center', justifyContent: 'center' },
  toolbarPrice: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginRight: 4 },
  toolbarPriceChange: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginRight: spacing.sm },

  // ─── Symbol info line ─────────────────────────────────────────────────────
  symbolInfo: { paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 4 },
  symbolInfoText: { color: colors.textSecondary, fontSize: fontSize.xs },
  symbolInfoStrong: { color: colors.textPrimary, fontWeight: fontWeight.bold },

  // ─── Order ribbon (MARKET dropdown + Next bar) ────────────────────────────
  orderRibbon: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.sm,
  },
  // Centered session-jump row — same row position as before, just centered.
  sessionJumpRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 6,
  },
  sessionPill: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    minWidth: 52,
  },
  sessionPillCustom: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
  },
  tzPill: {
    flexDirection: 'row',
    backgroundColor: colors.cardAlt,
  },
  sessionPillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  sessionPillText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  sessionPillTextActive: {
    color: colors.bg,
  },
  sessionPillSub: {
    color: colors.textTertiary,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  sessionPillSubActive: {
    color: colors.bg,
    opacity: 0.75,
  },
  customSeekBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  customSeekCard: {
    width: 280,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  customSeekTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  customSeekSub: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginBottom: spacing.md,
  },
  customSeekRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  customSeekInput: {
    width: 70, paddingVertical: 10,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  customSeekColon: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: fontWeight.bold,
  },
  customSeekActions: {
    flexDirection: 'row', gap: spacing.sm,
  },
  customSeekCancel: {
    flex: 1, paddingVertical: 10,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  customSeekCancelText: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  customSeekJump: {
    flex: 1, paddingVertical: 10,
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  customSeekJumpText: {
    color: colors.bg,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  customConfigCard: {
    width: 340,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  customConfigRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
    gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  customConfigLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
  },
  customConfigSub: {
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 1,
  },
  customConfigInput: {
    width: 44, paddingVertical: 6,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  customConfigReset: {
    paddingHorizontal: 6,
  },
  tzPickerCard: {
    width: 320,
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
  },
  tzPickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  tzPickerRowActive: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1, borderColor: colors.gold,
  },
  tzPickerLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  tzPickerLabelActive: {
    color: colors.textPrimary,
  },
  tzPickerAbbr: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.4,
    marginLeft: spacing.md,
  },
  marketTypeBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  marketTypeText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  ribbonLabelBtn: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  ribbonLabelDim: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },

  // ─── Price strip (bid · spread% · ask) ────────────────────────────────────
  priceStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  priceStripSide: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  priceStripCenter: { alignItems: 'center', flex: 1, paddingHorizontal: spacing.sm },
  priceStripCenterValue: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  priceStripCenterPct: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 1, fontVariant: ['tabular-nums'] },

  // Chart theme picker rows
  themeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: spacing.md,
  },
  themeRowActive: { backgroundColor: colors.cardAlt },
  themePreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: 48, height: 36, borderRadius: radius.sm,
    borderWidth: 1, padding: 4,
  },
  themePreviewBar: { width: 6, height: 22, borderRadius: 1 },
  themeName: { color: colors.textPrimary, fontSize: fontSize.md, flex: 1 },

  newsBtn: {
    width: 32, height: 32,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },

  // Single rolling timeframe button — replaces the old pill row
  tfRow: {
    flexDirection: 'row', justifyContent: 'center',
    backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
  },
  tfPickerActive: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold,
    borderColor: colors.gold, borderWidth: 1,
    minWidth: 64,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.md,
  },
  tfPickerText: {
    color: colors.bg,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.black,
    letterSpacing: 0.5,
  },
});
