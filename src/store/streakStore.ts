import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Streak system — local state only. Persists via `zustand/middleware`
 * + AsyncStorage so the streak, freezes, and today's accumulated
 * training minutes all survive app restarts.
 *
 * Wiring:
 *  - `useStreakManager()` (mounted in `MainTabs`) calls
 *    `performDailyCheck()` on every app open + every
 *    background → foreground transition. It handles missed-day
 *    accounting (consume freezes, otherwise reset the streak).
 *  - `useTrainingTimer()` (mounted in `TradingScreen`) ticks every
 *    10 s and calls `addTrainingTime()` while the chart screen is
 *    visible. `addTrainingTime()` auto-invokes `completeDaily()`
 *    the moment today's bucket crosses the daily goal.
 *  - `StreakBadge` reads `currentStreak` for the count and
 *    `computeDisplayStatus(state)` for the visual state.
 *
 * Firebase sync is a follow-up — for v1 the streak lives entirely
 * on-device.
 */

export type StreakStatus =
  | 'active'
  | 'milestone'
  | 'at_risk'
  | 'frozen'
  | 'broken'
  | 'new';

// Streak-day counts that earn a "milestone" visual treatment.
const MILESTONE_DAYS: ReadonlyArray<number> = [3, 7, 14, 30, 60, 100, 365];

// Freeze inventory cap. Every 7 streak days earns one (up to 3).
const FREEZE_CAP = 3;
const DEFAULT_FREEZES = 2;

interface StreakState {
  /** Consecutive days the user has hit their daily training goal.
   *  Resets to 0 when missed-day accounting exhausts freezes. */
  currentStreak: number;
  /** Streak freezes the user has banked. Seeded to 2; consumed by
   *  `performDailyCheck()` to preserve the streak across a missed
   *  day. Earned back every 7 streak days up to FREEZE_CAP. */
  freezesRemaining: number;
  /** ISO date (YYYY-MM-DD, device-local) of the most recent day the
   *  user hit their goal. `null` for a brand-new user. */
  lastCompletedDate: string | null;
  /** The YYYY-MM-DD that `todayTrainingMinutes` applies to. If this
   *  doesn't match the actual current date, the today bucket is
   *  rolled over to 0. */
  todayDate: string;
  /** Accumulated training minutes for `todayDate`. Reset on rollover. */
  todayTrainingMinutes: number;
  /** True if a streak freeze was consumed during today's daily
   *  check — the badge shows 'frozen' until tomorrow's rollover. */
  frozenToday: boolean;

  /** Add `minutes` to today's training bucket. If today's bucket
   *  crosses `dailyGoalMinutes` and today hasn't been completed
   *  yet, this auto-invokes `completeDaily()`. */
  addTrainingTime: (minutes: number, dailyGoalMinutes: number) => void;
  /** Mark today as completed: increment streak, set
   *  `lastCompletedDate` to today, earn a freeze if streak hits a
   *  multiple of 7. Idempotent. */
  completeDaily: () => void;
  /** Run the missed-day accounting + today-bucket rollover. Called
   *  by `useStreakManager` on mount + AppState changes. */
  performDailyCheck: () => void;
  /** Manual freeze decrement (kept for dev/QA — daily check uses
   *  this internally). */
  consumeFreeze: () => void;
  /** Grant one freeze, capped at FREEZE_CAP. Used by the
   *  `streak_freeze` challenge bonus reward. */
  grantFreeze: () => void;
  /** Manual streak reset to 0 (kept for dev/QA). */
  resetStreak: () => void;
  /** Full reset to defaults (used on onboarding wipe / sign-out). */
  reset: () => void;
}

// ── Date helpers (device-local) ────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getTodayYMD(): string {
  return toYMD(new Date());
}

export function getYesterdayYMD(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toYMD(d);
}

/** Whole-day count from `fromYmd` to `toYmd`. Both inputs must be
 *  YYYY-MM-DD strings. The `T00:00:00` suffix avoids any DST funk:
 *  we're comparing midnight-to-midnight. */
