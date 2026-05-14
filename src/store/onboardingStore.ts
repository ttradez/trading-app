import { create } from 'zustand';

/**
 * Onboarding-only state. Not persisted to Firebase yet (deferred-auth
 * strategy — we migrate everything captured during onboarding when the
 * user signs up at screen 11). For now in-memory only; survives screen
 * transitions but not app reloads.
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

  setArchetype: (archetype: Archetype, answers: ArchetypeAnswer[]) => void;
  setIdentity: (identity: Identity, goalCategory: GoalCategory) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setAccountSize: (size: number) => void;
  setHandle: (handle: string) => void;
  setDisplayName: (displayName: string) => void;
  setDailyCommitment: (commitment: DailyCommitment) => void;
  setFirstTrade: (result: FirstTradeResult) => void;
  setAuth: (method: AuthMethod) => void;
  reset: () => void;
}

const DEFAULT_ACCOUNT_SIZE = 50_000;

export const useOnboardingStore = create<OnboardingState>((set) => ({
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
  }),
}));
