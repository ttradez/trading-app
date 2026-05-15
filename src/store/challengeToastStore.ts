import { create } from 'zustand';

/**
 * Ephemeral FIFO queue of completed-challenge toasts (NOT
 * persisted — same rationale as the badge toast queue).
 * `ChallengeToastHost` (MainTabs) drains it sequentially, reusing
 * the badge-toast visual language with a green "MISSION COMPLETE"
 * accent.
 */

export interface ChallengeToast {
  name: string;
  xp: number;
}

interface ChallengeToastState {
  queue: ChallengeToast[];
  enqueue: (t: ChallengeToast) => void;
  dequeue: () => ChallengeToast | undefined;
  clear: () => void;
}

export const useChallengeToastStore = create<ChallengeToastState>((set, get) => ({
  queue: [],
  enqueue: (t) => set((s) => ({ queue: [...s.queue, t] })),
  dequeue: () => {
    const [first, ...rest] = get().queue;
    if (first === undefined) return undefined;
    set({ queue: rest });
    return first;
  },
  clear: () => set({ queue: [] }),
}));
