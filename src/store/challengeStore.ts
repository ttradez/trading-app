import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayYMD } from './streakStore';
import { useStreakStore } from './streakStore';
import { useXpStore } from './xpStore';
import { useChallengeToastStore } from './challengeToastStore';
import { isoWeekId } from '../utils/weeklyRecap';
import {
  DAILY_POOL, WEEKLY_POOL, MONTHLY_POOL, getTemplate,
  DETECTABLE_CONDITIONS, CONDITION_MODE, rankAtLeast,
  ChallengeTemplate,
} from '../data/challengePool';
import { RankId } from '../data/rankConfig';

/**
 * Daily/weekly/monthly challenge instances + rotation + progress
 * detection + reward grants.
 *
 * Expiry is "disappear quietly" — no backlog, no shame. On
 * rotation, incomplete challenges are simply replaced. XP from a
 * completed challenge is granted via `xpStore.addXP(..,'challenge')`
 * (challenges are the big mid-game XP source). A `streak_freeze`
 * bonus grants one freeze (capped) via `streakStore.grantFreeze`.
 *
 * Generation filters the pool by `minRank ≤ userRank` AND
 * `DETECTABLE_CONDITIONS` so a user can never receive a challenge
 * that can't progress.
 *
 * Persisted (zustand/middleware + AsyncStorage).
 */

export interface ChallengeInstance {
  challengeId: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt: string | null;
  xpReward: number;
  /** True once the user has tapped "Claim XP" on a completed
   *  challenge. XP is granted at claim time, not at completion. The
   *  delay gives the user agency and lets the rank bar animate from
   *  the old XP to the new XP when they navigate to Ranks. */
  claimed: boolean;
}

function monthKey(ymd: string): string {
  return ymd.slice(0, 7); // YYYY-MM
}

function toInstance(t: ChallengeTemplate): ChallengeInstance {
  return {
    challengeId: t.id,
    progress: 0,
    target: t.target,
    completed: false,
    completedAt: null,
    xpReward: t.xpReward,
    claimed: false,
  };
}

function pick(
  pool: ReadonlyArray<ChallengeTemplate>,
  userRank: RankId,
  count: number,
  excludeIds: Set<string>,
): ChallengeInstance[] {
  const eligible = pool.filter(
    (t) =>
      rankAtLeast(userRank, t.minRank) &&
      DETECTABLE_CONDITIONS.has(t.condition),
  );
  // Prefer not repeating excluded (yesterday's) ids, but fall back
  // if the eligible set is too small.
  const fresh = eligible.filter((t) => !excludeIds.has(t.id));
  const source = fresh.length >= count ? fresh : eligible;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map(toInstance);
}

interface ChallengeState {
  activeDailies: ChallengeInstance[];
  activeWeekly: ChallengeInstance | null;
  activeMonthly: ChallengeInstance | null;
  dailyDate: string;
  weeklyWeek: string;
  monthlyMonth: string;
  skipsUsedThisWeek: number;
  lastSkipWeekId: string;

  generateDailies: (userRank: RankId) => void;
  generateWeekly: (userRank: RankId) => void;
  generateMonthly: (userRank: RankId) => void;
  updateProgress: (condition: string, value: number) => void;
  /** Grant XP for a completed-but-unclaimed challenge. Idempotent —
   *  a second call on the same challenge is a no-op. Looks up the
   *  challenge across dailies, weekly, and monthly. Returns the XP
   *  amount granted (0 if the challenge wasn't claimable). */
  claimChallenge: (challengeId: string) => number;
  skipDaily: (index: number, userRank: RankId) => boolean;
  checkExpiry: (userRank: RankId) => void;
  reset: () => void;
}

const SKIPS_PER_WEEK = 1;