function daysBetween(fromYmd: string, toYmd: string): number {
  const from = new Date(fromYmd + 'T00:00:00').getTime();
  const to   = new Date(toYmd   + 'T00:00:00').getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

// ── Derived status (read by StreakBadge) ───────────────────────────────────

/** Map the raw streak state to the StreakBadge's visual status.
 *  Precedence ordering:
 *   1. completed today  → 'milestone' on milestone days, else 'active'
 *   2. frozen today     → 'frozen' (freeze used during today's check)
 *   3. zero streak, never completed → 'new'
 *   4. zero streak, but had one before → 'broken'
 *   5. streak > 0, not yet completed today → 'at_risk' */
export function computeDisplayStatus(s: {
  currentStreak: number;
  lastCompletedDate: string | null;
  frozenToday: boolean;
}): StreakStatus {
  const today = getTodayYMD();
  if (s.lastCompletedDate === today) {
    if (MILESTONE_DAYS.includes(s.currentStreak)) return 'milestone';
    return 'active';
  }
  if (s.frozenToday) return 'frozen';
  if (s.currentStreak === 0 && s.lastCompletedDate === null) return 'new';
  if (s.currentStreak === 0) return 'broken';
  return 'at_risk';
}

// ── Store ──────────────────────────────────────────────────────────────────

const initialState = {
  currentStreak: 0,
  freezesRemaining: DEFAULT_FREEZES,
  lastCompletedDate: null as string | null,
  todayDate: getTodayYMD(),
  todayTrainingMinutes: 0,
  frozenToday: false,
};

export const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      ...initialState,

      addTrainingTime: (minutes, dailyGoalMinutes) => {
        if (minutes <= 0) return;
        const today = getTodayYMD();

        // Roll over the today bucket if stale before adding to it.
        const state = get();
        const stale = state.todayDate !== today;
        const baseMinutes = stale ? 0 : state.todayTrainingMinutes;
        const nextMinutes = baseMinutes + minutes;

        set({
          todayDate: today,
          todayTrainingMinutes: nextMinutes,
          // Resetting frozenToday on rollover is the daily-check's
          // job — but if a training tick is the first thing that
          // notices the rollover, clear it here too.
          ...(stale ? { frozenToday: false } : null),
        });

        // Auto-complete on goal cross. Guard against re-completing
        // the same day (e.g., user keeps the chart open past goal).
        if (nextMinutes >= dailyGoalMinutes && get().lastCompletedDate !== today) {
          get().completeDaily();
        }
      },

      completeDaily: () => {
        const today = getTodayYMD();
        const state = get();
        if (state.lastCompletedDate === today) return; // idempotent

        const nextStreak = state.currentStreak + 1;
        let nextFreezes = state.freezesRemaining;
        // Earn one freeze every 7 streak days, capped.
        if (nextStreak % 7 === 0 && nextFreezes < FREEZE_CAP) {
          nextFreezes++;
        }
        set({
          currentStreak: nextStreak,
          lastCompletedDate: today,
          freezesRemaining: nextFreezes,
          // Completing today clears any earlier "freeze saved you"
          // signal — the badge now reads 'active'/'milestone'.
          frozenToday: false,
        });
      },

      performDailyCheck: () => {
        const today = getTodayYMD();
        const yesterday = getYesterdayYMD();
        const state = get();

        // Roll over the today bucket if stale. `frozenToday` is per-
        // day signal, so reset it on rollover too.
        const stale = state.todayDate !== today;
        const baseTodayPatch = stale
          ? {
              todayDate: today,
              todayTrainingMinutes: 0,
              frozenToday: false,
            }
          : {};

        const last = state.lastCompletedDate;
        // Brand-new user, or already handled today, or yesterday was
        // good — no missed-day accounting to do.
        if (last === null || last === today || last === yesterday) {
          if (Object.keys(baseTodayPatch).length > 0) set(baseTodayPatch);
          return;
        }

        // last < yesterday → count the missed days and burn freezes.
        const missed = daysBetween(last, yesterday);
        if (missed <= 0) {
          if (Object.keys(baseTodayPatch).length > 0) set(baseTodayPatch);
          return;
        }

        let freezes = state.freezesRemaining;
        let streak = state.currentStreak;
        let freezeUsed = false;
        for (let i = 0; i < missed; i++) {
          if (freezes > 0) {
            freezes--;
            freezeUsed = true;
          } else {
            streak = 0;
            break;
          }
        }

        set({
          ...baseTodayPatch,
          currentStreak: streak,
          freezesRemaining: freezes,
          // Only show 'frozen' if the streak actually survived. If
          // freezes ran out and the streak reset, the badge reads
          // 'broken' regardless of whether any freezes were used in
          // the partial-loop.
          frozenToday: freezeUsed && streak > 0,
        });
      },

      consumeFreeze: () =>
        set((s) => ({
          freezesRemaining: Math.max(0, s.freezesRemaining - 1),
        })),

      grantFreeze: () =>
        set((s) => ({
          freezesRemaining: Math.min(FREEZE_CAP, s.freezesRemaining + 1),
        })),

      resetStreak: () => set({ currentStreak: 0 }),

      reset: () => set({ ...initialState, todayDate: getTodayYMD() }),
    }),
    {
      name: 'streak-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Function fields are dropped automatically; persist serializes
      // only the data fields above.
    }
  )
);
