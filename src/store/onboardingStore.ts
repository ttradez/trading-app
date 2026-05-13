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

/** Whether the user's account size came from a preset chip or a
 *  custom-entered value (screen 6). */
export type AccountSizeType = 'preset' | 'custom';

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
   *  common Combine size; teaches realistic position sizing. */
  accountSize: number;
  /** Whether `accountSize` came from a preset chip or custom entry. */
  accountSizeType: AccountSizeType;

  setArchetype: (archetype: Archetype, answers: ArchetypeAnswer[]) => void;
  setIdentity: (identity: Identity, goalCategory: GoalCategory) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setAccountSize: (size: number, type: AccountSizeType) => void;
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
  accountSizeType: 'preset',

  setArchetype: (archetype, answers) =>
    set({ archetype, archetypeAnswers: answers }),

  setIdentity: (identity, goalCategory) =>
    set({ identity, goalCategory }),

  setExperienceLevel: (experienceLevel) =>
    set({ experienceLevel }),

  setAccountSize: (accountSize, accountSizeType) =>
    set({ accountSize, accountSizeType }),

  reset: () => set({
    archetype: null,
    archetypeAnswers: [],
    identity: null,
    goalCategory: null,
    experienceLevel: null,
    accountSize: DEFAULT_ACCOUNT_SIZE,
    accountSizeType: 'preset',
  }),
}));
