/**
 * Centralised UI copy constants. Single source of truth for strings
 * that have historically drifted across screens.
 *
 * Sibling to `tokens.ts` under `src/theme/` so callers reach for the
 * same module when picking up colour or copy — there is no separate
 * `src/constants/` dir in this project.
 *
 * Scope kept narrow: add a constant here only when the same string
 * appeared (or risks appearing) in more than one place. Contextual,
 * one-off CTAs — e.g. the Today's Mission card's "Trade this setup"
 * — stay inline at the call site by design.
 */

/** Primary "start a replay" CTA used on every empty-state launch
 *  point (Dashboard Recent Trades empty, Your Tendencies empty,
 *  etc.). DESIGN_AUDIT §2.1 — replaces "Start training" / "Start
 *  trading" / "Start a replay" / "Start a replay session". */
export const PRIMARY_ACTION_LABEL = 'Start session';
