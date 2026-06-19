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
  /** Setup Library id when the trade was tagged in the pre-trade
   *  modal. Null for untagged / legacy trades. */
  setupId?: string | null;
  /** Pre-trade discipline checklist passed (all 5 items checked). */
  checklistPassed?: boolean;
  /** Realised R = pnl / intendedRisk. Null pre-plan. */
  rrAchieved?: number | null;
  /** Planned R at entry. 0 when no captured plan. */
  intendedRR?: number;
  /** Set by the auto-journal at close when XP was awarded.
   *  Optional — falls back to per-trade approximation. */
  journaled?: boolean;
  /** First trade of the day (per `xpStore.registerTrade`). */
  firstOfDay?: boolean;
}

export interface RecapStreakData {
  currentStreak: number;
  totalTrainingMinutes: number;
}

export interface RecapTradeRef {
  tradeId: string;
  symbol: string;
  pnl: number;
  direction: Direction;
}

export interface RecapSetupRef {
  setupId: string;
  name: string;
  /** Friendly category label (e.g. "Momentum"). */
  category: string;
  netPnl: number;
  tradeCount: number;
}

export interface RecapPlanAdherence {
  hitTarget: number;
  partial: number;
  earlyExit: number;
  stoppedOut: number;
  /** Sum of bucket counts; trades excluded when rrAchieved / intendedRR missing. */
  totalScored: number;
}

export interface RecapNextWeek {
  kind: 'cutLosers' | 'useChecklist' | 'keepGoing';
  title: string;
  reason: string;
  /** Setup id — preserved on persisted recaps for back-compat
   *  with previously-generated payloads. No longer renders a
   *  user-facing CTA. */
  setupId?: string;
}

export interface RecapPrevWeek {
  netPnl: number;
  winRate: number | null;
  profitFactor: number | 'inf' | null;
  tradeCount: number;
}

export interface WeeklyRecap {
  weekId: string;            // ISO "2026-W20"
  dateRange: string;         // "May 12 – 18, 2026"
  weekStart: number;         // unix ms (Mon 00:00 local)
  weekEnd: number;           // unix ms (Sun 23:59:59.999 local)

  // Outcome
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  totalPnL: number;
  profitFactor: number | 'inf' | null;
  bestTrade: RecapTradeRef | null;
  worstTrade: RecapTradeRef | null;

  // Setup roll-ups
  topSetup: RecapSetupRef | null;
  bottomSetup: RecapSetupRef | null;

  // Process
  /** % of trades with checklistPassed === true. 0 when no trades. */
  disciplineRate: number;
  planAdherence: RecapPlanAdherence;

  // Engagement
  /** Best-effort XP from this week's trade closes (base +
   *  first-of-day + win + journal bonus when known). */
  xpEarned: number;
  /** Distinct local-tz days with ≥ 1 closed trade. */
  sessionsCount: number;

  // Comparison
  prevWeek: RecapPrevWeek | null;

  // Streak / engagement legacy fields kept for the older modal
  // pass + the auto-trigger hook.
  totalTrainingMinutes: number;
  currentStreak: number;

  // Recommendation
  nextRecommendation: RecapNextWeek | null;

  // Legacy single-line takeaway — kept rendering-side for compat.
  edgeInsight: string | null;

