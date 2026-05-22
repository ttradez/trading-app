import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlanSetupType } from './journalStore';

/**
 * tradePlanStore — bridges a trade's PRE-TRADE PLAN (captured by
 * the "Plan your trade" card before BUY/SELL) to the point where
 * the trade CLOSES and becomes a journal entry.
 *
 * The plan is captured at placement time but a JournalEntry is
 * only built at close time, and the backend close payload doesn't
 * carry client-only fields — so we stash the plan here keyed by
 * the OPEN POSITION's id. `closePosition` / the SL-TP auto-close
 * path look it up by that same id, merge it onto the closed-trade
 * object, then `clearPlan` it.
 *
 * Persisted (zustand/middleware + AsyncStorage) so a plan survives
 * an app restart while its position is still open.
 */

export interface TradePlan {
  setupType: PlanSetupType | null;
  stopPrice: number | null;
  targetPrice: number | null;
  /** true when the user tapped "Skip planning". Legacy field —
   *  retained for compat with old stashed plans (older modal). */
  skipped: boolean;
  /** PreTradeChecklistModal — every item in the 5-item discipline
   *  checklist was checked before placing the trade. */
  checklistPassed: boolean;
  /** User tapped "Skip checklist this time" instead of completing
   *  the discipline checklist. */
  checklistSkipped: boolean;
  /** Setup Library id the user tagged at placement (or auto-filled
   *  from the launching context). Null when untagged. */
  setupId: string | null;
  /** Captured plan numbers — these survive the open→close bridge
   *  so the trade-close handler can write rrAchieved on the
   *  resulting JournalEntry without re-computing risk from
   *  scratch. All defaults are 0 / null for legacy stashes. */
  intendedStop: number;
  intendedTarget: number;
  positionSize: number;
  intendedRisk: number;
  intendedRR: number;
}

interface TradePlanState {
  /** positionId → plan. Only present between placement and close. */
  plans: Record<string, TradePlan>;
  setPlan: (positionId: string, plan: TradePlan) => void;
  getPlan: (positionId: string) => TradePlan | undefined;
  clearPlan: (positionId: string) => void;
  reset: () => void;
}

export const useTradePlanStore = create<TradePlanState>()(
  persist(
    (set, get) => ({
      plans: {},

      setPlan: (positionId, plan) =>
        set((s) => ({ plans: { ...s.plans, [positionId]: plan } })),

      getPlan: (positionId) => get().plans[positionId],

      clearPlan: (positionId) =>
        set((s) => {
          if (!(positionId in s.plans)) return s;
          const next = { ...s.plans };
          delete next[positionId];
          return { plans: next };
        }),

      reset: () => set({ plans: {} }),
    }),
    {
      name: 'trade-plan-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
