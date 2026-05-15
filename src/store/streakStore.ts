import { create } from 'zustand';

/**
 * Streak state — visual layer only for v1.
 *
 * Streak increment/reset/freeze LOGIC is a follow-up. This store
 * currently holds initial state only:
 *  - A brand-new user starts at `currentStreak: 0`, `streakStatus:
 *    'new'`. The `StreakBadge` renders 'new' identically to
 *    'at_risk' — "your streak is at 0, train today to start" rather
 *    than "you broke a streak you never had".
 *  - 2 freezes seeded per the screen-12 copy ("You start with 2
 *    freezes.").
 *  - `lastCompletedDate` is a placeholder for the future
 *    increment / reset logic to read.
 *
 * When the logic ships, add daily-check / increment / decrement
 * actions here and wire them from the (also-to-be-built) training-
 * time tracking system. Until then the only mutators are direct
 * setters so the screens can flip states for design QA.
 */

export type StreakStatus =
  | 'active'
  | 'milestone'
  | 'at_risk'
  | 'frozen'
  | 'broken'
  | 'new';

interface StreakState {
  /** Number of consecutive days the user has hit their goal.
   *  0 for a brand-new user or after a `'broken'` reset. */
  currentStreak: number;
  /** Visual state driver — see `StreakBadge` for the rendering rules. */
  streakStatus: StreakStatus;
  /** Streak freezes the user has banked. Seeded to 2; consumed by
   *  future logic on a missed day to preserve the streak. */
  freezesRemaining: number;
  /** ISO date (YYYY-MM-DD) of the most recent day the user hit their
   *  goal. `null` until they complete a session for the first time. */
  lastCompletedDate: string | null;

  setStreak: (count: number, status: StreakStatus) => void;
  setFreezes: (n: number) => void;
  setLastCompletedDate: (date: string | null) => void;
  reset: () => void;
}

const DEFAULT_FREEZES = 2;

export const useStreakStore = create<StreakState>((set) => ({
  currentStreak: 0,
  streakStatus: 'new',
  freezesRemaining: DEFAULT_FREEZES,
  lastCompletedDate: null,

  setStreak: (currentStreak, streakStatus) =>
    set({ currentStreak, streakStatus }),

  setFreezes: (freezesRemaining) =>
    set({ freezesRemaining }),

  setLastCompletedDate: (lastCompletedDate) =>
    set({ lastCompletedDate }),

  reset: () =>
    set({
      currentStreak: 0,
      streakStatus: 'new',
      freezesRemaining: DEFAULT_FREEZES,
      lastCompletedDate: null,
    }),
}));
