/**
 * Weekly performance recap ("Sunday Wrap") generator.
 *
 * Pure, dependency-free, fully testable. The caller (the auto-
 * trigger hook + the Journal review path) passes ALL closed
 * trades + streak data + a tradeId→grade map; this module filters
 * to the target week (Mon 00:00 → Sun 23:59, local) and produces
 * the recap object, including the auto-derived "edge insight".
 *
 * Known v1 limitation: `totalTrainingMinutes` is best-effort. The
 * streak system only persists *today's* training bucket, not a
 * per-day history, so the caller passes whatever it has (today's
 * minutes). A true weekly training accumulator is a follow-up
 * (would require expanding the streak store).
 */

export type TradeGrade = 'A+' | 'A' | 'B' | 'C' | 'F';
export type Direction = 'long' | 'short';

export interface RecapTrade {
  tradeId: string;
  symbol: string;
  side: 'buy' | 'sell';
  pnl: number;
  /** Unix ms. */
  openedAt: number;
  /** Unix ms — the week bucket is keyed on this. */
  closedAt: number;
}

export interface RecapStreakData {
  currentStreak: number;
  totalTrainingMinutes: number;
}

export interface WeeklyRecap {
  weekId: string;            // ISO "2026-W20"
  dateRange: string;         // "May 12 – 18, 2026"
  weekStart: number;         // unix ms (Mon 00:00 local)
  weekEnd: number;           // unix ms (Sun 23:59:59.999 local)
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;    // %, null if < 2 trades
  totalPnL: number;
  bestTrade: { symbol: string; pnl: number; direction: Direction } | null;
  worstTrade: { symbol: string; pnl: number; direction: Direction } | null;
  totalTrainingMinutes: number;
  currentStreak: number;
  edgeInsight: string | null;
  generatedAt: string;       // ISO datetime
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// ── Week math ──────────────────────────────────────────────────────────────

/** Monday-00:00 → Sunday-23:59:59.999 (local) for the week
 *  containing `ref`. */
export function weekBounds(ref: Date): { start: number; end: number } {
  const dow = (ref.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  const mon = new Date(ref);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon.getTime(), end: sun.getTime() };
}

/** ISO-8601 week id, e.g. "2026-W20". Week 1 is the week with the
 *  year's first Thursday; week numbers are zero-padded so the
 *  string sorts chronologically. */
export function isoWeekId(ref: Date): string {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;       // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);    // Thursday of this week
  const weekYear = d.getUTCFullYear();
  const firstThu = new Date(Date.UTC(weekYear, 0, 4));
  const firstThuDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstThuDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 86_400_000));
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function formatRange(startMs: number, endMs: number): string {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const sMonth = MONTHS[s.getMonth()];
  const eMonth = MONTHS[e.getMonth()];
  const left = `${sMonth} ${s.getDate()}`;
  const right =
    s.getMonth() === e.getMonth()
      ? `${e.getDate()}`
      : `${eMonth} ${e.getDate()}`;
  return `${left} – ${right}, ${e.getFullYear()}`;
}

// ── Edge-insight candidates ────────────────────────────────────────────────
// Each candidate returns null if not applicable, else { text, interest }.
// We pick the applicable candidate with the highest `interest`; ties
// break toward the earlier-listed candidate (stable iteration).

interface Insight { text: string; interest: number; }

function longShortInsight(trades: RecapTrade[]): Insight | null {
  if (trades.length < 3) return null;
  const longs  = trades.filter((t) => t.side === 'buy');
  const shorts = trades.filter((t) => t.side === 'sell');
  if (longs.length === 0 || shorts.length === 0) return null;
  const wr = (arr: RecapTrade[]) =>
    (arr.filter((t) => t.pnl > 0).length / arr.length) * 100;
  const lWR = Math.round(wr(longs));
  const sWR = Math.round(wr(shorts));
  const edge = lWR >= sWR ? 'longs' : 'shorts';
  return {
    text: `You won ${lWR}% on longs vs ${sWR}% on shorts. Your edge is ${edge} this week.`,
    interest: Math.abs(lWR - sWR),
  };
}

