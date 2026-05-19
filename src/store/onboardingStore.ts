import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Onboarding state. Persisted via `zustand/middleware` +
 * AsyncStorage so `onboardingComplete` (and the captured
 * archetype / handle / goal / etc.) survive an app reload — the
 * routing guard in App.tsx reads `onboardingComplete` to skip the
 * onboarding flow for returning users. Firebase migration of this
 * payload at signup is still a deferred follow-up.
 */

export type Archetype =
  | 'scalper'
  | 'day_trader'
  | 'swing_trader'
  | 'position_trader';

export type ArchetypeAnswer = 'A' | 'B' | 'C' | 'D';

/** Identity selection from screen 4 — the trader the user wants to
 *  BECOME (Atomic Habits framing). Drives later coaching tips, push
 *  notification copy, and personalized challenges via `goalCategory`. */
export type Identity =
  | 'patient_sniper'
  | 'process_machine'
  | 'risk_surgeon'
  | 'calm_operator'
  | 'profit_compounder';

/** Implicit goal category each identity maps to. */
export type GoalCategory =
  | 'psychology'
  | 'consistency'
  | 'risk'
  | 'profitability';

/** Experience level from screen 5. Drives first-replay difficulty,
 *  default contract size, and tooltip frequency. */
export type ExperienceLevel =
  | 'never'
  | 'beginner'
  | 'intermediate'
  | 'experienced';

/** Daily commitment (screen 8) — sets the user's streak target and
 *  (later) notification cadence. Middle option is the default per
 *  Duolingo's aspirational-nudge playbook. */
export type DailyCommitment =
  | 'light'   // 3 sessions a week
  | 'steady'  // 1 session a day
  | 'pro';    // multiple sessions a day

/** First-trade direction (screen 9). */
export type FirstTradeAction = 'buy' | 'sell';

/** Badge awarded after the first trade. CAN'T FAIL — every outcome
 *  earns a positive badge. */
export type FirstTradeBadge = 'first_strike' | 'first_blood' | 'first_step';

/** Captured first-trade result (screen 9). null until the user
 *  completes the trade. */
export interface FirstTradeResult {
  action: FirstTradeAction;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  badge: FirstTradeBadge;
}

/** Auth method recorded on screen 11. v1 ships mock variants — real
 *  Apple/Google/email Firebase wire-up is a follow-up. When real auth
 *  lands, extend this union with the real method ids. */
export type AuthMethod = 'mock-apple' | 'mock-google' | 'mock-email';

interface OnboardingState {
  /** Result of the archetype quiz (screen 3). null until set. */
  archetype: Archetype | null;
  /** Raw A/B answers from the quiz, in order. Kept for later analytics. */
  archetypeAnswers: ArchetypeAnswer[];

  /** Selected identity (screen 4). null until set. */
  identity: Identity | null;
  /** Goal category that the chosen identity maps to. null until set. */
  goalCategory: GoalCategory | null;

  /** Self-reported experience level (screen 5). null until set. */
  experienceLevel: ExperienceLevel | null;

  /** Starting balance in USD (screen 6). Defaults to 50_000 — the most
   *  common Combine size; teaches realistic position sizing. One of the
   *  5 prop-firm tiers (10/25/50/100/150K) — no custom entry. */
  accountSize: number;

  /** Trader name (screen 7). `handle` is the unique handle used for
   *  leaderboards / URLs (e.g. "gambler.wolf.42"); `displayName` is
   *  the friendlier name shown on profile cards. Uniqueness check is
   *  deferred to signup (screen 11); here we only format-validate. */
  handle: string;
  displayName: string;

  /** Daily commitment (screen 8). Default `'steady'` — middle option
   *  pre-selected per Duolingo's aspirational-nudge playbook. */
  dailyCommitment: DailyCommitment;

  /** First-trade result (screen 9). null until the user completes
   *  the activation trade. Used by screen 10 to drive the rank
   *  progress bar movement. */
  firstTrade: FirstTradeResult | null;

  /** Auth captured on screen 11. v1: mock methods only — real
   *  Firebase wire-up follows. */
  authMethod: AuthMethod | null;
  isAuthed: boolean;

