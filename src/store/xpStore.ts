import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayYMD } from './streakStore';
import { useCelebrationStore } from './celebrationStore';
import {
  getRankForXP, RankId, SubTier,
} from '../data/rankConfig';
import { getUserXp, XpEvent, RankObj } from '../services/api';

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
  /** null when promoting INTO the Funded cap (no division). */
  newSubTier: SubTier | null;
  previousRank: RankId;
  /** null when the previous beat was the Funded cap. */
  previousSubTier: SubTier | null;
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
  /** null when at the Funded cap (no division). */
  currentSubTier: SubTier | null;
  tradesToday: number;
  todayDate: string;
  firstTradeToday: boolean;

  /** Backend-sourced XP total (authoritative). Server cache, not
   *  accrued locally. Hydrated by `refreshServerXp()` on screen
   *  mount and by `applySessionEnd()` after POST /sessions/.../end.
   *  `null` = never fetched yet — UI falls back to local `currentXP`
   *  so first-render isn't blank. */
  serverXp: number | null;
  /** Backend-sourced rank object (Phase 2). Hydrated alongside
   *  `serverXp` by `refreshServerXp` and by `applySessionEnd` when
   *  the /end response carries it. UI falls back to the local
   *  `getRankForXP` derivation while this is `null`. */
  serverRank: RankObj | null;
  lastSessionXpAward: { amount: number; breakdown: XpEvent['breakdown'] } | null;

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
  getCurrentProgress: () => XpProgress;
  /** Pull the latest XP total from the backend and cache it as
   *  `serverXp`. Call on screen mount where the XP bar lives. */
  refreshServerXp: (uid: string) => Promise<void>;
  /** Apply the XP delta returned by POST /sessions/{id}/end. The
   *  `rank` arg is optional — Phase 2 backends carry it; older
   *  responses skip it and we leave `serverRank` untouched (the
   *  next `refreshServerXp` will reconcile). */
  applySessionEnd: (
    xp_total: number,
    xp_awarded: number,
    xp_breakdown: XpEvent['breakdown'],
    rank?: RankObj | null,
  ) => void;
  reset: () => void;
}

const INITIAL = {
  currentXP: 0,
  currentRank: 'paper' as RankId,
  currentSubTier: 1 as SubTier | null,
  tradesToday: 0,
  todayDate: getTodayYMD(),
  firstTradeToday: false,
  serverXp: null as number | null,
  serverRank: null as RankObj | null,
  lastSessionXpAward: null as { amount: number; breakdown: XpEvent['breakdown'] } | null,
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

        refreshServerXp: async (uid: string) => {
          if (!uid) return;
          try {
            const res = await getUserXp(uid);
            set((s) => ({
              serverXp: res.xp_total,
              // Local currentXP includes challenge grants that never
              // reached the server (the challenge-XP path is local-
              // only today). Don't let a smaller server total pull
              // local progress backwards — only ratchet UP. Same
              // reason readers use Math.max(serverXp, currentXP)
              // below: never lose locally-credited XP.
              currentXP: Math.max(s.currentXP, res.xp_total),
              // Phase 2 backend returns `rank` alongside xp_total;
              // older responses won't include it — keep whatever the
              // store had instead of clobbering with undefined.
              ...(res.rank ? { serverRank: res.rank } : {}),
            }));
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('refreshServerXp failed', (e as Error)?.message);
          }
        },

        applySessionEnd: (xp_total, xp_awarded, xp_breakdown, rank) => {
          set((s) => ({
            serverXp: xp_total,
            // Keep currentXP ≥ session total so subsequent challenge
            // additions stack on top instead of being clamped under
            // a stale local value.
            currentXP: Math.max(s.currentXP, xp_total),
            // Only overwrite `serverRank` when the call site supplied
            // one; pre-Phase-2 /end responses don't and we'd rather
            // leave the cached value than blank it out.
            ...(rank ? { serverRank: rank } : {}),
            lastSessionXpAward: { amount: xp_awarded, breakdown: xp_breakdown },
          }));
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
