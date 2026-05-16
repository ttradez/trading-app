/**
 * Setup Library — a browseable encyclopedia of named trading
 * patterns. The "curriculum" layer (Research Feature #4): users
 * study a pattern, then tap a historical example to load it
 * straight into a replay session.
 *
 * Pure data. The library/detail screens render this; the deep-link
 * to the chart reuses the existing `dailySetup` route param
 * (symbol / timeframe / date → `savedSetupStartUnixSeconds`), the
 * same mechanism Daily Mission and Saved Setups use.
 *
 * v1 ships 15 setups across 5 categories — expandable. All example
 * dates are real 2022 NQ/ES sessions (the year the replay backend
 * has coverage for); news examples use dates that exist in
 * `economicCalendar.ts` (CPI / NFP / FOMC).
 *
 * Out of scope for v1 (documented for the next contributor):
 *  - Per-setup completion tracking (ties into badges/XP later).
 *  - User-created setups (needs Firebase).
 *  - More than 15 setups.
 */

export type SetupCategory =
  | 'momentum' | 'reversal' | 'range' | 'news' | 'pattern';

export type SetupDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface SetupExample {
  symbol: string;
  /** YYYY-MM-DD historical date (2022). */
  date: string;
  timeframe: string;
  /** One-line note on what happened that day. */
  context: string;
}

export interface LibrarySetup {
  id: string;
  name: string;
  category: SetupCategory;
  difficulty: SetupDifficulty;
  /** 2-3 sentences: what this setup IS. */
  description: string;
  /** 2-3 sentences: how to identify + trade it. */
  howToTrade: string;
  /** 3-4 short checklist rules. */
  keyRules: string[];
  /** 2-3 replay-able historical examples. */
  examples: SetupExample[];
}

/** Category accent (mirrors the rank theme palette already in use
 *  so the app stays visually coherent). */
export const CATEGORY_COLOR: Record<SetupCategory, string> = {
  momentum: '#4A9EFF',
  reversal: '#FF7AB6',
  range:    '#00D395',
  news:     '#FFB800',
  pattern:  '#9B59B6',
};

export const CATEGORY_LABEL: Record<SetupCategory, string> = {
  momentum: 'MOMENTUM',
  reversal: 'REVERSAL',
  range:    'RANGE',
  news:     'NEWS',
  pattern:  'PATTERN',
};

export const CATEGORY_ORDER: SetupCategory[] =
  ['momentum', 'reversal', 'range', 'news', 'pattern'];

/** Difficulty → pill color. Matches the Daily Mission badge:
 *  beginner green, intermediate gold, advanced red. */
export const DIFFICULTY_COLOR: Record<SetupDifficulty, string> = {
  beginner:     '#00D395',
  intermediate: '#FFB800',
  advanced:     '#FF4757',
};