  generatedAt: string;
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
/** Setup-name catalog lookup the recap needs for topSetup /
 *  bottomSetup labels. Caller passes a map (setupId → name / category)
 *  so this utility stays decoupled from setupLibrary.ts. */
export type SetupCatalogEntry = { name: string; category: string };
export type SetupCatalog = Record<string, SetupCatalogEntry>;

function summariseOutcome(trades: RecapTrade[]): {
  wins: number;
  losses: number;
  totalPnL: number;
  winRate: number | null;
  profitFactor: number | 'inf' | null;
} {
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const totalPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
  const winRate = trades.length >= 2
    ? Math.round((wins / trades.length) * 100)
    : null;

  let grossProfit = 0;
  let grossLoss = 0;
  for (const t of trades) {
    if (t.pnl > 0) grossProfit += t.pnl;
    else if (t.pnl < 0) grossLoss += -t.pnl;
  }
  let profitFactor: number | 'inf' | null;
  if (trades.length < 2) profitFactor = null;
  else if (grossLoss === 0) profitFactor = grossProfit > 0 ? 'inf' : null;
  else profitFactor = grossProfit / grossLoss;

  return { wins, losses, totalPnL, winRate, profitFactor };
}

function bucketAdherence(trades: RecapTrade[]): RecapPlanAdherence {
  const out: RecapPlanAdherence = {
    hitTarget: 0, partial: 0, earlyExit: 0, stoppedOut: 0, totalScored: 0,
  };
  for (const t of trades) {
    const r = t.rrAchieved;
    const plan = t.intendedRR ?? 0;
    if (typeof r !== 'number' || !Number.isFinite(r)) continue;
    if (plan <= 0) continue;
    out.totalScored++;
    if (r >= plan * 0.95)  out.hitTarget++;
    else if (r <= -0.95)   out.stoppedOut++;
    else if (r > 0)        out.partial++;
    else                   out.earlyExit++;
  }
  return out;
}

function distinctLocalDays(trades: RecapTrade[]): number {
  const days = new Set<string>();
  for (const t of trades) {
    const d = new Date(t.closedAt);
    const p = (n: number) => (n < 10 ? '0' + n : '' + n);
    days.add(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
  return days.size;
}

/** Best-effort weekly XP estimate. Mirrors the rules in
 *  `TradingScreen` close-handler + the PostTradeSummaryModal
 *  Done-handler:
 *    base 5 per trade, +5 on a win, +15 first-of-day, +15 if
 *    journaled (rating set or note saved — flagged via
 *    `journaled` on the RecapTrade if the caller knows). */
function estimateXp(trades: RecapTrade[]): number {
  let xp = 0;
  for (const t of trades) {
    xp += 5; // base
    if (t.firstOfDay) xp += 15;
    if (t.pnl > 0)    xp += 5;
    if (t.journaled)  xp += 15;
  }
  return xp;
}

function rollUpSetups(
  trades: RecapTrade[],
  catalog: SetupCatalog,
): { top: RecapSetupRef | null; bottom: RecapSetupRef | null } {
  const groups = new Map<string, RecapTrade[]>();
  for (const t of trades) {
    if (!t.setupId) continue;
    const arr = groups.get(t.setupId);
    if (arr) arr.push(t);
    else groups.set(t.setupId, [t]);
  }
  const rolled: RecapSetupRef[] = [];
  for (const [setupId, group] of groups) {
    const meta = catalog[setupId];
    if (!meta) continue;
    let netPnl = 0;
    for (const t of group) netPnl += t.pnl;
    rolled.push({
      setupId,
      name: meta.name,
      category: meta.category,
      netPnl,
      tradeCount: group.length,
    });
  }
  if (rolled.length === 0) return { top: null, bottom: null };
  rolled.sort((a, b) => b.netPnl - a.netPnl);
  return {
    top: rolled[0],
    bottom: rolled[rolled.length - 1],
  };
}

function pickRecommendation(
  trades: RecapTrade[],
  topSetup: RecapSetupRef | null,
  // Reserved for a future "watch your reads on {bottomSetup}" branch —
  // for now the BY SETUP card carries that takeaway directly.
  _bottomSetup: RecapSetupRef | null,
  profitFactor: number | 'inf' | null,
  disciplineRate: number,
): RecapNextWeek | null {
  // 1. Profit factor < 1 — cut losers.
  if (typeof profitFactor === 'number' && profitFactor < 1 && trades.length >= 3) {
    return {
      kind: 'cutLosers',
      title: 'Focus on cutting losers',
      reason: 'Your average loser is bigger than your average winner this week.',
    };
  }
  // 2. Low discipline — checklist.
  if (disciplineRate < 70 && trades.length >= 3) {
    return {
      kind: 'useChecklist',
      title: 'Use the checklist every trade',
      reason: 'You completed the pre-trade checks on fewer than 70% of trades.',
    };
  }
  // 3. Strong setup signal — keep going.
  if (topSetup && topSetup.tradeCount >= 3 && topSetup.netPnl > 0) {
    return {
      kind: 'keepGoing',
      title: `Keep trading ${topSetup.name}`,
      reason: 'Your edge this week was on this pattern.',
      setupId: topSetup.setupId,
    };
  }
  return null;
}

export function generateWeeklyRecap(
  refDate: Date,
  allTrades: RecapTrade[],
  streak: RecapStreakData,
  grades: Record<string, TradeGrade | undefined> = {},
  catalog: SetupCatalog = {},
): WeeklyRecap {
  const { start, end } = weekBounds(refDate);
  const trades = allTrades.filter(
    (t) => t.closedAt >= start && t.closedAt <= end,
  );

  const this_ = summariseOutcome(trades);

  const dir = (t: RecapTrade): Direction =>
    t.side === 'buy' ? 'long' : 'short';

  let bestTrade: RecapTradeRef | null = null;
  let worstTrade: RecapTradeRef | null = null;
  if (trades.length > 0) {
    const sorted = [...trades].sort((a, b) => b.pnl - a.pnl);
    const top = sorted[0];
    const bot = sorted[sorted.length - 1];
    bestTrade  = { tradeId: top.tradeId, symbol: top.symbol, pnl: top.pnl, direction: dir(top) };
    worstTrade = { tradeId: bot.tradeId, symbol: bot.symbol, pnl: bot.pnl, direction: dir(bot) };
  }

  const setups = rollUpSetups(trades, catalog);

  // Discipline rate — % of trades that completed the checklist.
  const checklistPassed = trades.filter((t) => t.checklistPassed).length;
  const disciplineRate = trades.length > 0
    ? Math.round((checklistPassed / trades.length) * 100)
    : 0;

  const planAdherence = bucketAdherence(trades);
  const xpEarned = estimateXp(trades);
  const sessionsCount = distinctLocalDays(trades);

  // Prior-week snapshot — same week-bounds math, ref one week back.
  const prevRef = new Date(refDate.getTime() - 7 * 86_400_000);
  const { start: pStart, end: pEnd } = weekBounds(prevRef);
  const prevTrades = allTrades.filter(
    (t) => t.closedAt >= pStart && t.closedAt <= pEnd,
  );
  const prev = summariseOutcome(prevTrades);
  const prevWeek: RecapPrevWeek | null = prevTrades.length > 0 ? {
    netPnl: prev.totalPnL,
    winRate: prev.winRate,
    profitFactor: prev.profitFactor,
    tradeCount: prevTrades.length,
  } : null;

  const nextRecommendation = pickRecommendation(
    trades,
    setups.top,
    setups.bottom,
    this_.profitFactor,
    disciplineRate,
  );

  return {
    weekId: isoWeekId(refDate),
    dateRange: formatRange(start, end),
    weekStart: start,
    weekEnd: end,
    totalTrades: trades.length,
    wins: this_.wins,
    losses: this_.losses,
    winRate: this_.winRate,
    totalPnL: this_.totalPnL,
    profitFactor: this_.profitFactor,
    bestTrade,
    worstTrade,
    topSetup: setups.top,
    bottomSetup: setups.bottom,
    disciplineRate,
    planAdherence,
    xpEarned,
    sessionsCount,
    prevWeek,
    totalTrainingMinutes: Math.max(0, Math.round(streak.totalTrainingMinutes)),
    currentStreak: streak.currentStreak,
    nextRecommendation,
    edgeInsight: deriveEdgeInsight(trades, grades),
    generatedAt: new Date().toISOString(),
  };
}
