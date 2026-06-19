import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from './journalStore';

const KEY = '@pocket_trade_challenges';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  goal: number;            // numeric target (e.g., 5 wins in a row)
  reward: { xp: number; badge?: string };
  /** How to compute progress against an array of journal entries. */
  metric: ChallengeMetric;
  status: 'active' | 'completed' | 'failed';
  /** Saved progress snapshot — recomputed whenever entries change. */
  progress: number;
  startedAt: number;
  completedAt?: number;
}

export type ChallengeMetric =
  | { kind: 'consecutive_wins' }
  | { kind: 'min_rr_streak'; minR: number }
  | { kind: 'no_revenge_days'; days: number }
  | { kind: 'a_plus_only'; minTrades: number }
  | { kind: 'profit_target'; amount: number };

interface ChallengesState {
  challenges: Challenge[];
  hydrate: () => Promise<void>;
  joinChallenge: (template: Omit<Challenge, 'status' | 'progress' | 'startedAt'>) => void;
  recompute: (entries: JournalEntry[]) => void;
  abandon: (id: string) => void;
}

const persist = (cs: Challenge[]) => AsyncStorage.setItem(KEY, JSON.stringify(cs)).catch(() => {});

function progressFor(metric: ChallengeMetric, goal: number, entries: JournalEntry[]): number {
  // Newest-first, but for streaks we walk newest-to-oldest.
  const byTime = [...entries].sort((a, b) => b.closedAt - a.closedAt);
  switch (metric.kind) {
    case 'consecutive_wins': {
      let n = 0;
      for (const e of byTime) { if (e.pnl > 0) n++; else break; }
      return Math.min(n, goal);
    }
    case 'min_rr_streak': {
      let n = 0;
      for (const e of byTime) {
        if (e.pnl > 0 && (e.rMultiple ?? 0) >= metric.minR) n++; else break;
      }
      return Math.min(n, goal);
    }
    case 'no_revenge_days': {
      // Counts consecutive days (most-recent backward) without a "revenge" emotion entry.
      const oneDay = 86_400_000;
      const today = new Date().setHours(0, 0, 0, 0);
      const days = new Set(
        entries.filter((e) => e.emotion === 'revenge').map((e) => new Date(e.closedAt).setHours(0, 0, 0, 0))
      );
      let n = 0;
      while (n < metric.days) {
        const d = today - n * oneDay;
        if (days.has(d)) break;
        n++;
      }
      return Math.min(n, goal);
    }
    case 'a_plus_only': {
      // Counts how many of the last N trades had confidence >= 4.
      const last = byTime.slice(0, metric.minTrades);
      const n = last.filter((e) => (e.confidence ?? 0) >= 4).length;
      return Math.min(n, goal);
    }
    case 'profit_target': {
      const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);
      return Math.min(totalPnl, goal);
    }
  }
}

export const CHALLENGE_TEMPLATES: Omit<Challenge, 'status' | 'progress' | 'startedAt'>[] = [
  {
    id: 'tpl_5_wins',
    title: '5 in a Row',
    description: 'Close 5 winning trades back-to-back.',
    goal: 5,
    reward: { xp: 100, badge: 'Hot Streak' },
    metric: { kind: 'consecutive_wins' },
  },
  {
    id: 'tpl_2r_10',
    title: 'High R Discipline',
    description: 'Hit 10 trades in a row at +2R or better.',
    goal: 10,
    reward: { xp: 250, badge: 'Disciplined' },
    metric: { kind: 'min_rr_streak', minR: 2 },
  },
  {
    id: 'tpl_no_revenge_7d',
    title: 'Cold-Blooded',
    description: 'No revenge-tagged trades for 7 straight days.',
    goal: 7,
    reward: { xp: 200, badge: 'Stoic' },
    metric: { kind: 'no_revenge_days', days: 7 },
  },
  {
    id: 'tpl_a_plus',
    title: 'A+ Only',
    description: 'Of your next 10 trades, 8 must be 4★+ confidence.',
    goal: 8,
    reward: { xp: 150, badge: 'Selective' },
    metric: { kind: 'a_plus_only', minTrades: 10 },
  },
  {
    id: 'tpl_500_profit',
    title: 'First Grand',
    description: 'Hit $500 total cumulative P&L.',
    goal: 500,
    reward: { xp: 100 },
    metric: { kind: 'profit_target', amount: 500 },
  },
];

export const useChallengesStore = create<ChallengesState>((set, get) => ({
  challenges: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) set({ challenges: parsed });
    } catch {}
  },

  joinChallenge: (template) => {
    if (get().challenges.some((c) => c.id === template.id && c.status === 'active')) return;
    const c: Challenge = { ...template, status: 'active', progress: 0, startedAt: Date.now() };
    const next = [c, ...get().challenges.filter((x) => x.id !== template.id)];
    persist(next); set({ challenges: next });
  },

  recompute: (entries) => {
    const next = get().challenges.map((c) => {
      if (c.status !== 'active') return c;
      const progress = progressFor(c.metric, c.goal, entries);
      if (progress >= c.goal) {
        return { ...c, progress: c.goal, status: 'completed' as const, completedAt: Date.now() };
      }
      return { ...c, progress };
    });
    persist(next); set({ challenges: next });
  },

  abandon: (id) => {
    const next = get().challenges.filter((c) => c.id !== id);
    persist(next); set({ challenges: next });
  },
}));