function holdDurationInsight(trades: RecapTrade[]): Insight | null {
  if (trades.length < 3) return null;
  const winners = trades.filter((t) => t.pnl > 0);
  const losers  = trades.filter((t) => t.pnl <= 0);
  if (winners.length === 0 || losers.length === 0) return null;
  const avgMin = (arr: RecapTrade[]) =>
    arr.reduce((acc, t) => acc + (t.closedAt - t.openedAt), 0) /
    arr.length / 60_000;
  const w = Math.round(avgMin(winners));
  const l = Math.round(avgMin(losers));
  const verdict =
    l <= w
      ? "You're cutting losers fast — good sign."
      : 'Try cutting losers faster.';
  return {
    text: `You held winners ${w}m on average, losers ${l}m. ${verdict}`,
    interest: Math.abs(w - l),
  };
}

function consistencyInsight(trades: RecapTrade[]): Insight | null {
  if (trades.length < 3) return null;
  const days = new Set(
    trades.map((t) => new Date(t.closedAt).toDateString()),
  );
  const n = days.size;
  const verdict =
    n >= 4
      ? 'Consistency builds edge.'
      : 'More sessions = more data = sharper edge.';
  return {
    text: `You traded ${n} out of 7 days this week. ${verdict}`,
    // More-traded weeks are more "interesting" to surface, but this
    // is the weakest signal — keep its interest modest so the
    // stat-based ones win when they're meaningful.
    interest: n,
  };
}

function journalInsight(
  trades: RecapTrade[],
  grades: Record<string, TradeGrade | undefined>,
): Insight | null {
  if (trades.length < 3) return null;
  const aGraded = trades.filter((t) => {
    const g = grades[t.tradeId];
    return g === 'A+' || g === 'A';
  });
  if (aGraded.length === 0) return null;
  const wr = Math.round(
    (aGraded.filter((t) => t.pnl > 0).length / aGraded.length) * 100,
  );
  return {
    text: `Your A-graded trades won ${wr}% this week. Trust your process.`,
    interest: Math.abs(wr - 50) + 5, // strong process signal
  };
}

function deriveEdgeInsight(
  trades: RecapTrade[],
  grades: Record<string, TradeGrade | undefined>,
): string | null {
  if (trades.length < 3) {
    return trades.length > 0
      ? 'Keep trading to unlock deeper weekly insights.'
      : null;
  }
  // Spec order is the tie-break order.
  const candidates = [
    longShortInsight(trades),
    holdDurationInsight(trades),
    consistencyInsight(trades),
    journalInsight(trades, grades),
  ].filter((c): c is Insight => c !== null);

  if (candidates.length === 0) {
    return 'Keep trading to unlock deeper weekly insights.';
  }
  let best = candidates[0];
  for (const c of candidates) {
    if (c.interest > best.interest) best = c;
  }
  return best.text;
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Generate the recap for the week containing `refDate`. `allTrades`
 * is the FULL closed-trade history; this filters to the week by
 * `closedAt`. `grades` maps tradeId → grade (from tradeJournalStore)
 * for the journal-correlation insight.
 */
export function generateWeeklyRecap(
  refDate: Date,
  allTrades: RecapTrade[],
  streak: RecapStreakData,
  grades: Record<string, TradeGrade | undefined> = {},
): WeeklyRecap {
  const { start, end } = weekBounds(refDate);
  const trades = allTrades.filter(
    (t) => t.closedAt >= start && t.closedAt <= end,
  );

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
  const winRate =
    trades.length >= 2
      ? Math.round((wins / trades.length) * 100)
      : null;

  const dir = (t: RecapTrade): Direction =>
    t.side === 'buy' ? 'long' : 'short';

  let bestTrade: WeeklyRecap['bestTrade'] = null;
  let worstTrade: WeeklyRecap['worstTrade'] = null;
  if (trades.length > 0) {
    const sorted = [...trades].sort((a, b) => b.pnl - a.pnl);
    const top = sorted[0];
    const bot = sorted[sorted.length - 1];
    bestTrade = { symbol: top.symbol, pnl: top.pnl, direction: dir(top) };
    worstTrade = { symbol: bot.symbol, pnl: bot.pnl, direction: dir(bot) };
  }

  return {
    weekId: isoWeekId(refDate),
    dateRange: formatRange(start, end),
    weekStart: start,
    weekEnd: end,
    totalTrades: trades.length,
    wins,
    losses,
    winRate,
    totalPnL,
    bestTrade,
    worstTrade,
    totalTrainingMinutes: Math.max(0, Math.round(streak.totalTrainingMinutes)),
    currentStreak: streak.currentStreak,
    edgeInsight: deriveEdgeInsight(trades, grades),
    generatedAt: new Date().toISOString(),
  };
}
