/**
 * Curated daily trade scenarios — the "Today's Mission" feature.
 *
 * Solves the cold-start problem: instead of staring at a market
 * picker wondering which historical date to replay, the user gets
 * one curated "do this now" scenario per day. Rotation is purely
 * client-side (day-of-year modulo the list length) so there's no
 * backend dependency and every device shows the same mission on
 * the same calendar day.
 *
 * v1 ships 30 scenarios — expandable to 365 later. All dates are
 * in 2022 (the year the replay backend has coverage for). The
 * descriptions are written to teach: each one names the structure
 * to look for, and the `tip` gives a concrete entry trigger.
 *
 * Out of scope for v1 (documented so the next contributor knows):
 *  - Per-archetype / per-skill personalized selection (rotation
 *    is day-of-year only).
 *  - More than 30 scenarios.
 *  - Backend-served scenarios.
 */

export type SetupSymbol = 'NQ' | 'ES' | 'CL' | 'GC';
export type SetupDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type SetupType =
  | 'News Reaction'
  | 'Opening Range Breakout'
  | 'Trend Day'
  | 'Reversal'
  | 'Range Day'
  | 'Breakdown'
  | 'Gap Fill';

export interface DailySetup {
  id: number;
  symbol: SetupSymbol;
  /** YYYY-MM-DD historical date. */
  date: string;
  timeframe: string;
  title: string;
  description: string;
  setupType: SetupType;
  difficulty: SetupDifficulty;
  tip: string;
}

