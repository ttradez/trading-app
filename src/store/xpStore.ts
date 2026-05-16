import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayYMD } from './streakStore';
import { useCelebrationStore } from './celebrationStore';
import {
  getRankForXP, RankId, SubTier,
} from '../data/rankConfig';

/**
 * XP + rank progression.
 *
 * XP never decreases. Ranks are permanent. There is no deranking,
 * no decay, no season/prestige reset. This is a deliberate design
 * decision per retention research — progress the user earns is
 * never taken away.
 *
 * Core philosophy: XP rewards PROCESS over OUTCOME. A journaled
 * loss earns the same trade-close XP as a win (the bonus is for
 * reflecting, not for being right). The XP-per-action values are
 * applied at the call sites; this store is the ledger + the
 * daily-tracker bookkeeping + rank-up detection.
 *
 * Persisted via zustand/middleware + AsyncStorage.
 */

export interface RankUp {
  type: 'rank' | 'sub_tier';
  newRank: RankId;
  newSubTier: SubTier;
  previousRank: RankId;
  previousSubTier: SubTier;
}

export interface XpProgress {
  xpInCurrentTier: number;
  xpNeededForNext: number;
  percentProgress: number;     // 0..1
  currentLabel: string;
  nextRankName: string | null; // next beat label, null at cap
  nextSubTier: SubTier | null;
  isMaxed: boolean;
}

interface XpState {
  currentXP: number;
  currentRank: RankId;
  currentSubTier: SubTier;
  tradesToday: number;
  todayDate: string;
  dailySetupCompletedToday: boolean;
  firstTradeToday: boolean;

  /** Add XP from `source` (source is logged, not persisted), then
   *  re-check rank. Returns promotion info if a beat was crossed. */
  addXP: (amount: number, source: string) => RankUp | null;
  /** Snap currentRank/subTier to whatever currentXP earns; returns
   *  promotion info if it changed (can cross multiple beats). */
  checkRankUp: () => RankUp | null;
  /** Reset the per-day trackers (called when the date rolls over). */
  resetDailyTrackers: () => void;
  /** Register a closed trade for XP: bumps tradesToday, returns the
   *  soft-capped base (+10, halved to +5 after 20/day) and whether
   *  this is the first trade of the day. */
  registerTrade: () => { base: number; isFirstOfDay: boolean };
  /** Returns true the first time it's called on a given day (used
   *  to gate the once-per-day Daily Setup XP). */
  tryClaimDailySetup: () => boolean;
  getCurrentProgress: () => XpProgress;
  reset: () => void;
}

const INITIAL = {
  currentXP: 0,
  currentRank: 'gambler' as RankId,
  currentSubTier: 1 as SubTier,
  tradesToday: 0,
  todayDate: getTodayYMD(),
  dailySetupCompletedToday: false,
  firstTradeToday: false,
};

const SOFT_CAP_TRADES = 20;

export const useXpStore = create<XpState>()(
  persist(
    (set, get) => {
      const ensureToday = () => {
        const today = getTodayYMD();
        if (get().todayDate !== today) {
          set({
            todayDate: today,
            tradesToday: 0,
            dailySetupCompletedToday: false,
            firstTradeToday: false,
          });
        }
      };

      return {
        ...INITIAL,

        resetDailyTrackers: () =>
          set({
            todayDate: getTodayYMD(),
            tradesToday: 0,
            dailySetupCompletedToday: false,
            firstTradeToday: false,
          }),

        addXP: (amount, source) => {
          if (amount <= 0) return null;
          ensureToday();
          set((s) => ({ currentXP: s.currentXP + amount }));
          // eslint-disable-next-line no-console
          console.log(`+${amount} XP (${source})`);
          const promo = get().checkRankUp();
          if (promo) {
            // Enqueue the celebration here (not in checkRankUp) so
            // we have the triggering `amount`. The host gates
            // display behind the toast queues.
            useCelebrationStore.getState().enqueue({
              ...promo,
              xpEarned: amount,
            });
          }
          return promo;
        },

        checkRankUp: () => {
          const { currentXP, currentRank, currentSubTier } = get();
          const r = getRankForXP(currentXP);
          if (r.rank === currentRank && r.subTier === currentSubTier) {
            return null;
          }
          const promo: RankUp = {
            type: r.rank !== currentRank ? 'rank' : 'sub_tier',
            newRank: r.rank,
            newSubTier: r.subTier,
            previousRank: currentRank,
            previousSubTier: currentSubTier,
          };
          set({ currentRank: r.rank, currentSubTier: r.subTier });
          // eslint-disable-next-line no-console
          console.log(
            `RANK UP (${promo.type}): ${promo.previousRank} ${promo.previousSubTier} → ${promo.newRank} ${promo.newSubTier}`,
          );
          return promo;
        },

        registerTrade: () => {
          ensureToday();
          const s = get();
          const base = s.tradesToday >= SOFT_CAP_TRADES ? 5 : 10;
          const isFirstOfDay = !s.firstTradeToday;
          set({
            tradesToday: s.tradesToday + 1,
            firstTradeToday: true,
          });
          return { base, isFirstOfDay };
        },

        tryClaimDailySetup: () => {
          ensureToday();
          if (get().dailySetupCompletedToday) return false;
          set({ dailySetupCompletedToday: true });
          return true;
        },

        getCurrentProgress: () => {
          const r = getRankForXP(get().currentXP);
          const isMaxed = r.next === null;
          return {
            xpInCurrentTier: r.xpInTier,
            xpNeededForNext: r.xpNeededForNext,
            percentProgress: isMaxed
              ? 1
              : r.xpNeededForNext > 0
                ? Math.min(1, r.xpInTier / r.xpNeededForNext)
                : 0,
            currentLabel: r.label,
            nextRankName: r.next ? r.next.label : null,
            nextSubTier: r.next ? r.next.subTier : null,
            isMaxed,
          };
        },

        reset: () => set({ ...INITIAL, todayDate: getTodayYMD() }),
      };
    },
    {
      name: 'xp-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
