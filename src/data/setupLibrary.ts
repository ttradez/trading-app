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

import type { RankId } from './rankConfig';

export type ClassicCategory =
  | 'momentum' | 'reversal' | 'range' | 'news' | 'pattern';
export type IctCategory =
  | 'structure' | 'entry' | 'liquidity' | 'time';
export type SetupCategory = ClassicCategory | IctCategory;

export type SetupSection = 'classic' | 'ict';

export type SetupDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** Setup vs. concept classification. `setup` = an entry trigger
 *  (most entries). `concept` = a filter, framework, or context tool
 *  with no entry trigger (e.g. Premium/Discount, Kill Zones,
 *  BSL/SSL). Drives the eyebrow tag on the library card so users
 *  can tell at a glance whether a row teaches them HOW to enter or
 *  WHEN/WHERE entries are valid. */
export type SetupType = 'setup' | 'concept';

/** Accent for all ICT category labels — violet, distinct from the
 *  per-category Classic palette. */
export const ICT_ACCENT = '#9B59B6';

export interface SetupExample {
  symbol: string;
  /** YYYY-MM-DD historical date (2022). */
  date: string;
  timeframe: string;
  /** One-line note on what happened that day. */
  context: string;
}

/** Deep lesson content for a setup. Optional on the top-level
 *  LibrarySetup — entries authored before the 50-setup expansion
 *  inline these fields directly (back-compat). The 2026 expansion
 *  batch sets `lesson: null` to mark "schema wired, lesson copy to
 *  follow"; SetupDetailScreen renders a "Lesson coming soon" state
 *  in that case. */
export interface LessonContent {
  /** 2-3 sentences: how to identify + trade it. */
  howToTrade: string;
  /** 3-4 short checklist rules. */
  keyRules: string[];
  /** 2-3 replay-able historical examples. */
  examples: SetupExample[];
}

export interface LibrarySetup {
  id: string;
  name: string;
  category: SetupCategory;
  difficulty: SetupDifficulty;
  /** 'setup' = entry trigger; 'concept' = filter/framework/context.
   *  Required — every entry must declare which it is. */
  type: SetupType;
  /** 2-3 sentences: what this setup IS. */
  description: string;
  /** One-line trigger rule. Newer (2026 expansion) entries set this;
   *  older entries surface their trigger through `keyRules` instead. */
  rule?: string;
  /** Legacy inline lesson fields — present on the original 28
   *  entries. New 2026-expansion entries leave these undefined and
   *  set `lesson: null` instead. */
  howToTrade?: string;
  keyRules?: string[];
  examples?: SetupExample[];
  /** Lesson content. `undefined` on legacy entries (they inline the
   *  fields above for back-compat). `null` explicitly marks
   *  "schema-only entry; full lesson copy is on the way" and flips
   *  SetupDetailScreen into a "Lesson coming soon" state. A non-null
   *  object is the new canonical home for deep content once legacy
   *  entries migrate. */
  lesson?: LessonContent | null;
  /** 'classic' (default when omitted — keeps the original 15
   *  untouched) or 'ict'. */
  section?: SetupSection;
  /** Soft rank gate: minimum rank to open the detail. Omitted =
   *  unlocked from the start. */
  unlock?: RankId;
}

/** Section of a setup, defaulting absent → 'classic' so the
 *  original 15 entries need no edit. */
export function getSection(s: LibrarySetup): SetupSection {
  return s.section ?? 'classic';
}

/** Category accent (mirrors the rank theme palette already in use
 *  so the app stays visually coherent). */
export const CATEGORY_COLOR: Record<SetupCategory, string> = {
  // Classic categories: neutral white@60% eyebrow weight (was gold;
  // demoted per DESIGN_AUDIT §2.2 — the card's "Learn & Practice →"
  // link is the actionable gold; the category tag is metadata, so
  // it should read as a quiet label, not compete for attention).
  momentum: 'rgba(255,255,255,0.6)',
  reversal: 'rgba(255,255,255,0.6)',
  range:    'rgba(255,255,255,0.6)',
  news:     'rgba(255,255,255,0.6)',
  pattern:  'rgba(255,255,255,0.6)',
  // ICT categories all use the single violet accent (unchanged).
  structure: ICT_ACCENT,
  entry:     ICT_ACCENT,
  liquidity: ICT_ACCENT,
  time:      ICT_ACCENT,
};

export const CATEGORY_LABEL: Record<SetupCategory, string> = {
  momentum: 'MOMENTUM',
  reversal: 'REVERSAL',
  range:    'RANGE',
  news:     'NEWS',
  pattern:  'PATTERN',
  structure: 'STRUCTURE',
  entry:     'ENTRY',
  liquidity: 'LIQUIDITY',
  time:      'TIME',
};