export const DAILY_SETUPS: ReadonlyArray<DailySetup> = [
  {
    id: 1, symbol: 'NQ', date: '2022-09-13', timeframe: '5m',
    title: 'CPI Shock Sell-Off', setupType: 'News Reaction', difficulty: 'beginner',
    description: 'August CPI printed hot at 8:30 AM. Price rejected the pre-market high and sold off over 200 points in 45 minutes — one of the cleanest news-driven trend days of the year.',
    tip: 'Wait for the failed bounce back into the opening-range high; that rejection is the short entry.',
  },
  {
    id: 2, symbol: 'ES', date: '2022-01-24', timeframe: '5m',
    title: 'Capitulation Reversal', setupType: 'Reversal', difficulty: 'advanced',
    description: 'A brutal gap-down open flushed to a -4% intraday low, then V-reversed and closed green. Classic capitulation: maximum fear, then aggressive buyers step in.',
    tip: 'Do not catch the knife — wait for the first higher-low AFTER the low is set, then long.',
  },
  {
    id: 3, symbol: 'NQ', date: '2022-11-10', timeframe: '5m',
    title: 'Soft CPI Melt-Up', setupType: 'News Reaction', difficulty: 'beginner',
    description: 'October CPI came in soft. NQ exploded over 700 points on the day — a relentless one-directional trend with shallow pullbacks.',
    tip: 'In a runaway trend, buy the first pullback to the rising 20-EMA. Chasing extended bars is the trap.',
  },
  {
    id: 4, symbol: 'CL', date: '2022-03-08', timeframe: '15m',
    title: 'Oil Spike Blow-Off', setupType: 'Trend Day', difficulty: 'advanced',
    description: 'Crude spiked toward $130 on supply-shock headlines, then printed a blow-off top and reversed hard. Parabolic moves end violently.',
    tip: 'When successive bars expand then suddenly contract at the high, the trend is exhausting — tighten or fade.',
  },
  {
    id: 5, symbol: 'ES', date: '2022-05-04', timeframe: '5m',
    title: 'FOMC Whipsaw', setupType: 'News Reaction', difficulty: 'advanced',
    description: 'Powell ruled out 75bp hikes at 2:30 PM. ES ripped +150 points into the close, then fully reversed the next session. The 2:00 PM print is a trap; the press conference is the move.',
    tip: 'Avoid the knee-jerk 2:00 PM bar. Trade the trend established AFTER the 2:30 PM presser begins.',
  },
  {
    id: 6, symbol: 'NQ', date: '2022-06-13', timeframe: '5m',
    title: 'Bear-Market Breakdown', setupType: 'Breakdown', difficulty: 'intermediate',
    description: 'Hot CPI the prior Friday set up a gap-down Monday that broke a multi-week range low and accelerated. Range breaks on bad news trend hard.',
    tip: 'Short the retest of the broken range low from below — the old support becomes resistance.',
  },
  {
    id: 7, symbol: 'GC', date: '2022-03-08', timeframe: '15m',
    title: 'Gold Safe-Haven Surge', setupType: 'Trend Day', difficulty: 'beginner',
    description: 'Gold pushed to a 2022 high above $2,050 on risk-off flows. A clean grind-up trend day with orderly pullbacks.',
    tip: 'Trend days respect the 9-EMA. Use pullbacks to it as continuation longs, not exits.',
  },
  {
    id: 8, symbol: 'ES', date: '2022-07-27', timeframe: '5m',
    title: 'FOMC Relief Rally', setupType: 'News Reaction', difficulty: 'intermediate',
    description: 'The 75bp hike was priced; the presser leaned dovish and ES rallied into the close. A textbook "sell the rumor, buy the news" relief move.',
    tip: 'Mark the pre-2:00 PM range. The break of its high AFTER the presser is the long trigger.',
  },
  {
    id: 9, symbol: 'NQ', date: '2022-10-13', timeframe: '5m',
    title: 'The CPI Reversal Day', setupType: 'Reversal', difficulty: 'advanced',
    description: 'CPI printed hot, NQ gapped down and made new lows — then reversed and rallied ~5% off the lows. One of the most violent intraday reversals in market history.',
    tip: 'The reversal confirmed when price reclaimed the opening price with conviction. That reclaim is the long.',
  },
  {
    id: 10, symbol: 'ES', date: '2022-02-24', timeframe: '5m',
    title: 'Invasion Gap-Down V', setupType: 'Reversal', difficulty: 'advanced',
    description: 'Geopolitical shock gapped ES sharply lower at the open, then it reversed all day and closed strongly green. Headline panic, then mean reversion.',
    tip: 'Extreme gap-downs on a single headline often fully reverse. Look for the failed new low.',
  },
  {
    id: 11, symbol: 'NQ', date: '2022-03-16', timeframe: '5m',
    title: 'First-Hike Trend Day', setupType: 'Trend Day', difficulty: 'beginner',
    description: 'The Fed delivered its first 2022 hike. Once the presser dust settled NQ trended up cleanly into the close — low-noise continuation.',
    tip: 'On a trend day the first 30-minute range rarely gets violated against the trend. Use it as your stop reference.',
  },
  {
    id: 12, symbol: 'CL', date: '2022-06-08', timeframe: '15m',
    title: 'Crude Range-to-Trend', setupType: 'Opening Range Breakout', difficulty: 'intermediate',
    description: 'Oil chopped in a tight morning range, coiled, then broke out and ran into the EIA inventory release. Compression precedes expansion.',
    tip: 'Mark the first-hour high and low. The first clean break with a close outside is the breakout entry.',
  },
  {
    id: 13, symbol: 'ES', date: '2022-08-26', timeframe: '5m',
    title: 'Jackson Hole Crash', setupType: 'News Reaction', difficulty: 'intermediate',
    description: "Powell's 8-minute hawkish speech triggered a -3.4% rout. A relentless one-way down-trend the entire afternoon.",
    tip: 'When every pullback is shallow and fails fast, stay with the trend — short rallies into the falling 9-EMA.',
  },
  {
    id: 14, symbol: 'NQ', date: '2022-04-29', timeframe: '5m',
    title: 'Month-End Breakdown', setupType: 'Breakdown', difficulty: 'intermediate',
    description: 'A weak tech-earnings week culminated in a heavy month-end sell-off that broke the weekly low and trended down all session.',
    tip: 'Breakdown days: the bounce into the prior session close is the cleanest short, not the initial break.',
  },
  {
    id: 15, symbol: 'GC', date: '2022-07-14', timeframe: '15m',
    title: 'Gold Capitulation Low', setupType: 'Reversal', difficulty: 'advanced',
    description: 'Gold flushed to a 2022 low on a strong dollar, then carved a double-bottom and reversed. A patience trade — the bottom took hours to form.',
    tip: 'Double bottoms confirm on the break of the middle pivot high, not on the second low itself.',
  },
  {
    id: 16, symbol: 'ES', date: '2022-09-21', timeframe: '5m',
    title: 'FOMC Fade', setupType: 'News Reaction', difficulty: 'advanced',
    description: 'ES spiked up on the 2:00 PM statement then faded the entire presser and closed at the lows. The initial pop was a liquidity trap.',
    tip: 'If the 2:00 PM spike fails to hold within 15 minutes, the fade is on — short the reclaim of the pre-release level.',
  },
  {
    id: 17, symbol: 'NQ', date: '2022-01-05', timeframe: '5m',
    title: 'Fed Minutes Breakdown', setupType: 'Breakdown', difficulty: 'intermediate',
    description: 'Hawkish FOMC minutes at 2:00 PM broke the morning range and started the January tech unwind. A clean range-low break with follow-through.',
    tip: 'Range-day-to-breakdown: the trigger is a 5-minute close below the range low, not a wick through it.',
  },
  {
    id: 18, symbol: 'CL', date: '2022-04-25', timeframe: '15m',
    title: 'Oil Demand Scare', setupType: 'Trend Day', difficulty: 'intermediate',
    description: 'China lockdown headlines drove crude down ~4% in a steady, orderly trend day. Few sharp pullbacks — momentum stayed one-sided.',
    tip: 'On orderly trend days, scaling in on minor pullbacks beats waiting for a deep retrace that never comes.',
  },
  {
    id: 19, symbol: 'ES', date: '2022-11-30', timeframe: '5m',
    title: 'Powell Pivot Rally', setupType: 'News Reaction', difficulty: 'beginner',
    description: 'Powell hinted at slowing the pace of hikes at 1:30 PM. ES ripped +3% into the close — a strong, clean afternoon trend.',
    tip: 'Catalyst-driven afternoon trends rarely retrace much. First pullback to the rising 20-EMA is your long.',
  },
  {
    id: 20, symbol: 'NQ', date: '2022-12-13', timeframe: '5m',
    title: 'CPI Pop and Drop', setupType: 'Reversal', difficulty: 'advanced',
    description: 'Soft CPI gapped NQ up sharply at 8:30 AM, it ran into the FOMC the next day, then faded most of the gain. A pop-and-drop reversal.',
    tip: 'Gap-up-into-event days often fade. Watch for the failure to make a new high after the first 90 minutes.',
  },
  {
    id: 21, symbol: 'ES', date: '2022-03-29', timeframe: '5m',
    title: 'Quarter-End Range Day', setupType: 'Range Day', difficulty: 'beginner',
    description: 'A low-conviction quarter-end session chopped inside a defined range all day. The lesson: not every day is a trend — sometimes you fade the edges.',
    tip: 'On a range day, sell the top third and buy the bottom third. The middle is no-trade chop.',
  },
  {
    id: 22, symbol: 'NQ', date: '2022-05-20', timeframe: '5m',
    title: 'Bear-Market Bounce Trap', setupType: 'Reversal', difficulty: 'advanced',
    description: 'A sharp morning rally into a known resistance shelf failed and reversed into the close — a classic bear-market bounce that trapped breakout buyers.',
    tip: 'Rallies into prior-day resistance in a downtrend are short setups, not breakout longs, until proven otherwise.',
  },
  {
    id: 23, symbol: 'GC', date: '2022-11-11', timeframe: '15m',
    title: 'Gold CPI Breakout', setupType: 'Opening Range Breakout', difficulty: 'beginner',
    description: 'Soft CPI and a tumbling dollar drove gold cleanly through its opening range and trended up the rest of the session.',
    tip: 'A high-volume close above the opening-range high on a macro catalyst is a high-quality breakout long.',
  },
  {
    id: 24, symbol: 'ES', date: '2022-06-15', timeframe: '5m',
    title: '75bp Surprise Whipsaw', setupType: 'News Reaction', difficulty: 'advanced',
    description: "The first 75bp hike since 1994. ES whipsawed violently around 2:00 PM then rallied on Powell's framing. Two-sided and treacherous.",
    tip: 'On a known volatility event, size down and wait for the post-presser trend — do not trade the statement spike.',
  },
  {
    id: 25, symbol: 'NQ', date: '2022-07-19', timeframe: '5m',
    title: 'Earnings-Season Trend Up', setupType: 'Trend Day', difficulty: 'beginner',
    description: 'Strong tech guidance fueled a steady risk-on grind higher with shallow, buyable dips. A confidence-building clean trend day.',
    tip: 'Higher highs and higher lows on the 5-minute = stay long. Exit only when a higher low breaks.',
  },
  {
    id: 26, symbol: 'CL', date: '2022-08-16', timeframe: '15m',
    title: 'Crude Gap Fill', setupType: 'Gap Fill', difficulty: 'intermediate',
    description: 'Crude gapped down at the open on demand-fear headlines, then methodically filled the gap back to the prior close — a textbook gap-fill grind.',
    tip: 'Gap fills target the prior session close. That close is your profit objective, not an arbitrary level.',
  },
  {
    id: 27, symbol: 'ES', date: '2022-10-21', timeframe: '5m',
    title: 'WSJ Pivot Leak Rally', setupType: 'News Reaction', difficulty: 'intermediate',
    description: 'A midday WSJ article hinting at a Fed slowdown sparked a sharp reversal off the lows into a strong close. News can turn a trend intraday.',
    tip: 'When a fresh catalyst hits mid-session, the prior trend is invalidated — trade the new direction off the reaction bar.',
  },
  {
    id: 28, symbol: 'NQ', date: '2022-02-10', timeframe: '5m',
    title: 'Hot CPI Breakdown', setupType: 'Breakdown', difficulty: 'intermediate',
    description: 'A 40-year-high CPI print broke the multi-day range low at 8:30 AM and trended down into the afternoon — a clean news-driven breakdown.',
    tip: 'The retest of the broken range low (now resistance) within the first hour is the highest-quality short.',
  },
  {
    id: 29, symbol: 'GC', date: '2022-09-23', timeframe: '15m',
    title: 'Strong-Dollar Gold Slide', setupType: 'Trend Day', difficulty: 'beginner',
    description: 'A surging dollar pressed gold lower all session in a steady, low-noise down-trend. A patient short-the-bounce day.',
    tip: 'In a steady down-trend, every bounce into the falling 20-EMA is a continuation short.',
  },
  {
    id: 30, symbol: 'ES', date: '2022-12-15', timeframe: '5m',
    title: 'Post-FOMC Breakdown', setupType: 'Breakdown', difficulty: 'advanced',
    description: 'The day after a hawkish FOMC, ES gapped down, broke the prior-day low, and trended down hard into a double-event week. Follow-through after a known catalyst.',
    tip: 'Post-event breakdown days: short the first failed rally into the prior-day low, not the open.',
  },
];

/** Day-of-year (1-366) for the device-local date. */
function dayOfYear(d: Date): number {
  const startOfYear = Date.UTC(d.getFullYear(), 0, 0);
  const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((today - startOfYear) / 86_400_000);
}

/** The scenario for today, chosen by day-of-year modulo the list
 *  length. Deterministic per calendar day, no backend, every
 *  device agrees on the same calendar day. */
export function getTodaySetup(): DailySetup {
  const idx = dayOfYear(new Date()) % DAILY_SETUPS.length;
  return DAILY_SETUPS[idx];
}

/** Unix-seconds the chart screen passes to `startSession`'s
 *  `start_time`. Anchored to ~9:30 AM ET (14:00 UTC — within an
 *  hour of the cash open year-round); the backend snaps to the
 *  nearest available bar so sub-hour precision doesn't matter. */
export function setupStartUnixSeconds(s: DailySetup): number {
  const [y, m, d] = s.date.split('-').map((n) => parseInt(n, 10));
  return Math.floor(Date.UTC(y, m - 1, d, 14, 0, 0) / 1000);
}

export const DAILY_SETUP_COUNT = DAILY_SETUPS.length;
