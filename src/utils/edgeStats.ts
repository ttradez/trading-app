/**
 * Edge Stats — local behavioral analysis of the user's trade
 * history (Research Feature #5, "Your Tendencies").
 *
 * Pure + synchronous. The screen joins `journalStore` (P&L,
 * direction, hold times, pre-trade plan setup) with
 * `tradeJournalStore` (grade, emotion tags) into `EdgeTrade[]` and
 * hands it here. No P&L "how much" — this is about HOW the user
 * trades: direction bias, hold-time discipline, which setups /
 * emotions / self-grades correlate with winning, and consistency.
 *
 * Every stat has a minimum-sample gate and returns `null` below
 * it so the screen can show "need more data" instead of a
 * misleading number from n=1.
 */

export interface EdgeTrade {
  direction: 'long' | 'short';
  pnl: number;
  /** Replay candle timestamps (ms) — for hold DURATION only. */
  openedAt: number;
  closedAt: number;
  /** Real wall-clock save time (ms) — for weekly consistency. */
  savedAt: number;
  /** Pre-trade plan setup type, or null (skipped / checklist off). */
  setupType: string | null;
  /** Journal emotion tags (0-3), or empty. */
  emotions: string[];
  /** Journal execution grade, or null (not journaled). */
  grade: string | null;
}

export interface GroupStat {
  winRate: number;
  count: number;
}
export interface SetupStat extends GroupStat { setup: string; }
export interface EmotionStat extends GroupStat { emotion: string; }
export interface GradeStat extends GroupStat { grade: string; }

export type InsightType = 'positive' | 'neutral' | 'warning';

export interface EdgeStats {
  totalTrades: number;

  longWinRate: number | null;
  shortWinRate: number | null;
  longCount: number;
  shortCount: number;

  avgWinnerHoldMinutes: number | null;
  avgLoserHoldMinutes: number | null;
  holdRatio: number | null;

  setupStats: SetupStat[] | null;
  emotionStats: EmotionStat[] | null;
  gradeStats: GradeStat[] | null;

  tradesThisWeek: number;
  tradesLastWeek: number;
  journalRate: number;
  avgGrade: string | null;

  headlineInsight: { text: string; type: InsightType } | null;
}

const GRADE_NUM: Record<string, number> = { 'A+': 5, A: 4, B: 3, C: 2, F: 1 };
const NUM_GRADE: Record<number, string> = { 5: 'A+', 4: 'A', 3: 'B', 2: 'C', 1: 'F' };
const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'F'];

