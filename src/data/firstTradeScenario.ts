/**
 * First-trade scenario fixture — screen 9 (Onboarding First Trade).
 *
 * Hand-crafted NQ-like 5-minute candle data. Pre-baked because:
 *  - Screen 9 must work offline (no backend round-trip during the
 *    activation event).
 *  - Every user sees the same chart, so the activation experience is
 *    reproducible.
 *  - Bounded array + a clamped reveal counter on the consumer side
 *    make out-of-bounds access structurally impossible.
 *
 * Shape: 30 pre-event chop bars (indices 0-29, ~11,490-11,520) +
 * 3 post-event bars (indices 30-32) trending cleanly UP by 30 points.
 * Entry at bar 29's close (11,500), exit at bar 32's close (11,530)
 * yields ±$600 P&L on 1 contract at NQ's $20/point — meaningful but
 * non-absurd on the default $50K account (1.2 % move).
 *
 * BUY  → wins → FIRST STRIKE badge.
 * SELL → loses → FIRST BLOOD badge (reframed positively on screen D).
 */

export interface OhlcBar {
  o: number;
  h: number;
  l: number;
  c: number;
}

export const FIRST_TRADE_BARS: OhlcBar[] = [
  // ── Pre-event chop (indices 0-29) — gentle 11,490 → 11,520 range ──
  { o: 11498, h: 11506, l: 11495, c: 11503 },
  { o: 11503, h: 11510, l: 11500, c: 11508 },
  { o: 11508, h: 11512, l: 11502, c: 11505 },
  { o: 11505, h: 11509, l: 11498, c: 11500 },
  { o: 11500, h: 11507, l: 11497, c: 11504 },
  { o: 11504, h: 11512, l: 11503, c: 11510 },
  { o: 11510, h: 11518, l: 11507, c: 11515 },
  { o: 11515, h: 11520, l: 11510, c: 11512 },
  { o: 11512, h: 11517, l: 11505, c: 11508 },
  { o: 11508, h: 11513, l: 11498, c: 11501 },
  { o: 11501, h: 11508, l: 11498, c: 11505 },
  { o: 11505, h: 11512, l: 11502, c: 11509 },
  { o: 11509, h: 11514, l: 11504, c: 11506 },
  { o: 11506, h: 11510, l: 11498, c: 11500 },
  { o: 11500, h: 11506, l: 11495, c: 11497 },
  { o: 11497, h: 11502, l: 11492, c: 11495 },
  { o: 11495, h: 11503, l: 11493, c: 11500 },
  { o: 11500, h: 11508, l: 11497, c: 11505 },
  { o: 11505, h: 11510, l: 11502, c: 11507 },
  { o: 11507, h: 11512, l: 11503, c: 11509 },
  { o: 11509, h: 11515, l: 11506, c: 11512 },
  { o: 11512, h: 11518, l: 11508, c: 11515 },
  { o: 11515, h: 11520, l: 11510, c: 11513 },
  { o: 11513, h: 11516, l: 11505, c: 11507 },
  { o: 11507, h: 11512, l: 11502, c: 11506 },
  { o: 11506, h: 11510, l: 11500, c: 11503 },
  { o: 11503, h: 11508, l: 11498, c: 11501 },
  { o: 11501, h: 11506, l: 11498, c: 11504 },
  { o: 11504, h: 11510, l: 11500, c: 11508 },
  { o: 11508, h: 11512, l: 11498, c: 11500 }, // index 29 — ENTRY (close = 11,500)
  // ── Post-event: clean +30 pt UP move (indices 30-32) ──
  { o: 11500, h: 11515, l: 11498, c: 11510 }, // +10
  { o: 11510, h: 11522, l: 11508, c: 11520 }, // +10
  { o: 11520, h: 11532, l: 11518, c: 11530 }, // +10 — exit @ 11,530
];

/** Index of the bar whose close the user enters at. The bar is the
 *  last one initially visible on screen 9 state B. */
export const FIRST_TRADE_ENTRY_INDEX = 29;

/** Number of bars the user can advance past the entry. Fixed; the
 *  consumer clamps revealedCount so a 4th tap is a no-op. */
export const FIRST_TRADE_TOTAL_ADVANCES = 3;

/** Total bars the chart will ever reveal — entry + advances + 1
 *  (because revealedCount is a 1-based count, not an index). Used by
 *  the screen to clamp `revealedCount`. */
export const FIRST_TRADE_MAX_REVEALED =
  FIRST_TRADE_ENTRY_INDEX + 1 + FIRST_TRADE_TOTAL_ADVANCES; // 33

/** NQ point value — $20 per point per contract. 1 contract. */
export const FIRST_TRADE_POINT_VALUE = 20;
export const FIRST_TRADE_CONTRACTS = 1;

/** Cosmetic header labels — the specific date doesn't matter because
 *  the data is hardcoded, but a real-looking label sells the
 *  "real historical chart" framing. */
export const FIRST_TRADE_SYMBOL = 'NQ';
export const FIRST_TRADE_DATE_LABEL = '2022-09-13 · 5m';
