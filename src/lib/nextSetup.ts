import {
  SETUP_LIBRARY, LibrarySetup, getSection,
} from '../data/setupLibrary';

/**
 * Next-Up recommendation engine for the Learn screen.
 *
 * Walks the four paths in priority order (Momentum → Reversal →
 * Range → ICT) and returns the first setup the user hasn't opened
 * yet. When everything's been opened, falls back to a curated
 * default (Opening Range Breakout) flagged as "REVISIT" rather
 * than "NEXT UP" so the eyebrow reads honestly.
 *
 * TODO(archetype-aware): layer archetype on top of the path
 * ordering — a Scalper might bias toward Momentum + News, a
 * Position Trader toward Range + ICT. Stub'd out so the engine
 * can be extended without touching the Learn screen.
 */

export type NextUpReason = 'NEXT UP' | 'REVISIT';

export interface NextUpResult {
  setup: LibrarySetup;
  reason: NextUpReason;
}

/** Path priority — drives both the search order in `pickNextSetup`
 *  and the on-screen grid order. Exported so the Learn paths grid
 *  shares a single source of truth. */
export const PATH_ORDER: ReadonlyArray<
  | { kind: 'classic'; category: 'momentum' | 'reversal' | 'range' }
  | { kind: 'ict' }
> = [
  { kind: 'classic', category: 'momentum' },
  { kind: 'classic', category: 'reversal' },
  { kind: 'classic', category: 'range' },
  { kind: 'ict' },
];

/** Setups in a given path — used by both the recommendation and
 *  the per-path progress count on the Learn cards. */
export function setupsInPath(
  path: typeof PATH_ORDER[number],
): LibrarySetup[] {
  return SETUP_LIBRARY.filter((s) => {
    if (path.kind === 'ict') return getSection(s) === 'ict';
    return getSection(s) === 'classic' && s.category === path.category;
  });
}

const DEFAULT_REVISIT_ID = 'opening_range_breakout';

export function pickNextSetup(
  openedSetupIds: ReadonlySet<string>,
): NextUpResult {
  for (const path of PATH_ORDER) {
    const candidates = setupsInPath(path);
    const unopened = candidates.find((s) => !openedSetupIds.has(s.id));
    if (unopened) return { setup: unopened, reason: 'NEXT UP' };
  }
  // Everything opened — surface the curated default with the
  // "REVISIT" eyebrow. Fallback to the first library setup if
  // the curated id was ever removed from the catalog.
  const revisit =
    SETUP_LIBRARY.find((s) => s.id === DEFAULT_REVISIT_ID) ??
    SETUP_LIBRARY[0];
  return { setup: revisit, reason: 'REVISIT' };
}