  /** Daily training time goal in minutes (screen 12). User picks one
   *  of 15 / 30 / 60 / 90 / 120 / 180. Drives the streak system —
   *  hitting the goal in a day = +1 streak, missing = reset to 0.
   *  Default 30. */
  dailyTimeGoalMinutes: number;

  /** Set true on screen 12 to signal the whole onboarding flow is
   *  done. Routing-guard logic that hides onboarding for completed
   *  users is a follow-up — for now FORCE_ONBOARDING_FLOW still
   *  triggers it on every relaunch. */
  onboardingComplete: boolean;

  setArchetype: (archetype: Archetype, answers: ArchetypeAnswer[]) => void;
  setIdentity: (identity: Identity, goalCategory: GoalCategory) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setAccountSize: (size: number) => void;
  setHandle: (handle: string) => void;
  setDisplayName: (displayName: string) => void;
  setDailyCommitment: (commitment: DailyCommitment) => void;
  setFirstTrade: (result: FirstTradeResult) => void;
  setAuth: (method: AuthMethod) => void;
  setDailyTimeGoal: (minutes: number) => void;
  setOnboardingComplete: (complete: boolean) => void;
  /** Shallow-merge a profile from an external source (Firestore on
   *  returning sign-in). Only defined keys are written. */
  hydrateProfile: (p: {
    handle?: string;
    displayName?: string;
    archetype?: Archetype | null;
    identity?: Identity | null;
    goalCategory?: GoalCategory | null;
    experienceLevel?: ExperienceLevel | null;
    accountSize?: number;
    dailyCommitment?: DailyCommitment;
    dailyTimeGoalMinutes?: number;
  }) => void;
  reset: () => void;
}

const DEFAULT_ACCOUNT_SIZE = 50_000;

const DEFAULT_DAILY_TIME_GOAL_MIN = 30;

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
  archetype: null,
  archetypeAnswers: [],
  identity: null,
  goalCategory: null,
  experienceLevel: null,
  accountSize: DEFAULT_ACCOUNT_SIZE,
  handle: '',
  displayName: '',
  dailyCommitment: 'steady',
  firstTrade: null,
  authMethod: null,
  isAuthed: false,
  dailyTimeGoalMinutes: DEFAULT_DAILY_TIME_GOAL_MIN,
  onboardingComplete: false,

  setArchetype: (archetype, answers) =>
    set({ archetype, archetypeAnswers: answers }),

  setIdentity: (identity, goalCategory) =>
    set({ identity, goalCategory }),

  setExperienceLevel: (experienceLevel) =>
    set({ experienceLevel }),

  setAccountSize: (accountSize) =>
    set({ accountSize }),

  setHandle: (handle) =>
    set({ handle }),

  setDisplayName: (displayName) =>
    set({ displayName }),

  setDailyCommitment: (dailyCommitment) =>
    set({ dailyCommitment }),

  setFirstTrade: (firstTrade) =>
    set({ firstTrade }),

  setAuth: (authMethod) =>
    set({ authMethod, isAuthed: true }),

  setDailyTimeGoal: (dailyTimeGoalMinutes) =>
    set({ dailyTimeGoalMinutes }),

  setOnboardingComplete: (onboardingComplete) =>
    set({ onboardingComplete }),

  hydrateProfile: (p) => {
    const next: Record<string, unknown> = {};
    (Object.keys(p) as (keyof typeof p)[]).forEach((k) => {
      if (p[k] !== undefined) next[k] = p[k];
    });
    set(next);
  },

  reset: () => set({
    archetype: null,
    archetypeAnswers: [],
    identity: null,
    goalCategory: null,
    experienceLevel: null,
    accountSize: DEFAULT_ACCOUNT_SIZE,
    handle: '',
    displayName: '',
    dailyCommitment: 'steady',
    firstTrade: null,
    authMethod: null,
    isAuthed: false,
    dailyTimeGoalMinutes: DEFAULT_DAILY_TIME_GOAL_MIN,
    onboardingComplete: false,
  }),
    }),
    {
      name: 'onboarding-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
