import { create } from 'zustand';

/**
 * Ephemeral FIFO queue of badge IDs waiting to be celebrated.
 * NOT persisted — a missed toast isn't worth replaying on next
 * launch (the badge itself is already in the trophy case).
 *
 * `BadgeToastHost` (mounted in MainTabs) drains one at a time
 * with a gap between toasts.
 */

interface BadgeToastState {
  queue: string[];
  enqueue: (ids: string[]) => void;
  dequeue: () => string | undefined;
  clear: () => void;
}

export const useBadgeToastStore = create<BadgeToastState>((set, get) => ({
  queue: [],
  enqueue: (ids) => {
    if (ids.length === 0) return;
    set((s) => ({ queue: [...s.queue, ...ids] }));
  },
  dequeue: () => {
    const [first, ...rest] = get().queue;
    if (first === undefined) return undefined;
    set({ queue: rest });
    return first;
  },
  clear: () => set({ queue: [] }),
}));
