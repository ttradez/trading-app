import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-session running stats + a rolling log of finished sessions.
 *
 * The challenge engine has no native concept of a "session" — the
 * existing detection layer ([challengeDetection.ts]) windows on
 * per-trade / per-day / per-week / lifetime. This store fills that
 * gap so the challenge engine can answer questions like:
 *   - did this session end green?
 *   - did every trade in this session have a stop AND a take-profit?
 *   - how many green sessions in a row?
 *   - profit factor across the last N sessions?
 *
 * Lifecycle:
 *   - startSession()        — at the call site that begins a replay
 *                              session (TradingScreen.autoStart, right
 *                              after `setSession(data)`).
 *   - recordTradeClose()    — alongside detectAfterTradeClose, with
 *                              the trade's pnl + booleans for
 *                              "had stop loss?" / "had take profit?".
 *   - endSession()          — returns the finalized log entry (or
 *                              null when nothing was active) and
 *                              updates consecutiveGreenSessions.
 *                              Caller then passes the record to
 *                              detectAfterSessionEnd() so the
 *                              challenge engine sees it.
 *
 * Persisted (zustand/middleware + AsyncStorage) so a session
 * survives app reopens; the next start cleanly bookends the prior
 * run via TradingScreen.autoStart.
 */

export interface SessionStats {
  active: boolean;
  trades: number;
  wins: number;
  losses: number;
  /** Cumulative session pnl (sum of closed-trade pnl). */
  pnl: number;
  /** Stays true only if EVERY closed trade had both a stop AND a
   *  take-profit set. Flips false the first time either is missing. */
  allTpSl: boolean;
  /** Lowest cumulative session pnl after any close. Negative-only in
   *  practice (starts at 0; only updates when cumulative pnl drops
   *  below the prior min). A simple intra-session drawdown proxy. */
  runningMin: number;
}

export interface SessionLogEntry {
  endedAt: string;     // ISO timestamp
  trades: number;
  pnl: number;
  winRate: number;     // 0..1 (0 when no trades)
  allTpSl: boolean;
  green: boolean;      // pnl > 0
}

interface SessionStatsState {
  currentSession: SessionStats | null;
  sessionLog: SessionLogEntry[];
  consecutiveGreenSessions: number;
  /** Active replay session_id (mirrors ChartScreen.sessionId). Used
   *  to attribute `recordTradeClose` entries to a specific replay
   *  session for SessionsScreen's per-card trade_count/pnl display.
   *  Null while no chart session is open. */
  currentSessionId: string | null;
  /** Persistent per-session tally — accumulated by `recordTradeClose`
   *  whenever `currentSessionId` is set. SessionsScreen overlays
   *  these values on top of the backend's session list so the
   *  Continue card reflects local trades (the backend POST
   *  /sessions/{id}/trade path is intentionally bypassed today;
   *  the backend session therefore has 0 trades server-side). Keyed
   *  by session_id; never cleared except via `reset()`. */
  perSession: Record<string, { trades: number; pnl: number }>;

  startSession: (sessionId?: string | null) => void;
  recordTradeClose: (p: { pnl: number; hadStop: boolean; hadTp: boolean }) => void;
  /** Finalize the active session. Returns the log entry, or null
   *  when no session was active. Caller is responsible for passing
   *  the record to `detectAfterSessionEnd`. */
  endSession: () => SessionLogEntry | null;
  reset: () => void;
}

/** Keep the most recent N sessions — enough horizon for pf15_last10
 *  with a comfortable buffer; bigger logs would bloat AsyncStorage. */
const LOG_LIMIT = 30;

const EMPTY_SESSION: SessionStats = {
  active: true,
  trades: 0,
  wins: 0,
  losses: 0,
  pnl: 0,
  allTpSl: true,
  runningMin: 0,
};

export const useSessionStatsStore = create<SessionStatsState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      sessionLog: [],
      consecutiveGreenSessions: 0,
      currentSessionId: null,
      perSession: {},

      startSession: (sessionId = null) => {
        set({
          currentSession: { ...EMPTY_SESSION },
          currentSessionId: sessionId,
        });
      },

      recordTradeClose: ({ pnl, hadStop, hadTp }) => {
        const cur = get().currentSession;
        if (!cur || !cur.active) return;
        const nextPnl = cur.pnl + pnl;
        // Win/loss counter: a flat 0 pnl is neither (rare with real
        // contracts but possible at-the-money exits — don't credit it
        // either way; the win-rate stat stays honest).
        const winInc  = pnl > 0 ? 1 : 0;
        const lossInc = pnl < 0 ? 1 : 0;
        // Persist per-session tally for the SessionsScreen overlay.
        const sid = get().currentSessionId;
        const prev = (sid && get().perSession[sid]) || { trades: 0, pnl: 0 };
        set({
          currentSession: {
            ...cur,
            trades: cur.trades + 1,
            wins: cur.wins + winInc,
            losses: cur.losses + lossInc,
            pnl: nextPnl,
            allTpSl: cur.allTpSl && hadStop && hadTp,
            runningMin: Math.min(cur.runningMin, nextPnl),
          },
          ...(sid
            ? {
                perSession: {
                  ...get().perSession,
                  [sid]: {
                    trades: prev.trades + 1,
                    pnl: prev.pnl + pnl,
                  },
                },
              }
            : {}),
        });
      },

      endSession: () => {
        const cur = get().currentSession;
        if (!cur || !cur.active) return null;
        const winRate = cur.trades > 0 ? cur.wins / cur.trades : 0;
        const green = cur.pnl > 0;
        const rec: SessionLogEntry = {
          endedAt: new Date().toISOString(),
          trades: cur.trades,
          pnl: cur.pnl,
          winRate,
          allTpSl: cur.allTpSl,
          green,
        };
        // consecutiveGreenSessions only updates when the session was
        // substantive (>= 3 trades). Tiny sessions are noise — they
        // neither extend nor reset the streak.
        let consec = get().consecutiveGreenSessions;
        if (cur.trades >= 3) {
          consec = green ? consec + 1 : 0;
        }
        const log = [...get().sessionLog, rec].slice(-LOG_LIMIT);
        // Drop currentSessionId — but perSession[that_id] survives so
        // SessionsScreen still has the running tally to display after
        // the user returns from the chart.
        set({
          currentSession: null,
          currentSessionId: null,
          sessionLog: log,
          consecutiveGreenSessions: consec,
        });
        return rec;
      },

      reset: () => set({
        currentSession: null,
        currentSessionId: null,
        sessionLog: [],
        consecutiveGreenSessions: 0,
        perSession: {},
      }),
    }),
    {
      name: 'session-stats-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
