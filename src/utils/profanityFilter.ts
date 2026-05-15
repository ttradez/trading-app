/**
 * Self-contained client-side profanity filter — no external
 * dependency.
 *
 * Replaces the previously-installed `bad-words` package (which
 * shipped a broken v4 dist and was awkward to type) with a small
 * in-repo blocklist. The list is hand-curated to cover the common
 * obvious cases (slurs, explicit terms, vulgarisms + a handful of
 * their most common suffix variants). It's NOT comprehensive — a
 * determined user can always evade a client-side filter — but it
 * covers the friction the screen needs: stopping a casually-picked
 * handle that would embarrass the user (or us) on a leaderboard.
 *
 * Matching is per-token substring: the text is tokenized into
 * letter runs, then each token is checked against every blocklist
 * entry via `String.prototype.includes`. This catches derived
 * forms ("fucker", "fucking", "shitty") with the root entry alone.
 *
 * Cost: the classic Scunthorpe problem — innocent words containing
 * a profane substring as part of a longer token can false-positive
 * (e.g. "class" → "ass" if we listed "ass"; "assassin" → "ass").
 * The blocklist is curated to minimize this — short three-letter
 * roots are kept off the list unless their false-positive surface
 * is small. We accept the rare false positive: a user gets a
 * generic "name isn't allowed" error and picks a different handle.
 *
 * The evasion-stripping pass removes periods, underscores, and
 * digits so handles like `f.u.c.k`, `sh_it`, `f12u23ck` are caught
 * after the strip even when the raw token doesn't match.
 * Leet-speak substitution (`sh1t` → `shit`) is NOT performed; the
 * digit-strip turns `sh1t` into `sht` which doesn't match. That's
 * a deliberate scope trade-off — a more elaborate normalizer is
 * easy to layer in later if it becomes a real problem.
 *
 * The blocklist below intentionally lives in source rather than
 * a JSON fixture so it's reviewable in code review and travels
 * with the bundle (no fetch, no async).
 */

const BLOCKLIST: ReadonlySet<string> = new Set([
  // English-language profanity + common variants
  'fuck', 'fucker', 'fucking', 'fucked', 'motherfucker',
  'shit', 'shitty', 'bullshit',
  'bitch', 'bitches',
  'cunt',
  'dick', 'dickhead',
  'cock',
  'pussy',
  'asshole', 'asshat',
  'bastard',
  'damn', 'goddamn',
  'piss', 'pissed',
  'crap',
  'wanker',
  'bollocks',
  'twat',
  'arsehole',

  // Slurs (racial / homophobic / ableist — the obvious ones a
  // moderation policy would catch). Kept narrow to avoid scope
  // creep; a richer policy lives in a future server-side pass.
  'nigger', 'nigga',
  'faggot', 'fag',
  'tranny',
  'retard', 'retarded',
  'spastic', 'spazz',
  'kike',
  'chink',
  'gook',
  'spic',
  'wetback',

  // Explicit / sexual terms
  'porn', 'porno',
  'rape', 'rapist',
  'cum',
  'whore',
  'slut',
  'milf',
  'orgasm',
  'masturbate',
  'pedo', 'pedophile',
  'incest',
]);

/** Strips characters used to evade letter-by-letter detection:
 *  periods + underscores (handles allow both) and digits. */
function stripEvasionChars(input: string): string {
  return input.replace(/[._0-9]/g, '');
}

/** Tokenize a lowercase string into letter-only runs and return
 *  `true` if ANY token contains ANY blocklist entry. */
function tokensContainBlocked(lowercased: string): boolean {
  // Split on anything that isn't a-z. Empty segments are skipped.
  const tokens = lowercased.split(/[^a-z]+/);
  for (const token of tokens) {
    if (!token) continue;
    for (const word of BLOCKLIST) {
      if (token.includes(word)) return true;
    }
  }
  return false;
}

/** Top-level check used by the trader-name screen.
 *  - Empty / whitespace-only input is not profane.
 *  - The raw lowercased input is checked first.
 *  - If stripping evasion characters would change the input, the
 *    stripped form is checked as a second pass.
 *  Returns `true` on the first hit; `false` otherwise. */
export function containsProfanity(text: string): boolean {
  if (!text) return false;
  const lowered = text.toLowerCase();

  if (tokensContainBlocked(lowered)) return true;

  const stripped = stripEvasionChars(lowered);
  if (stripped !== lowered && tokensContainBlocked(stripped)) return true;

  return false;
}
