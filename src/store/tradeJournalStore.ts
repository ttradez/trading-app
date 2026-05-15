import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * tradeJournalStore — per-trade reflection captured by the
 * auto-popup `TradeJournalModal` after a trade closes. Keyed by
 * `tradeId` (the closed trade's `id` from the backend / session
 * store), so the TradeCard for a given trade can look up its
 * journal entry without joining tables.
 *
 * Distinct from the legacy `journalStore` (which carries the older
 * `notes / mistakes / wentWell / emotion / confidence / strategy /
 * tags` schema captured manually via the "Journal Trade" button +
 * EntryEditModal). Both stores can coexist on the same trade — they
 * answer different questions and may be reconciled into a single
 * schema once the analytics pass lands.
 *
 * Persisted via `zustand/middleware`'s `persist` over AsyncStorage
 * so journal entries survive app restarts. Firebase sync is a
 * follow-up.
 */

export type TradeGrade = 'A+' | 'A' | 'B' | 'C' | 'F';

export interface TradeJournalData {
  grade: TradeGrade;
  /** 0-3 emotion tags. Names match the chip labels (e.g. 'Calm',
   *  'FOMO'); the modal categorizes them into positive/negative
   *  for color, the store just keeps the strings. */
  emotions: string[];
  /** Optional free-text reflection, capped at 280 chars by the
   *  modal. `null` when the user left it blank. */
  note: string | null;
  /** ISO datetime stamp of when the user pressed Save. */
  journaledAt: string;
}

interface TradeJournalState {
  /** tradeId → journal data. Only present for trades the user
   *  has saved a journal entry for. */
  entries: Record<string, TradeJournalData>;

  /** Save (or overwrite) the journal entry for a given trade. */
  saveEntry: (tradeId: string, data: Omit<TradeJournalData, 'journaledAt'>) => void;
  /** Pure lookup — returns `undefined` if the trade hasn't been
   *  journaled yet. */
  getEntry: (tradeId: string) => TradeJournalData | undefined;
  /** Wipe all entries (dev / sign-out). */
  reset: () => void;
}

export const useTradeJournalStore = create<TradeJournalState>()(
  persist(
    (set, get) => ({
      entries: {},

      saveEntry: (tradeId, data) => {
        const entry: TradeJournalData = {
          ...data,
          journaledAt: new Date().toISOString(),
        };
        set((state) => ({
          entries: { ...state.entries, [tradeId]: entry },
        }));
      },

      getEntry: (tradeId) => get().entries[tradeId],

      reset: () => set({ entries: {} }),
    }),
    {
      name: 'trade-journal-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Convenience hook for the TradeCard: returns the grade for a
 *  given tradeId, or `undefined` if the trade hasn't been
 *  journaled. Re-renders when the entry changes. */
export function useTradeJournalGrade(tradeId: string | undefined): TradeGrade | undefined {
  return useTradeJournalStore(
    (s) => (tradeId ? s.entries[tradeId]?.grade : undefined)
  );
}