export const useChallengeStore = create<ChallengeState>()(
  persist(
    (set, get) => ({
      activeDailies: [],
      activeWeekly: null,
      activeMonthly: null,
      dailyDate: '',
      weeklyWeek: '',
      monthlyMonth: '',
      skipsUsedThisWeek: 0,
      lastSkipWeekId: '',

      generateDailies: (userRank) => {
        const prevIds = new Set(get().activeDailies.map((d) => d.challengeId));
        set({
          activeDailies: pick(DAILY_POOL, userRank, 3, prevIds),
          dailyDate: getTodayYMD(),
        });
      },

      generateWeekly: (userRank) => {
        const prev = new Set(
          get().activeWeekly ? [get().activeWeekly!.challengeId] : [],
        );
        const [one] = pick(WEEKLY_POOL, userRank, 1, prev);
        set({
          activeWeekly: one ?? null,
          weeklyWeek: isoWeekId(new Date()),
        });
      },

      generateMonthly: (userRank) => {
        const prev = new Set(
          get().activeMonthly ? [get().activeMonthly!.challengeId] : [],
        );
        const [one] = pick(MONTHLY_POOL, userRank, 1, prev);
        set({
          activeMonthly: one ?? null,
          monthlyMonth: monthKey(getTodayYMD()),
        });
      },

      updateProgress: (condition, value) => {
        if (value <= 0) return;
        const mode = CONDITION_MODE[condition] ?? 'add';

        const apply = (inst: ChallengeInstance): ChallengeInstance => {
          if (inst.completed) return inst;
          const t = getTemplate(inst.challengeId);
          if (!t || t.condition !== condition) return inst;
          const next =
            mode === 'max'
              ? Math.max(inst.progress, value)
              : Math.min(inst.target, inst.progress + value);
          if (next < inst.target) return { ...inst, progress: next };
          // Crossed the target. Mark COMPLETED but NOT claimed — XP
          // is held until the user taps "Claim XP" on the tile. The
          // toast pings to surface the claim affordance.
          const completed: ChallengeInstance = {
            ...inst,
            progress: inst.target,
            completed: true,
            completedAt: new Date().toISOString(),
            claimed: false,
          };
          useChallengeToastStore.getState().enqueue({
            name: t.name,
            xp: inst.xpReward,
          });
          return completed;
        };

        set((s) => ({
          activeDailies: s.activeDailies.map(apply),
          activeWeekly: s.activeWeekly ? apply(s.activeWeekly) : null,
          activeMonthly: s.activeMonthly ? apply(s.activeMonthly) : null,
        }));
      },

      claimChallenge: (challengeId) => {
        let granted = 0;
        const apply = (inst: ChallengeInstance): ChallengeInstance => {
          if (inst.challengeId !== challengeId) return inst;
          if (!inst.completed || inst.claimed) return inst;
          // Grant XP at claim time + apply any bonus reward (e.g.
          // streak_freeze). Was previously coupled to the completion
          // moment in updateProgress; centralized here so the user
          // controls when their rank XP bar moves.
          useXpStore.getState().addXP(inst.xpReward, 'challenge');
          const t = getTemplate(inst.challengeId);
          if (t?.bonusReward === 'streak_freeze') {
            useStreakStore.getState().grantFreeze();
          }
          granted = inst.xpReward;
          return { ...inst, claimed: true };
        };
        set((s) => ({
          activeDailies: s.activeDailies.map(apply),
          activeWeekly: s.activeWeekly ? apply(s.activeWeekly) : null,
          activeMonthly: s.activeMonthly ? apply(s.activeMonthly) : null,
        }));
        return granted;
      },

      skipDaily: (index, userRank) => {
        const s = get();
        if (s.skipsUsedThisWeek >= SKIPS_PER_WEEK) return false;
        const target = s.activeDailies[index];
        if (!target || target.completed) return false;
        const activeIds = new Set(s.activeDailies.map((d) => d.challengeId));
        const [replacement] = pick(DAILY_POOL, userRank, 1, activeIds);
        if (!replacement) return false;
        const nextDailies = s.activeDailies.slice();
        nextDailies[index] = replacement;
        set({
          activeDailies: nextDailies,
          skipsUsedThisWeek: s.skipsUsedThisWeek + 1,
          lastSkipWeekId: isoWeekId(new Date()),
        });
        return true;
      },

      checkExpiry: (userRank) => {
        const today = getTodayYMD();
        const week = isoWeekId(new Date());
        const month = monthKey(today);
        const s = get();

        if (s.dailyDate !== today || s.activeDailies.length === 0) {
          get().generateDailies(userRank);
        }
        if (s.weeklyWeek !== week || !s.activeWeekly) {
          get().generateWeekly(userRank);
          // Skip token resets on the same weekly boundary.
          if (s.lastSkipWeekId !== week) {
            set({ skipsUsedThisWeek: 0 });
          }
        }
        if (s.monthlyMonth !== month || !s.activeMonthly) {
          get().generateMonthly(userRank);
        }
      },

      reset: () =>
        set({
          activeDailies: [],
          activeWeekly: null,
          activeMonthly: null,
          dailyDate: '',
          weeklyWeek: '',
          monthlyMonth: '',
          skipsUsedThisWeek: 0,
          lastSkipWeekId: '',
        }),
    }),
    {
      name: 'challenge-storage-v1',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // v1 → v2: introduced `claimed` flag on ChallengeInstance.
      // Existing completed challenges were ALREADY granted XP
      // (auto-grant on completion in v1), so backfill claimed=true
      // to prevent retroactive Claim buttons + double-grants. New
      // / in-progress challenges default claimed=false.
      migrate: (raw, fromVersion) => {
        const persisted = (raw ?? {}) as Partial<ChallengeState>;
        if (fromVersion < 2) {
          const lift = (inst: ChallengeInstance | null | undefined): any => {
            if (!inst) return inst;
            // claimed already present? leave alone. Otherwise: treat
            // completed challenges as already claimed (legacy auto-
            // grant), uncompleted as not-yet-claimed.
            if (typeof (inst as any).claimed === 'boolean') return inst;
            return { ...inst, claimed: !!inst.completed };
          };
          return {
            ...persisted,
            activeDailies: (persisted.activeDailies ?? []).map(lift),
            activeWeekly: lift(persisted.activeWeekly ?? null),
            activeMonthly: lift(persisted.activeMonthly ?? null),
          } as ChallengeState;
        }
        return persisted as ChallengeState;
      },
    }
  )
);

/** Thin trigger entry point for the call sites. */
export function updateChallengeProgress(condition: string, value: number) {
  useChallengeStore.getState().updateProgress(condition, value);
}