export const SETUP_LIBRARY: ReadonlyArray<LibrarySetup> = [
  // ── MOMENTUM (beginner) ──────────────────────────────────────
  {
    id: 'opening_range_breakout',
    name: 'Opening Range Breakout',
    category: 'momentum',
    difficulty: 'beginner',
    description:
      'The high and low of the first 15-30 minutes after the open form the "opening range". A decisive break of that range often sets the directional tone for the rest of the session.',
    howToTrade:
      'Mark the opening-range high and low. Wait for a candle to CLOSE outside the range (not just wick through), then enter in the breakout direction with a stop back inside the range. Target a multiple of the range height.',
    keyRules: [
      'Only act on a close outside the range, never a wick',
      'Stop goes just back inside the opposite side of the range',
      'Skip it on a tiny range — no room, no edge',
      'First clean break is highest quality; later breaks fade',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Soft CPI: broke the opening range up and trended 700+ pts' },
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'FOMC first-hike day: clean post-open range break higher' },
      { symbol: 'ES', date: '2022-11-30', timeframe: '5m',
        context: 'Powell pivot speech: afternoon range break into the close' },
    ],
  },
  {
    id: 'gap_and_go',
    name: 'Gap and Go',
    category: 'momentum',
    difficulty: 'beginner',
    description:
      'The market gaps up or down at the open on a catalyst and continues in the gap direction instead of filling it. Strong hands are positioned and there is no supply/demand to fade the move.',
    howToTrade:
      'On a strong gap, watch the first 1-5 minutes. If price holds the gap and makes a higher low (gap up) or lower high (gap down), enter with the gap. The opening swing low/high is your invalidation.',
    keyRules: [
      'The gap must HOLD — a quick fill kills the setup',
      'Enter on the first higher-low / lower-high, not the open tick',
      'Catalyst + volume confirms; a quiet gap is suspect',
      'Invalidation is a full retrace back through the open',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Gapped up on soft CPI and never filled it' },
      { symbol: 'ES', date: '2022-07-27', timeframe: '5m',
        context: 'Post-FOMC relief gap held and ran into the close' },
      { symbol: 'ES', date: '2022-11-30', timeframe: '5m',
        context: 'Pivot-rally gap up; continuation through the afternoon' },
    ],
  },
  {
    id: 'trend_continuation',
    name: 'Trend Continuation',
    category: 'momentum',
    difficulty: 'beginner',
    description:
      'In an established trend, price pulls back to a moving average or prior support, then resumes in the trend direction. You are buying the dip in an uptrend (or selling the rally in a downtrend), not predicting a turn.',
    howToTrade:
      'Confirm the trend (higher highs/lows or the inverse). Wait for a shallow pullback into the rising/falling 9- or 20-EMA, then enter on the first reversal candle back in the trend direction. Stop beyond the pullback extreme.',
    keyRules: [
      'Trade WITH the trend only — no counter-trend heroics',
      'Shallow, orderly pullbacks are healthy; deep ones warn',
      'Enter on the resumption candle, not mid-pullback',
      'Exit if a higher-low (uptrend) is broken',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-07-19', timeframe: '5m',
        context: 'Earnings-season grind up; shallow buyable dips' },
      { symbol: 'ES', date: '2022-11-30', timeframe: '5m',
        context: 'Powell pivot afternoon trend; pullbacks to rising EMA' },
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'Post-FOMC trend day; first-pullback continuation longs' },
    ],
  },

  // ── REVERSAL (intermediate) ──────────────────────────────────
  {
    id: 'failed_breakout',
    name: 'Failed Breakout',
    category: 'reversal',
    difficulty: 'intermediate',
    description:
      'Price breaks a well-watched level, traps breakout traders, then reverses sharply back through it. The trapped orders becoming exits fuel the move the other way.',
    howToTrade:
      'Watch a level everyone sees. If price breaks it but cannot hold and closes back inside within a few bars, enter the reversal with a stop just beyond the failed extreme. The trapped traders are your fuel.',
    keyRules: [
      'Needs an obvious level — the trap requires a crowd',
      'Confirmation = a close back inside, fast',
      'Stop is tight, just past the false-break high/low',
      'Best when the break came on weak/declining volume',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-05-20', timeframe: '5m',
        context: 'Rally into resistance failed and reversed into the close' },
      { symbol: 'ES', date: '2022-09-21', timeframe: '5m',
        context: 'FOMC 2 PM spike failed within 15 min and faded to lows' },
      { symbol: 'NQ', date: '2022-12-13', timeframe: '5m',
        context: 'CPI gap-up made no new high after 90 min, then dropped' },
    ],
  },
  {
    id: 'double_bottom_top',
    name: 'Double Bottom / Double Top',
    category: 'reversal',
    difficulty: 'intermediate',
    description:
      'Price tests a level twice, fails to break it the second time, and reverses. The second failed test shows the prior pressure is exhausted.',
    howToTrade:
      'Identify two roughly equal lows (or highs) with a pivot between them. The pattern confirms on the break of that middle pivot — not on the second low/high itself. Enter the breakout of the pivot; stop beyond the second test.',
    keyRules: [
      'Two tests of the SAME level, not a vague zone',
      'Confirmation is the middle-pivot break, not the 2nd low',
      'Second test on lighter volume is the tell',
      'Invalidation is a clean break of the tested level',
    ],
    examples: [
      { symbol: 'ES', date: '2022-01-24', timeframe: '5m',
        context: 'Capitulation flush carved a double bottom before the V' },
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Marginal new low retested, then ripped ~5%' },
      { symbol: 'ES', date: '2022-02-24', timeframe: '5m',
        context: 'Gap-down double-tested the low then reversed all day' },
    ],
  },
  {
    id: 'v_bottom_recovery',
    name: 'V-Bottom Recovery',
    category: 'reversal',
    difficulty: 'intermediate',
    description:
      'A sharp, panicked sell-off is met by an equally sharp bounce off a key level — a "V" with no base. Maximum fear flushes the last sellers, then aggressive buyers step in.',
    howToTrade:
      'Do not catch the knife. Wait for the low to be set, then for the FIRST higher-low after it. Enter on that higher-low with a stop under the V. The reclaim of the day\'s open confirms the recovery has legs.',
    keyRules: [
      'Never buy the falling knife — wait for the first higher-low',
      'A reclaim of the open / VWAP confirms the turn',
      'Climactic volume at the low is the signature',
      'If it makes a new low after your entry, you are wrong — out',
    ],
    examples: [
      { symbol: 'ES', date: '2022-01-24', timeframe: '5m',
        context: 'Sharp -4% flush then an equally sharp V back to green' },
      { symbol: 'ES', date: '2022-02-24', timeframe: '5m',
        context: 'Geopolitical gap-down V-reversed the entire session' },
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Hot-CPI new low, then a violent V back through the open' },
    ],
  },

  // ── RANGE (beginner) ─────────────────────────────────────────
  {
    id: 'range_fade',
    name: 'Range Fade',
    category: 'range',
    difficulty: 'beginner',
    description:
      'On a low-conviction day price oscillates inside a defined range. You fade the edges — sell the top, buy the bottom — targeting the middle. Not every day trends; some days you get paid to fade.',
    howToTrade:
      'Establish the range from the first 1-2 hours of rotation. Sell rejections at the upper third, buy rejections at the lower third, target the midpoint. The middle of the range is no-trade chop.',
    keyRules: [
      'Only the outer thirds are tradeable; the middle is chop',
      'Need a clear rejection candle at the edge to enter',
      'Stop just outside the range — a break ends the regime',
      'Lower P&L expectation per trade than a trend day',
    ],
    examples: [
      { symbol: 'ES', date: '2022-03-29', timeframe: '5m',
        context: 'Quarter-end chop inside a defined range all day' },
      { symbol: 'NQ', date: '2022-04-21', timeframe: '5m',
        context: 'Pre-mega-cap-earnings indecision; rotational range' },
      { symbol: 'ES', date: '2022-08-23', timeframe: '5m',
        context: 'Pre-Jackson-Hole drift; tight two-sided range' },
    ],
  },
  {
    id: 'opening_range_hold',
    name: 'Opening Range Hold',
    category: 'range',
    difficulty: 'beginner',
    description:
      'Price tests the opening-range boundary, rejects it, and stays inside the range. The opposite of an opening-range breakout — the break fails and the range contains the day.',
    howToTrade:
      'Mark the opening range. When price pokes a boundary and snaps back inside on a rejection candle, fade it back toward the other side of the range. Stop just outside the boundary that was tested.',
    keyRules: [
      'Trade only after a clear rejection back inside the range',
      'A sustained close outside flips this to a breakout — stand down',
      'Target the opposite boundary or the midpoint',
      'Works best on low-event, low-volatility sessions',
    ],
    examples: [
      { symbol: 'ES', date: '2022-03-29', timeframe: '5m',
        context: 'Tested the opening-range high, rejected, stayed inside' },
      { symbol: 'NQ', date: '2022-04-21', timeframe: '5m',
        context: 'OR boundary rejected repeatedly; range never broke' },
      { symbol: 'ES', date: '2022-08-23', timeframe: '5m',
        context: 'Opening range held both ways into the JH event' },
    ],
  },

  // ── NEWS (advanced) ──────────────────────────────────────────
  {
    id: 'cpi_reaction',
    name: 'CPI Reaction Trade',
    category: 'news',
    difficulty: 'advanced',
    description:
      'The 8:30 AM CPI release produces a violent initial spike. Trading the spike-and-fade (or spike-and-go) requires a plan made BEFORE the number, because the first move is often a trap.',
    howToTrade:
      'Do not trade the release bar. Mark the pre-release range. Let the initial spike resolve, then trade the reaction: a failed reclaim of the pre-release level is the fade; a held break is the momentum trade.',
    keyRules: [
      'Never trade the 8:30 release candle itself',
      'Plan both directions before the print — no improvising',
      'Size down: spreads and slippage are brutal here',
      'The second move (post-spike) is the tradeable one',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-09-13', timeframe: '5m',
        context: 'Hot August CPI: -200 pts in 45 min off the spike' },
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Hot CPI spike-low, then a historic intraday reversal' },
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Soft CPI: +700 pt one-way melt-up' },
    ],
  },
  {
    id: 'fomc_fade',
    name: 'FOMC Fade',
    category: 'news',
    difficulty: 'advanced',
    description:
      'The knee-jerk move on the 2:00 PM Fed statement frequently reverses during the 2:30 PM press conference. The statement pop is often a liquidity trap; the presser sets the real trend.',
    howToTrade:
      'Avoid the 2:00 PM spike. Mark the pre-release level. If the initial move fails to hold within ~15 minutes, fade it on the reclaim of that level and ride the presser trend.',
    keyRules: [
      'The 2:00 PM bar is a trap — do not chase it',
      'The 2:30 PM presser is where the real move forms',
      'Fade trigger = failed hold + reclaim of pre-release level',
      'Two-sided and fast; size down and define risk first',
    ],
    examples: [
      { symbol: 'ES', date: '2022-09-21', timeframe: '5m',
        context: '2 PM pop faded the entire presser to the lows' },
      { symbol: 'ES', date: '2022-05-04', timeframe: '5m',
        context: 'Powell rules out 75bp; rip then full reversal next day' },
      { symbol: 'ES', date: '2022-06-15', timeframe: '5m',
        context: '75bp surprise whipsaw around 2 PM before the trend' },
    ],
  },
  {
    id: 'nfp_momentum',
    name: 'NFP Momentum',
    category: 'news',
    difficulty: 'advanced',
    description:
      'When the 8:30 AM non-farm payrolls number is a large miss or beat, it can drive a sustained one-directional move rather than a fade. The surprise reprices expectations for the whole session.',
    howToTrade:
      'Gauge the surprise size. On a big deviation, let the first spike settle, then enter on the first continuation pullback in the reaction direction. A small in-line number means stand down — no edge.',
    keyRules: [
      'Only trade a BIG miss/beat — in-line = no trade',
      'Skip the release bar; enter the first continuation pullback',
      'Direction follows the surprise, not your prior bias',
      'If the first pullback fully reverses, the move was a fade',
    ],
    examples: [
      { symbol: 'ES', date: '2022-10-07', timeframe: '5m',
        context: 'Hot September NFP: sustained risk-off trend down' },
      { symbol: 'NQ', date: '2022-12-02', timeframe: '5m',
        context: 'Strong November payrolls: one-way directional reaction' },
      { symbol: 'ES', date: '2022-02-04', timeframe: '5m',
        context: 'Blowout January NFP: sustained directional move' },
    ],
  },

  // ── PATTERN (intermediate) ───────────────────────────────────
  {
    id: 'bull_bear_flag',
    name: 'Bull/Bear Flag',
    category: 'pattern',
    difficulty: 'intermediate',
    description:
      'A sharp impulsive move (the "pole") is followed by a tight, low-volume consolidation channel (the "flag") that drifts slightly against the move, then continues in the original direction.',
    howToTrade:
      'Identify a strong pole and a tight, orderly flag drifting counter to it. Enter on the break of the flag in the pole direction. Stop on the far side of the flag; measured target is roughly the pole height projected from the break.',
    keyRules: [
      'The pole must be impulsive — gentle moves do not flag',
      'Flag should be tight and on declining volume',
      'Enter on the flag break, not inside the flag',
      'A deep flag that erases the pole invalidates it',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Sharp CPI thrust, tight bull-flag, then continuation' },
      { symbol: 'ES', date: '2022-08-26', timeframe: '5m',
        context: 'Jackson Hole rout: bear flags all afternoon' },
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'Post-FOMC impulse, flag, then continuation up' },
    ],
  },
  {
    id: 'head_and_shoulders',
    name: 'Head and Shoulders',
    category: 'pattern',
    difficulty: 'intermediate',
    description:
      'Three peaks with the middle (the "head") highest and two lower "shoulders", connected by a "neckline". A break of the neckline signals a trend reversal. The inverse marks a bottom.',
    howToTrade:
      'Spot the three-peak structure and draw the neckline across the lows between them. The setup triggers on a decisive neckline break, not on the right shoulder. Measured target is the head-to-neckline height projected from the break.',
    keyRules: [
      'Needs three clear peaks, head distinctly highest',
      'Trigger is the neckline break, confirmed by a close',
      'Volume typically fades into the right shoulder',
      'A reclaim back above the neckline invalidates it',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-05-20', timeframe: '5m',
        context: 'Intraday H&S top into resistance, then reversal' },
      { symbol: 'ES', date: '2022-08-26', timeframe: '5m',
        context: 'Morning H&S top ahead of the Powell-speech break' },
      { symbol: 'NQ', date: '2022-12-13', timeframe: '5m',
        context: 'Gap-up forms an H&S top through the session' },
    ],
  },
  {
    id: 'liquidity_sweep',
    name: 'Liquidity Sweep',
    category: 'pattern',
    difficulty: 'intermediate',
    description:
      'Price spikes through an obvious swing high/low where stop orders cluster, grabs that liquidity, then immediately reverses back inside. The "stop run" is the fuel for the move the other way.',
    howToTrade:
      'Mark obvious prior swing highs/lows (where stops sit). When price wicks through one and snaps back inside on the same or next candle, enter the reversal with a stop just beyond the sweep extreme.',
    keyRules: [
      'Target obvious stop pools — prior swing highs/lows',
      'The reversal must be immediate (wick + fast reclaim)',
      'Stop is tight, just past the swept extreme',
      'No fast reclaim = a real break, not a sweep — skip it',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Swept the prior low for stops, then immediately reversed' },
      { symbol: 'ES', date: '2022-02-24', timeframe: '5m',
        context: 'Spiked through the overnight low then snapped back' },
      { symbol: 'ES', date: '2022-01-24', timeframe: '5m',
        context: 'Stop-run below the prior swing low before the V' },
    ],
  },
  {
    id: 'vwap_reclaim',
    name: 'VWAP Reclaim',
    category: 'pattern',
    difficulty: 'intermediate',
    description:
      'Price trades below VWAP, then reclaims it from below and holds — signaling intraday control has shifted from sellers to buyers (or the inverse). VWAP is the session\'s fair-value anchor.',
    howToTrade:
      'Watch a session trading below VWAP. When price pushes back above it and HOLDS on a retest from above, enter long with a stop back below VWAP. The hold of the retest is the confirmation, not the first touch.',
    keyRules: [
      'The reclaim must HOLD a retest, not just tag VWAP',
      'Confirmation is the successful retest from above',
      'Stop goes back below VWAP — a loss of it negates the idea',
      'Strongest when it aligns with a higher-timeframe level',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Lost VWAP on the CPI spike, reclaimed from below, ran' },
      { symbol: 'ES', date: '2022-11-30', timeframe: '5m',
        context: 'Reclaimed VWAP on the Powell pivot; control shifted up' },
      { symbol: 'NQ', date: '2022-07-19', timeframe: '5m',
        context: 'Held above reclaimed VWAP all session in the uptrend' },
    ],
  },
];

export const SETUP_LIBRARY_COUNT = SETUP_LIBRARY.length;

export function getLibrarySetup(id: string): LibrarySetup | undefined {
  return SETUP_LIBRARY.find((s) => s.id === id);
}