/** Type → eyebrow label rendered on each library card. */
export const TYPE_LABEL: Record<SetupType, string> = {
  setup:   'SETUP',
  concept: 'CONCEPT',
};

export const CLASSIC_CATEGORY_ORDER: ClassicCategory[] =
  ['momentum', 'reversal', 'range', 'news', 'pattern'];
export const ICT_CATEGORY_ORDER: IctCategory[] =
  ['structure', 'entry', 'liquidity', 'time'];
/** Back-compat: original Classic order (importers predating ICT). */
export const CATEGORY_ORDER: SetupCategory[] = CLASSIC_CATEGORY_ORDER;

/** Difficulty → pill color. Matches the Daily Mission badge:
 *  beginner green, intermediate gold, advanced red. */
/** Difficulty → pill color. `beginner` uses the desaturated UI
 *  green (`uiGreen #5BC894`), NOT P&L green, so difficulty reads as
 *  a category — not a win/loss signal. */
export const DIFFICULTY_COLOR: Record<SetupDifficulty, string> = {
  beginner:     '#5BC894',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
    description:
      'Since 2020 the knee-jerk move on the 2:00 PM Fed statement often reverses during the 2:30 PM press conference — but not always. Direction depends on the specific language Powell uses in the Q&A. In the pre-2020 Bernanke/Yellen era the presser typically reinforced the statement; the modern fade pattern is a Powell-era phenomenon, not an iron law.',
    howToTrade:
      'Avoid the 2:00 PM spike. Mark the pre-release level. If the initial move fails to hold within ~15 minutes and Powell\'s presser tone cuts against it, fade it on the reclaim of that level and ride the presser trend. If the presser instead reinforces the statement (the pre-2020 norm and still common today), stand aside or trade with the initial move.',
    keyRules: [
      'The 2:00 PM bar is a trap — do not chase it',
      'The 2:30 PM presser is where the real move forms',
      'Fade trigger = failed hold + reclaim of pre-release level',
      'Two-sided and fast; size down and define risk first',
      'Wait for the second move after the headline — the initial spike is the trap, not the trade.',
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
    type: 'setup',
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
    type: 'setup',
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
    type: 'setup',
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
  // NOTE: Classic-section `liquidity_sweep` removed — duplicated the
  // ICT-section `ict_liquidity_sweep` (kept). No external references
  // to the deleted id existed outside this file.
  // NOTE: Classic-section `vwap_reclaim` removed — duplicated the
  // 2026-expansion `vwap-reclaim-momentum` (kept, recategorized to
  // momentum). No external references existed outside this file.

  // ══════════════ ICT — STRUCTURE ══════════════
  {
    id: 'ict_bos',
    name: 'Break of Structure (BOS)',
    category: 'structure',
    difficulty: 'beginner',
    type: 'setup',
    section: 'ict',
    description:
      'Price breaks a prior swing point in the direction of the existing trend, confirming continuation. BOS tells you the trend is intact, not that you should chase it.',
    howToTrade:
      'BOS itself is not an entry — it is confirmation. Wait for a pullback to a fresh OB or FVG created by the BOS impulse, then enter in the BOS direction.',
    keyRules: [
      'Body close beyond the level, not just a wick',
      'BOS validates trend continuation',
      'Always trade pullbacks after BOS, not the breakout candle',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'FOMC first-hike trend day — repeated bullish BOS' },
      { symbol: 'ES', date: '2022-08-19', timeframe: '5m',
        context: 'Down-trend day — clean bearish BOS continuation' },
      { symbol: 'NQ', date: '2022-04-22', timeframe: '5m',
        context: 'Month-end sell-off — successive bearish BOS' },
    ],
  },
  {
    id: 'ict_choch',
    name: 'Change of Character (CHoCH)',
    category: 'structure',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    description:
      'The first break of structure in the opposite direction of the prevailing trend, signaling a potential reversal.',
    howToTrade:
      'Two-step sequence: (1) CHoCH prints — treat it as a warning, not a trigger. (2) Wait for a BOS in the new direction to confirm the reversal. (3) Only then take the entry on a pullback into an OB or FVG that formed during the CHoCH leg. No BOS confirmation, no trade.',
    keyRules: [
      'CHoCH is a warning, not a guarantee — confirm with BOS in the new direction',
      'Higher-timeframe CHoCH carries more weight',
      'First CHoCH after a clear trend is highest probability',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-01-05', timeframe: '5m',
        context: 'Hawkish Fed minutes — CHoCH flipped the morning trend down' },
      { symbol: 'ES', date: '2022-08-16', timeframe: '5m',
        context: 'Rally exhaustion — CHoCH ahead of the reversal' },
      { symbol: 'NQ', date: '2022-03-29', timeframe: '5m',
        context: 'Quarter-end — intraday CHoCH off the range high' },
    ],
  },
  {
    id: 'ict_premium_discount',
    name: 'Premium / Discount',
    category: 'structure',
    difficulty: 'beginner',
    type: 'concept',
    section: 'ict',
    description:
      'Above the 50% level of a range is premium (favor shorts). Below is discount (favor longs). Buy in discount, sell in premium.',
    howToTrade:
      'Only short in premium, only long in discount, in the direction of the higher-timeframe bias. Combine with an OB/FVG inside the zone for the entry.',
    keyRules: [
      'Never long in premium, never short in discount',
      'The range must be clean and recent',
      'Equilibrium (50%) is a reaction zone itself',
    ],
    examples: [
      { symbol: 'ES', date: '2022-05-24', timeframe: '5m',
        context: 'Range day — shorts only worked from premium' },
      { symbol: 'NQ', date: '2022-09-28', timeframe: '5m',
        context: 'Discount longs into the equilibrium bounce' },
      { symbol: 'ES', date: '2022-07-14', timeframe: '5m',
        context: 'Sold premium, covered at equilibrium' },
    ],
  },
  {
    id: 'ict_mss',
    name: 'Market Structure Shift (MSS)',
    category: 'structure',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    description:
      'A displacement candle that breaks recent structure with momentum, leaving an FVG behind. The highest-confidence reversal signal in ICT.',
    howToTrade:
      'Enter on the retrace into the FVG or OB left by the MSS. Stop beyond the sweep extreme.',
    keyRules: [
      'Sweep → MSS → retrace entry, in that order',
      'MSS must include displacement (an FVG)',
      'A wick-only break is not an MSS',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Historic CPI reversal — textbook sweep → MSS → run' },
      { symbol: 'ES', date: '2022-05-12', timeframe: '5m',
        context: 'Capitulation low — MSS with displacement up' },
      { symbol: 'NQ', date: '2022-07-27', timeframe: '5m',
        context: 'FOMC relief — MSS up off the pre-release sweep' },
    ],
  },

  // ══════════════ ICT — ENTRY ══════════════
  {
    id: 'ict_order_block',
    name: 'Order Block (OB)',
    category: 'entry',
    difficulty: 'beginner',
    type: 'setup',
    section: 'ict',
    description:
      'The last opposing candle before an impulsive move that breaks structure. These zones are institutional footprints.',
    howToTrade:
      'Wait for price to retrace into the OB. Enter on confirmation. Stop beyond the OB; target the next liquidity pool.',
    keyRules: [
      'Only valid OBs caused a displacement/BOS',
      'Tapped and broken = invalidated',
      'Higher-TF OBs beat lower-TF OBs',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-01-24', timeframe: '5m',
        context: 'Capitulation reversal — demand OB held the low' },
      { symbol: 'ES', date: '2022-03-15', timeframe: '5m',
        context: 'Pre-FOMC — bullish OB launched the move' },
      { symbol: 'NQ', date: '2022-09-13', timeframe: '5m',
        context: 'Hot CPI — supply OB rejected the bounce (short)' },
    ],
  },
  {
    id: 'ict_fvg',
    name: 'Fair Value Gap (FVG)',
    category: 'entry',
    difficulty: 'beginner',
    type: 'setup',
    section: 'ict',
    description:
      'A three-candle pattern where candle 1 and candle 3 wicks do not overlap, leaving a gap. Price tends to revisit these imbalances.',
    howToTrade:
      'Wait for price to pull back into the FVG and enter on the first reaction. Stop below the FVG.',
    keyRules: [
      'Must be created by displacement, not drift',
      'CE (50% of the gap) is the highest-probability entry',
      'Fully filled and traded through = mitigated',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-02-24', timeframe: '5m',
        context: 'Invasion gap-down V — FVG filled then ran' },
      { symbol: 'ES', date: '2022-05-04', timeframe: '5m',
        context: 'FOMC rip — bullish FVG entries on the impulse' },
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Soft CPI melt-up — stacked bullish FVGs' },
    ],
  },
  {
    id: 'ict_ote',
    name: 'Optimal Trade Entry (OTE)',
    category: 'entry',
    difficulty: 'beginner',
    type: 'setup',
    section: 'ict',
    description:
      'A Fibonacci-based entry zone between the 62% and 79% retracement, with the 70.5% midpoint as the optimal entry. The sweet spot for trend-continuation entries.',
    rule:
      'Enter at the 70.5% retracement (the midpoint of the 62%–79% OTE window) on LTF confirmation.',
    howToTrade:
      'Draw the Fib across the most recent leg in the direction of the bias: for a long bias, anchor it from the most recent pullback low to the swing high that preceded the pullback (inverse for shorts). The 62%–79% retracement is the OTE window; the 70.5% midpoint is the primary entry. Enter on LTF confirmation inside the zone. Stop beyond the swing point. Confluence with an OB/FVG sitting on or around 70.5% = highest probability.',
    keyRules: [
      'Must be in a clear trend or post-MSS',
      '70.5% is the canonical entry; the 62%–79% band is the acceptable window',
      'Anchor the Fib from the pullback extreme to the prior swing in the direction of bias',
      'OB/FVG overlap with the OTE = best',
      'Never enter without invalidation',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'Post-FOMC trend — OTE pullback long' },
      { symbol: 'ES', date: '2022-08-05', timeframe: '5m',
        context: 'NFP day — OTE retrace continuation' },
      { symbol: 'NQ', date: '2022-10-21', timeframe: '5m',
        context: 'WSJ-pivot rally — 62-79% OTE entry off the low' },
    ],
  },
  {
    id: 'ict_breaker',
    name: 'Breaker Block',
    category: 'entry',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    description:
      'A failed order block that becomes support/resistance in the opposite direction. The OB body must be broken AND a market structure shift in the opposite direction must occur — without that MSS it is just a failed OB, not a Breaker.',
    howToTrade:
      'Checklist: (1) the original OB body is broken through (not just wicked). (2) An MSS prints in the opposite direction of the original OB. (3) Wait for price to retest the failed OB — now the Breaker — and enter in the new trend direction. The first retest is highest probability. No MSS in the new direction = not a Breaker, skip it.',
    keyRules: [
      'Original OB must be invalidated by displacement through the body',
      'A market structure shift in the opposite direction is required — no MSS, no Breaker',
      'First retest is best',
      'Combine with HTF bias',
      'Mitigation continues the trend. Breaker reverses it. The diagnostic is whether MSS happened in the opposite direction.',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-06-24', timeframe: '5m',
        context: 'Bear-market bounce — failed OB became a breaker' },
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'Soft CPI — bullish breaker on the retest' },
      { symbol: 'ES', date: '2022-04-06', timeframe: '5m',
        context: 'Hawkish minutes — bearish breaker resistance' },
    ],
  },
  {
    id: 'ict_mitigation',
    name: 'Mitigation Block',
    category: 'entry',
    difficulty: 'advanced',
    type: 'setup',
    section: 'ict',
    unlock: 'sniper',
    description:
      'An unmitigated origin point of a move that gets revisited. Where institutions mitigate their earlier positions.',
    howToTrade:
      'Enter on the return to the mitigation block. Treat partial mitigation (50%) as the trigger.',
    keyRules: [
      'Distinct from a breaker — focuses on the origin',
      'Best when aligned with the HTF PD array',
      'Partial mitigation is the entry',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-09-13', timeframe: '5m',
        context: 'CPI sell-off — origin mitigation on the retrace' },
      { symbol: 'ES', date: '2022-08-26', timeframe: '5m',
        context: 'Jackson Hole rout — supply mitigation re-entry' },
      { symbol: 'NQ', date: '2022-03-07', timeframe: '5m',
        context: 'Risk-off slide — mitigation block held' },
    ],
  },

  // ══════════════ ICT — LIQUIDITY ══════════════
  {
    id: 'ict_liquidity_sweep',
    name: 'Liquidity Sweep (Stop Hunt)',
    category: 'liquidity',
    difficulty: 'beginner',
    type: 'setup',
    section: 'ict',
    description:
      'Price pushes through a visible swing high/low, runs the stops, then reverses sharply. Smart money taking liquidity before the real move.',
    howToTrade:
      'Enter on the reclaim of the swept level after a LTF market structure shift. Stop beyond the sweep wick.',
    keyRules: [
      'Sweep + reversal, not sweep + continuation',
      'The reclaim is the trigger',
      'Best at session or prior-day highs/lows',
    ],
    examples: [
      { symbol: 'ES', date: '2022-06-17', timeframe: '5m',
        context: 'Quad-witching — swept the prior low then reversed' },
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'CPI new low swept stops, then ripped ~5%' },
      { symbol: 'NQ', date: '2022-12-01', timeframe: '5m',
        context: 'Swept the session high, reclaimed, reversed' },
    ],
  },
  {
    id: 'ict_bsl_ssl',
    name: 'Buy-Side / Sell-Side Liquidity (BSL/SSL)',
    category: 'liquidity',
    difficulty: 'beginner',
    type: 'concept',
    section: 'ict',
    description:
      'A draw-on-liquidity framework. Buy-side liquidity sits above swing highs (short stops + breakout buys); sell-side sits below swing lows. Price is drawn toward these pools — use that draw to set your directional bias and targets. Pairs with the Liquidity Sweep setup for the actual entry trigger.',
    howToTrade:
      'Map the obvious BSL and SSL pools on your timeframe (equal highs/lows, prior session high/low, PDH/PDL). Use the nearer pool as the magnet that tells you which direction price is being drawn. The framework ends there — execution lives elsewhere: once price reaches the pool, switch over to the Liquidity Sweep setup (sweep + MSS + OB/FVG retrace) for the actual entry trigger.',
    keyRules: [
      'Use BSL/SSL to define the draw and your targets, not as an entry signal',
      'Equal highs/lows are the strongest magnets',
      'Liquidity taken = often a reversal — but confirm with a setup, do not assume',
      'Always know which side has the more obvious liquidity',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
        context: 'Ran sell-side below the low, reversed hard' },
      { symbol: 'NQ', date: '2022-11-30', timeframe: '5m',
        context: 'Buy-side above equal highs, then trended' },
      { symbol: 'ES', date: '2022-02-10', timeframe: '5m',
        context: 'Hot CPI ran sell-side liquidity' },
    ],
  },

  // ══════════════ ICT — TIME ══════════════
  {
    id: 'ict_kill_zones',
    name: 'Kill Zones',
    category: 'time',
    difficulty: 'beginner',
    type: 'concept',
    section: 'ict',
    description:
      'Canonical NY-local time windows where the highest-quality displacement, sweeps, and MSS tend to occur. This is a session-filter that improves bias selection and timing — not a setup you take by itself. Use it to decide WHEN your other setups are valid.',
    howToTrade:
      'In live trading, the windows are: London Killzone 02:00–05:00 NY, NY AM Killzone 07:00–10:00 NY, and London Close / NY PM 13:00–16:00 NY (sometimes split as 13:30–16:00). In replay, use the session selector to land inside one of these windows, then hunt your actual entry (sweep + MSS + OB/FVG) there. Kill zones bias the WHEN; the entry trigger comes from another library entry.',
    keyRules: [
      'Use as a context filter, not an entry trigger',
      'London Killzone: 02:00–05:00 NY',
      'NY AM Killzone: 07:00–10:00 NY (cleanest sweeps + MSS)',
      'London Close / NY PM: 13:00–16:00 NY',
      'Asia tends to range — expect liquidity build, not displacement',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-09-13', timeframe: '5m',
        context: 'NY AM kill zone — CPI displacement' },
      { symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
        context: 'PM kill zone — post-FOMC expansion' },
      { symbol: 'NQ', date: '2022-07-13', timeframe: '5m',
        context: 'NY AM kill zone — CPI sweep + MSS' },
    ],
  },
  {
    id: 'ict_silver_bullet',
    name: 'Silver Bullet',
    category: 'time',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    description:
      'A specific setup targeting a one-hour window. Look for the first FVG aligned with the daily bias after a sweep or MSS.',
    howToTrade:
      'Enter on the retrace into the FVG. Stop beyond the swing; target the prior session high/low.',
    keyRules: [
      'Bias must be defined before the window',
      'One trade per window — no revenge',
      'Skip if no clean FVG forms',
    ],
    examples: [
      { symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
        context: 'First FVG after the soft-CPI sweep ran clean' },
      { symbol: 'NQ', date: '2022-06-24', timeframe: '5m',
        context: 'Window FVG aligned with the daily bias' },
      { symbol: 'ES', date: '2022-10-04', timeframe: '5m',
        context: 'AM-window FVG to the prior session high' },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // 2026 EXPANSION BATCH — +22 setups (50 total). `lesson: null`
  // marks "schema wired, lesson copy to follow in a separate pass".
  // SetupDetailScreen renders a "Lesson coming soon" body for these
  // until full lesson content lands.
  //
  // ICT-section category note: the source spec assigned several
  // entries to "Reversal" / "Range", which are Classic-only category
  // values. To avoid churning the ICT category union (and the chip
  // filter + color map that hang off it), each ICT-section entry is
  // routed to the closest existing IctCategory:
  //   - reversal-flavored entry triggers → 'entry'
  //   - manipulation / sweep-based setups → 'liquidity'
  //   - Premium/Discount Zones → 'structure' (matches the existing
  //     `ict_premium_discount` entry's categorization)
  // ══════════════════════════════════════════════════════════════

  // ── CLASSIC EXPANSION (13) ──────────────────────────────────

  {
    id: 'vwap-reclaim-momentum',
    name: 'VWAP Reclaim',
    category: 'momentum',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Price loses VWAP, then closes back above on volume — long.',
    description:
      'A more aggressive cousin of the VWAP bounce: price breaks below VWAP, trades below it for a stretch, then "reclaims" the level from below on a clean volume close. The trader is betting that buyers absorbed the breakdown and unwinding shorts will fuel a push back to the day\'s highs.',
    lesson: null,
  },
  {
    id: 'anchored-vwap-bounce',
    name: 'Anchored VWAP Bounce',
    category: 'reversal',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Price pulls back to AVWAP anchored at a key event and rejects.',
    description:
      'A VWAP is anchored to a meaningful pivot (overnight high, FOMC bar, prior day high, earnings, news spike) rather than session open, then traded as dynamic support/resistance. Popularized by Brian Shannon; well-suited to futures because index/commodity opens are arbitrary while institutional reference points are not.',
    lesson: null,
  },
  {
    id: 'initial-balance-break',
    name: 'Initial Balance Break',
    category: 'momentum',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Break of first-hour high or low after IB completes — trade in direction.',
    description:
      'The Initial Balance is the range of the first 60 minutes of RTH (9:30–10:30 ET). When price breaks IBH or IBL with conviction after IB closes, traders enter in the direction of the break, targeting IB-range extensions (1x, 1.5x, 2x). Empirical work cited by Axia/TRADEPRO shows IB extremes get tested in nearly every session.',
    lesson: null,
  },
  {
    id: 'nr7-inside-bar-compression-breakout',
    name: 'NR7 Inside-Bar Compression Breakout',
    category: 'momentum',
    difficulty: 'beginner',
    type: 'setup',
    rule: 'Break of the narrowest-range bar in 7 sessions — trade the side that goes first.',
    description:
      'Toby Crabel\'s volatility-contraction setup: an NR7 (or NR4, or an inside bar) signals that volatility is coiled and an expansion bar is statistically due. Traders buy a break of the NR7 high or short a break of its low, with a stop on the other side. Used extensively by intraday futures and prop traders as a low-noise filter.',
    lesson: null,
  },
  {
    id: 'bull-flag-continuation',
    name: 'Bull Flag Continuation',
    category: 'momentum',
    difficulty: 'beginner',
    type: 'setup',
    rule: 'Buy the break of a tight pullback channel after a strong impulse.',
    description:
      'A sharp impulse ("flagpole") followed by a 5–15-bar parallel-channel consolidation sloping against the trend; entry on the breakout of the flag in the direction of the flagpole. Measured-move target is the flagpole length projected from the breakout. Heavily used on ES/NQ/CL 5- and 15-min charts.',
    lesson: null,
  },
  {
    id: 'bear-flag-continuation',
    name: 'Bear Flag Continuation',
    category: 'momentum',
    difficulty: 'beginner',
    type: 'setup',
    rule: 'Sell the break of a tight pullback channel after a strong impulse.',
    description:
      'A sharp impulse ("flagpole") followed by a 5–15-bar parallel-channel consolidation sloping against the trend; entry on the breakdown of the flag in the direction of the flagpole. Measured-move target is the flagpole length projected from the breakdown. Heavily used on ES/NQ/CL 5- and 15-min charts.',
    lesson: null,
  },
  {
    id: 'pennant-continuation',
    name: 'Pennant Continuation',
    category: 'momentum',
    difficulty: 'beginner',
    type: 'setup',
    rule: 'Buy/sell the break of a small symmetrical triangle after a sharp move.',
    description:
      'Like a flag but the consolidation forms converging trendlines (a small symmetrical triangle) rather than a parallel channel. Same measured-move logic; tighter coil typically produces a more violent break. Treated as a distinct setup from flag because the breakout mechanics and stop placement differ.',
    lesson: null,
  },
  {
    id: 'head-and-shoulders-reversal',
    name: 'Head & Shoulders',
    category: 'reversal',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Short on neckline break after the third shoulder forms.',
    description:
      'A classic three-peak reversal: left shoulder, higher head, lower right shoulder, with a "neckline" connecting the intervening lows. Confirmed on a neckline break, often with a retest; measured target is the head-to-neckline distance projected from the break. Still cited by 2025 prop-firm-funded futures educators for ES/NQ swing-day reversals.',
    lesson: null,
  },
  {
    id: 'inverse-head-and-shoulders',
    name: 'Inverse Head & Shoulders',
    category: 'reversal',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Long on neckline break after the third shoulder forms.',
    description:
      'A classic three-trough reversal: left shoulder, lower head, higher right shoulder, with a "neckline" connecting the intervening highs. Confirmed on a neckline break, often with a retest; measured target is the head-to-neckline distance projected from the break. Still cited by 2025 prop-firm-funded futures educators for ES/NQ swing-day reversals.',
    lesson: null,
  },
  {
    id: 'three-drives',
    name: 'Three Drives',
    category: 'reversal',
    difficulty: 'advanced',
    type: 'setup',
    rule: 'Fade the third symmetrical drive at 1.272/1.618 extension.',
    description:
      'Three symmetric price drives separated by 0.618/0.786 retracements, with each drive extending 1.272 or 1.618 of the prior correction. The third drive\'s completion is the trade — fade it back toward the start of drive 2. Rare but high-RR; cited as a "prized" technical pattern by Forex.com and TradingView education.',
    lesson: null,
  },
  {
    id: 'wyckoff-spring',
    name: 'Wyckoff Spring',
    category: 'reversal',
    difficulty: 'advanced',
    type: 'setup',
    rule: 'Long the snap-back after a false break below range support.',
    description:
      'Wyckoff "Phase C" event inside an accumulation range: price briefly violates support to flush stops, then snaps back inside the range on heavy volume. Treated as the trigger that begins the markup phase.',
    lesson: null,
  },
  {
    id: 'wyckoff-upthrust',
    name: 'Wyckoff Upthrust',
    category: 'reversal',
    difficulty: 'advanced',
    type: 'setup',
    rule: 'Short the rejection of a false break above range resistance.',
    description:
      'Wyckoff "Phase C" event inside a distribution range: price briefly violates resistance to flush stops, then snaps back inside the range on heavy volume. Treated as the trigger that begins the markdown phase.',
    lesson: null,
  },
  {
    id: 'power-hour-reversal',
    name: 'Power Hour Reversal',
    category: 'reversal',
    difficulty: 'intermediate',
    type: 'setup',
    rule: 'Trade the 3 PM ET inflection back toward VWAP or with end-of-day flow.',
    description:
      'The final NYSE hour (3:00–4:00 PM ET) sees an institutional rebalancing flush — volume spikes and intraday extremes often get retested. Setups include fading exhaustion back to VWAP, or riding the dominant side\'s MOC imbalance into the close. Prop-firm traders use it because moves are fast and well-defined.',
    lesson: null,
  },

  // ── ICT EXPANSION (9) ──────────────────────────────────────

  {
    id: 'inversion-fair-value-gap',
    name: 'Inversion Fair Value Gap (IFVG)',
    category: 'entry',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    rule: 'Trade the FVG that price closed through — it now flips polarity as support/resistance.',
    description:
      'When price closes decisively through an existing FVG, the gap "inverts" — a former bullish FVG becomes resistance, and a former bearish FVG becomes support. The retest of the inverted gap is the entry. One of the cleanest reversal triggers in the post-2022 ICT toolkit.',
    lesson: null,
  },
  {
    id: 'balanced-price-range',
    name: 'Balanced Price Range (BPR)',
    category: 'entry',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    rule: 'Enter at the overlap of two opposing FVGs at the same price zone.',
    description:
      'A bullish FVG and a bearish FVG that overlap at the same price form a Balanced Price Range. Returning to the overlap typically produces a sharp reaction in either direction because two independent imbalances are stacked. Often paired with CISD/MSS for confirmation.',
    lesson: null,
  },
  {
    id: 'unicorn-model',
    name: 'Unicorn Model',
    category: 'entry',
    difficulty: 'advanced',
    type: 'setup',
    section: 'ict',
    unlock: 'sniper',
    rule: 'Enter where a Breaker Block and an FVG overlap in the same zone.',
    description:
      'The Unicorn is the high-confluence intersection of a Breaker Block and a Fair Value Gap formed in the same delivery leg. When price retraces back to the overlap, the two PD Arrays reinforce each other — considered one of the highest-conviction setups in the ICT framework.',
    lesson: null,
  },
  {
    id: 'judas-swing',
    name: 'Judas Swing',
    category: 'liquidity',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    rule: 'Fade the false move against daily bias right after session open.',
    description:
      'A false move engineered at the session open (NY midnight → ~05:00 ET, or NY 9:30 open) that runs counter to the day\'s true bias, designed to trap retail and trigger stops before the real move. Trade the reversal once liquidity is swept and structure shifts (MSS/CISD) in the direction of bias.',
    lesson: null,
  },
  {
    id: 'turtle-soup',
    name: 'Turtle Soup',
    category: 'liquidity',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    rule: 'Fade a false breakout beyond a prior swing high/low.',
    description:
      'Price extends just beyond a prior session/swing high or low, sweeps the resting liquidity, then rejects sharply back into range. ICT\'s adaptation of Linda Raschke\'s original Turtle Soup, now codified by session (Asia, London, NY AM/PM) and almost always paired with an opposing FVG or BPR for the entry.',
    lesson: null,
  },
  {
    id: 'market-maker-buy-model',
    name: 'Market Maker Buy Model (MMBM)',
    category: 'liquidity',
    difficulty: 'advanced',
    type: 'setup',
    section: 'ict',
    unlock: 'sniper',
    rule: 'Trade the bullish Smart Money Reversal after the manipulation leg sweeps liquidity.',
    description:
      'A 4-phase institutional delivery framework: Original Consolidation → Engineering Liquidity (the manipulation move) → Smart Money Reversal → Liquidity Hunt to the opposite array. MMBM = bullish version (low to high). Often used as the daily/4H "macro template" inside which other entries (Silver Bullet, Judas, IFVG) trigger.',
    lesson: null,
  },
  {
    id: 'market-maker-sell-model',
    name: 'Market Maker Sell Model (MMSM)',
    category: 'liquidity',
    difficulty: 'advanced',
    type: 'setup',
    section: 'ict',
    unlock: 'sniper',
    rule: 'Trade the bearish Smart Money Reversal after the manipulation leg sweeps liquidity.',
    description:
      'A 4-phase institutional delivery framework: Original Consolidation → Engineering Liquidity (the manipulation move) → Smart Money Reversal → Liquidity Hunt to the opposite array. MMSM = bearish version (high to low). Often used as the daily/4H "macro template" inside which other entries (Silver Bullet, Judas, IFVG) trigger.',
    lesson: null,
  },
  {
    id: 'change-in-state-of-delivery',
    name: 'Change in State of Delivery (CISD)',
    category: 'entry',
    difficulty: 'intermediate',
    type: 'setup',
    section: 'ict',
    unlock: 'paper_hands',
    rule: 'Enter when price closes through the open of the prior delivery leg.',
    description:
      'Earlier reversal signal than a full Market Structure Shift: CISD fires when a candle closes past the open of the most recent opposing-direction leg, signalling delivery has switched from buy-side to sell-side (or vice versa). Used as a candle-close entry trigger, often inside an FVG/OB.',
    lesson: null,
  },
  {
    id: 'premium-discount-zones',
    name: 'Premium/Discount Zones',
    category: 'structure',
    difficulty: 'beginner',
    // NOTE: substantively identical to `ict_premium_discount` above,
    // which is reclassified as `concept`. Left as `setup` here to
    // strictly honor the spec's three-entry concept list — flag for
    // follow-up (likely also belongs in `concept`, or this entry
    // should be deduped against `ict_premium_discount`).
    type: 'setup',
    section: 'ict',
    rule: 'Sell premium (above 50% of range), buy discount (below 50%).',
    description:
      'Within any defined dealing range (recent swing high to swing low), the midpoint (Equilibrium / 0.50) divides "premium" (expensive) from "discount" (cheap). ICT framework calls for buys only in discount and sells only in premium, with the 0.50 line itself a frequent reaction point. A foundational filter layered on top of other entries.',
    lesson: null,
  },
];

/** Section of each setup, splitting Classic from ICT.
 *  `SETUP_LIBRARY_COUNT` is the grand total (48 after the 2026
 *  dedup pass — 28 originals + 22 expansion − 2 duplicates removed
 *  (Classic-section `liquidity_sweep` and `vwap_reclaim`)). */
export const CLASSIC_SETUPS: ReadonlyArray<LibrarySetup> =
  SETUP_LIBRARY.filter((s) => getSection(s) === 'classic');
export const ICT_SETUPS: ReadonlyArray<LibrarySetup> =
  SETUP_LIBRARY.filter((s) => getSection(s) === 'ict');

export const SETUP_LIBRARY_COUNT = SETUP_LIBRARY.length;
export const CLASSIC_COUNT = CLASSIC_SETUPS.length;
export const ICT_COUNT = ICT_SETUPS.length;

export function getLibrarySetup(id: string): LibrarySetup | undefined {
  return SETUP_LIBRARY.find((s) => s.id === id);
}
