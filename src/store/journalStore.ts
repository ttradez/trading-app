import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pocket_trade_journal';

export type Emotion =
  | 'fear' | 'greed' | 'revenge' | 'fomo' | 'confidence' | 'patience' | 'frustration' | 'calm';

/** Pre-trade plan setup type (captured by the "Plan your trade"
 *  card before BUY/SELL). null when the user skipped planning or
 *  the checklist was disabled. */
export type PlanSetupType =
  | 'breakout' | 'reversal' | 'trend' | 'range' | 'news' | 'other';

export interface JournalEntry {
  id: string;
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number;
  rMultiple: number | null;
  /** Realized reward$ / risk$ at exit. Surfaces in the Dashboard
   *  Avg R:R metric. Null when the trade closed without a planned
   *  risk-amount (legacy entries, plan-skipped trades). */
  rrAchieved: number | null;
  /** Risk in account dollars (stopLossDistance × lots × tickValue).
   *  Required to derive rrAchieved at exit. Null = unknown. */
  riskAmount: number | null;
  openedAt: number;
  closedAt: number;
  // pre-trade plan (intent captured BEFORE placement; never edited)
  planSetupType: PlanSetupType | null;
  planStopPrice: number | null;
  planTargetPrice: number | null;
  planSkipped: boolean;
  /** Setup Library id (e.g. "pin_bar", "fvg") this trade was
   *  taken on — drives the Stats "by setup" breakdown. Null when
   *  the trade wasn't tied to a library setup (manual trades, or
   *  pre-feature legacy entries). NOT the same as planSetupType,
   *  which is just a coarse intent category. */
  setupId: string | null;
  /** Quick post-trade rating captured by PostTradeSummaryModal.
   *  Optional — user can dismiss the modal without rating. */
  rating: 'good' | 'ok' | 'bad' | null;
  /** PreTradeChecklistModal — true when the user completed every
   *  item in the 5-item discipline checklist before placing this
   *  trade. False when items were left unchecked or the user
   *  skipped the checklist entirely. */
  checklistPassed: boolean;
  /** True when the user tapped "Skip checklist this time" instead
   *  of completing the 5-item discipline checklist. */
  checklistSkipped: boolean;
  /** Planned stop-loss price level (captured pre-trade). 0 when
   *  unset / legacy. */
  intendedStop: number;
  /** Planned profit-target price level (captured pre-trade). 0
   *  when unset / legacy. */
  intendedTarget: number;
  /** Contracts/units the user committed at placement. Mirrors
   *  `lots` for new trades; preserved on its own so Stats can
   *  distinguish "planned size" from any future partial-fill
   *  semantics. */
  positionSize: number;
  /** $ risk if the planned stop hits (|entry - stop| × size ×
   *  pointValue). Drives `rrAchieved = pnl / intendedRisk` on
   *  close. 0 when unset. */
  intendedRisk: number;
  /** Planned reward-to-risk ratio: |target - entry| / |entry -
   *  stop|. 0 when unset / legacy. */
  intendedRR: number;
  // user-editable
  notes: string;
  mistakes: string;
  wentWell: string;
  emotion: Emotion | null;
  confidence: number | null;  // 1..5
  strategy: string;
  tags: string[];
  savedAt: number;
}

interface JournalState {
  entries: JournalEntry[];
  addEntry: (e: JournalEntry) => void;
  updateEntry: (id: string, patch: Partial<JournalEntry>) => void;
  removeEntry: (id: string) => void;
  /** Wipe all entries + the persisted blob. Used by Settings →
   *  Reset Everything. */
  reset: () => void;
  hydrate: () => Promise<void>;
}

const persist = (entries: JournalEntry[]) => {
  AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => {});
};

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],

  addEntry: (e) => {
    // De-duplicate by tradeId — re-saving overwrites the previous entry.
    const filtered = get().entries.filter((x) => x.tradeId !== e.tradeId);
    const next = [e, ...filtered];
    persist(next);
    set({ entries: next });
  },

  updateEntry: (id, patch) => {
    const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    persist(next);
    set({ entries: next });
  },

  removeEntry: (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    persist(next);
    set({ entries: next });
  },

  reset: () => {
    AsyncStorage.removeItem(KEY).catch(() => {});
    set({ entries: [] });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Backfill timestamps written before the seconds→ms fix:
      // a value < 1e12 is either unix-seconds (≥1e9 → ×1000) or
      // junk/0 (→ savedAt, else now). Keeps old trades from
      // rendering as "Jan 1970".
      let changed = false;
      const fix = (v: unknown, fallback: number): number => {
        if (typeof v === 'number' && v >= 1e12) return v; // already ms
        if (typeof v === 'number' && v >= 1e9 && v < 1e12) {
          changed = true; return v * 1000; // unix seconds
        }
        changed = true; return fallback;
      };
      const migrated = parsed.map((e: JournalEntry) => {
        const savedAt =
          typeof e.savedAt === 'number' && e.savedAt >= 1e12
            ? e.savedAt
            : Date.now();
        return {
          ...e,
          openedAt: fix(e.openedAt, savedAt),
          closedAt: fix(e.closedAt, savedAt),
          // Backfill plan fields for trades saved before the
          // pre-trade checklist shipped.
          planSetupType: e.planSetupType ?? null,
          planStopPrice: e.planStopPrice ?? null,
          planTargetPrice: e.planTargetPrice ?? null,
          planSkipped: e.planSkipped ?? false,
          // Backfill new metric fields. Older entries default to
          // rMultiple where available (it IS the realized R) so
          // avgRR has data on day one; new trades should populate
          // these explicitly at the execution site.
          rrAchieved: e.rrAchieved ?? e.rMultiple ?? null,
          riskAmount: e.riskAmount ?? null,
          setupId:    e.setupId ?? null,
          rating:     e.rating ?? null,
          checklistPassed:  e.checklistPassed ?? false,
          checklistSkipped: e.checklistSkipped ?? false,
          intendedStop:    e.intendedStop ?? 0,
          intendedTarget:  e.intendedTarget ?? 0,
          positionSize:    e.positionSize ?? e.lots ?? 0,
          intendedRisk:    e.intendedRisk ?? 0,
          intendedRR:      e.intendedRR ?? 0,
        };
      });
      set({ entries: migrated });
      if (changed) persist(migrated);
    } catch {}
  },
}));