const isWin = (t: EdgeTrade) => t.pnl > 0;
const pct = (wins: number, n: number) => (n > 0 ? Math.round((wins / n) * 100) : 0);
const winRateOf = (list: EdgeTrade[]) =>
  pct(list.filter(isWin).length, list.length);
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function computeEdgeStats(trades: EdgeTrade[]): EdgeStats {
  const totalTrades = trades.length;

  // ── Direction bias ────────────────────────────────────────────
  const longs = trades.filter((t) => t.direction === 'long');
  const shorts = trades.filter((t) => t.direction === 'short');
  const longCount = longs.length;
  const shortCount = shorts.length;
  const longWinRate = longCount >= 3 ? winRateOf(longs) : null;
  const shortWinRate = shortCount >= 3 ? winRateOf(shorts) : null;

  // ── Hold duration ─────────────────────────────────────────────
  const holdMin = (t: EdgeTrade) =>
    Math.max(0, (t.closedAt - t.openedAt) / 60000);
  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl < 0);
  const avgWinnerHoldMinutes =
    winners.length >= 3 ? mean(winners.map(holdMin)) : null;
  const avgLoserHoldMinutes =
    losers.length >= 3 ? mean(losers.map(holdMin)) : null;
  const holdRatio =
    avgWinnerHoldMinutes != null &&
    avgLoserHoldMinutes != null &&
    avgLoserHoldMinutes > 0
      ? avgWinnerHoldMinutes / avgLoserHoldMinutes
      : null;

  // ── Setup performance ─────────────────────────────────────────
  const withSetup = trades.filter((t) => !!t.setupType);
  let setupStats: SetupStat[] | null = null;
  if (withSetup.length >= 5) {
    const bySetup = new Map<string, EdgeTrade[]>();
    for (const t of withSetup) {
      const k = t.setupType as string;
      (bySetup.get(k) ?? bySetup.set(k, []).get(k)!).push(t);
    }
    setupStats = [...bySetup.entries()]
      .map(([setup, list]) => ({
        setup,
        winRate: winRateOf(list),
        count: list.length,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  // ── Emotion correlation ───────────────────────────────────────
  const withEmotion = trades.filter((t) => t.emotions.length > 0);
  let emotionStats: EmotionStat[] | null = null;
  if (withEmotion.length >= 5) {
    const byEmotion = new Map<string, EdgeTrade[]>();
    for (const t of withEmotion) {
      for (const e of t.emotions) {
        (byEmotion.get(e) ?? byEmotion.set(e, []).get(e)!).push(t);
      }
    }
    emotionStats = [...byEmotion.entries()]
      .map(([emotion, list]) => ({
        emotion,
        winRate: winRateOf(list),
        count: list.length,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }

  // ── Grade correlation ─────────────────────────────────────────
  const graded = trades.filter((t) => !!t.grade);
  let gradeStats: GradeStat[] | null = null;
  if (graded.length >= 5) {
    const byGrade = new Map<string, EdgeTrade[]>();
    for (const t of graded) {
      const k = t.grade as string;
      (byGrade.get(k) ?? byGrade.set(k, []).get(k)!).push(t);
    }
    gradeStats = [...byGrade.entries()]
      .map(([grade, list]) => ({
        grade,
        winRate: winRateOf(list),
        count: list.length,
      }))
      .sort(
        (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade),
      );
  }

  // ── Consistency ───────────────────────────────────────────────
  const now = Date.now();
  const tradesThisWeek = trades.filter(
    (t) => t.savedAt >= now - WEEK_MS,
  ).length;
  const tradesLastWeek = trades.filter(
    (t) => t.savedAt >= now - 2 * WEEK_MS && t.savedAt < now - WEEK_MS,
  ).length;
  const journalRate =
    totalTrades > 0 ? Math.round((graded.length / totalTrades) * 100) : 0;
  const avgGrade =
    graded.length > 0
      ? NUM_GRADE[
          Math.min(
            5,
            Math.max(
              1,
              Math.round(
                mean(graded.map((t) => GRADE_NUM[t.grade as string] ?? 3)),
              ),
            ),
          )
        ]
      : null;

  // ── Headline insight — first applicable wins ──────────────────
  const headlineInsight = pickHeadline({
    longWinRate, shortWinRate, holdRatio, emotionStats, gradeStats,
    graded, journalRate, totalTrades,
  });

  return {
    totalTrades,
    longWinRate, shortWinRate, longCount, shortCount,
    avgWinnerHoldMinutes, avgLoserHoldMinutes, holdRatio,
    setupStats, emotionStats, gradeStats,
    tradesThisWeek, tradesLastWeek, journalRate, avgGrade,
    headlineInsight,
  };
}

function pickHeadline(a: {
  longWinRate: number | null;
  shortWinRate: number | null;
  holdRatio: number | null;
  emotionStats: EmotionStat[] | null;
  gradeStats: GradeStat[] | null;
  graded: EdgeTrade[];
  journalRate: number;
  totalTrades: number;
}): { text: string; type: InsightType } {
  const { longWinRate, shortWinRate, holdRatio } = a;

  if (
    longWinRate != null && shortWinRate != null &&
    longWinRate - shortWinRate > 20
  ) {
    return {
      text: `You win ${longWinRate}% on longs vs ${shortWinRate}% on shorts. Your edge is buying.`,
      type: 'positive',
    };
  }
  if (
    longWinRate != null && shortWinRate != null &&
    shortWinRate - longWinRate > 20
  ) {
    return {
      text: `You win ${shortWinRate}% on shorts vs ${longWinRate}% on longs. Your edge is selling.`,
      type: 'positive',
    };
  }
  if (holdRatio != null && holdRatio > 2.0) {
    return {
      text: `You hold winners ${holdRatio.toFixed(1)}x longer than losers. That's a rare and valuable habit.`,
      type: 'positive',
    };
  }
  if (holdRatio != null && holdRatio < 0.5) {
    return {
      text: `You're holding losers ${(1 / holdRatio).toFixed(1)}x longer than winners. Try cutting losses faster.`,
      type: 'warning',
    };
  }
  if (a.emotionStats && a.emotionStats.length > 0) {
    const best = a.emotionStats[0];
    if (best.count >= 3 && best.winRate > 70) {
      return {
        text: `You trade best when you're ${best.emotion.toLowerCase()}. More of that.`,
        type: 'positive',
      };
    }
  }
  if (a.gradeStats) {
    const aTrades = a.graded.filter((t) => t.grade === 'A' || t.grade === 'A+');
    if (aTrades.length > 0) {
      const aRate = pct(aTrades.filter(isWin).length, aTrades.length);
      if (aRate > 70) {
        return {
          text: `When you trust your plan, you win ${aRate}%. The process works.`,
          type: 'positive',
        };
      }
    }
  }
  if (a.journalRate > 80) {
    return {
      text: `You journal ${a.journalRate}% of your trades. Self-awareness is your edge.`,
      type: 'positive',
    };
  }
  if (a.journalRate < 30 && a.totalTrades > 10) {
    return {
      text: `Only ${a.journalRate}% of your trades are journaled. You're flying blind.`,
      type: 'warning',
    };
  }
  return {
    text: 'Keep trading to unlock deeper insights. You need 10+ trades for patterns to emerge.',
    type: 'neutral',
  };
}

/** "8m 30s" / "1h 04m" / "<1s" — shared by the Hold Duration UI. */
export function formatHold(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  if (totalSec <= 0) return '<1s';
  if (totalSec < 60) return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return m > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${h}h`;
}
