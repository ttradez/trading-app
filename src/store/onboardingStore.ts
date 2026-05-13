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

interface OnboardingState {
  /** Result of the archetype quiz (screen 3). null until set. */
  archetype: Archetype | null;
  /** Raw A/B answers from the quiz, in order. Kept for later analytics. */
  archetypeAnswers: ArchetypeAnswer[];

  /** Selected identity (screen 4). null until set. */
  identity: Identity | null;
  /** Goal category that the chosen identity maps to. null until set. */
  goalCategory: GoalCategory | null;

  setArchetype: (archetype: Archetype, answers: ArchetypeAnswer[]) => void;
  setIdentity: (identity: Identity, goalCategory: GoalCategory) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  archetype: null,
  archetypeAnswers: [],
  identity: null,
  goalCategory: null,

  setArchetype: (archetype, answers) =>
    set({ archetype, archetypeAnswers: answers }),

  setIdentity: (identity, goalCategory) =>
    set({ identity, goalCategory }),

  reset: () => set({
    archetype: null,
    archetypeAnswers: [],
    identity: null,
    goalCategory: null,
  }),
}));
