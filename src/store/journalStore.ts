import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pocket_trade_journal';

export type Emotion =
  | 'fear' | 'greed' | 'revenge' | 'fomo' | 'confidence' | 'patience' | 'frustration' | 'calm';

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
  openedAt: number;
  closedAt: number;
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

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) set({ entries: parsed });
    } catch {}
  },
}));
