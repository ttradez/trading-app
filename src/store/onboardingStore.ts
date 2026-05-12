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

interface OnboardingState {
  /** Result of the archetype quiz (screen 3). null until set. */
  archetype: Archetype | null;
  /** Raw A/B answers from the quiz, in order. Kept for later analytics. */
  archetypeAnswers: ArchetypeAnswer[];

  setArchetype: (archetype: Archetype, answers: ArchetypeAnswer[]) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  archetype: null,
  archetypeAnswers: [],

  setArchetype: (archetype, answers) =>
    set({ archetype, archetypeAnswers: answers }),

  reset: () => set({ archetype: null, archetypeAnswers: [] }),
}));
