import { create } from 'zustand';
import { RankId, SubTier } from '../data/rankConfig';

/**
 * Ephemeral queue of pending rank-up celebrations (NOT persisted —
 * a celebration the user never saw isn't worth replaying on next
 * launch; the rank itself is already in xpStore).
 *
 * Enqueued by `xpStore.addXP` whenever `checkRankUp` reports a
 * crossing. `RankUpCelebrationHost` (MainTabs) drains it, but
 * deliberately waits until the badge + challenge toast queues are
 * empty so the rank-up — the biggest moment — is never upstaged
 * (ordering: journal popup → toasts → rank-up).
 */

export interface CelebrationItem {
  type: 'rank' | 'sub_tier';
  newRank: RankId;
  newSubTier: SubTier;
  previousRank: RankId;
  previousSubTier: SubTier;
  /** XP from the action that pushed the user over the threshold. */
  xpEarned: number;
}

interface CelebrationState {
  queue: CelebrationItem[];
  enqueue: (c: CelebrationItem) => void;
  dequeue: () => CelebrationItem | undefined;
  clear: () => void;
}

export const useCelebrationStore = create<CelebrationState>((set, get) => ({
  queue: [],
  enqueue: (c) => set((s) => ({ queue: [...s.queue, c] })),
  dequeue: () => {
    const [first, ...rest] = get().queue;
    if (first === undefined) return undefined;
    set({ queue: rest });
    return first;
  },
  clear: () => set({ queue: [] }),
}));
