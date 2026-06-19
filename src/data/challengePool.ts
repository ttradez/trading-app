import { RankId } from './rankConfig';

/**
 * Challenge templates: 3 daily (from a pool) + 1 weekly + 1
 * monthly, rank-gated by `minRank`. Challenges contribute the
 * bulk of mid-game XP (research target ~35-45 %).
 *
 * `condition` maps to a tracking key the trigger sites pump
 * progress into. Some pool conditions aren't reliably detectable
 * offline yet (`new_symbol_today`, `quick_start`) — those are
 * excluded from generation via `DETECTABLE_CONDITIONS` so a user
 * never gets an impossible daily (no shame UI, so an undetectable
 * one would just sit at 0 forever). They stay in the pool for
 * when detection lands.
 *
 * Windowing simplification (documented v1 behaviour): `'max'`
 * conditions (consecutive_wins / streak_days / unique_symbols /
 * unique_emotions) read lifetime/cross values rather than a
 * per-day/week window. Generous, never punishing; tighten later.
 */

export type ChallengeType = 'daily' | 'weekly' | 'monthly';
export type ChallengeCategory =
  | 'volume' | 'skill' | 'process' | 'discovery' | 'consistency';

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: ChallengeType;
  category: ChallengeCategory;
  minRank: RankId;
  target: number;
  xpReward: number;
  bonusReward?: 'streak_freeze';
  condition: string;
}

/** Conditions wired into trigger sites today. Generation filters
 *  to these so users never get an undetectable challenge. */
export const DETECTABLE_CONDITIONS: ReadonlySet<string> = new Set([
  'trades_placed', 'minutes_traded', 'consecutive_wins',
  'winner_held_10_bars', 'loser_cut_5_bars', 'green_day',
  'win_rate_55', 'win_rate_55_monthly', 'all_journaled', 'grade_ab',
  'grade_aplus', 'unique_emotions', 'unique_symbols',
  'time_goal_hit', 'journal_count', 'active_days',
  'time_goal_days', 'green_week', 'streak_days',
  // New universal challenges with wired detection:
  'good_grade_on_loss', 'same_setup_3x', 'full_process_trades',
  // Session-stats layer (sessionStatsStore + detectAfterSessionEnd):
  'green_session', 'tp_sl_full_session', 'session_under_6_trades',
  'consecutive_green_sessions', 'green_sessions_10', 'pf15_last10',
  // R:R conditions (read from JournalEntry.intendedRR / rMultiple):
  'rr2_realized', 'plan_rr_kept',
  // Intentionally NOT here (stubbed, no detection yet — never
  // rotates so a user can't get an impossible challenge):
  //   consistent_size, wait_between_trades, stop_after_2_losses,
  //   library_setups_practiced
]);

/** 'add' → progress += value (capped at target).
 *  'max' → progress = max(progress, value). */
export const CONDITION_MODE: Record<string, 'add' | 'max'> = {
  consecutive_wins: 'max',
  streak_days: 'max',
  unique_symbols: 'max',
  unique_emotions: 'max',
  // Both read a recomputed this-week count each trigger, so take
  // the max rather than summing repeated recomputations.
  same_setup_3x: 'max',
  full_process_trades: 'max',
  // Tracks a running cross-session counter — every session-end
  // fires with the LIVE value, so use max-mode to avoid
  // double-counting.
  consecutive_green_sessions: 'max',
  // everything else defaults to 'add'
};

// Filled / duotone variants — DESIGN_AUDIT §3.1 PART C. Filled icons
// read with more weight against the dark surface and reinforce
// Daily Challenges as a distinct, "active" section.
const CATEGORY_ICON: Record<ChallengeCategory, string> = {
  volume: 'repeat',
  skill: 'target',
  process: 'notebook-edit',
  discovery: 'compass',
  consistency: 'calendar-check',
};
export function challengeIcon(cat: ChallengeCategory): string {
  return CATEGORY_ICON[cat];
}

export const DAILY_POOL: ReadonlyArray<ChallengeTemplate> = [
  // Volume / habit — paper
  { id: 'd_trades3',  name: 'Place 3 trades',  description: 'Get the reps in.',                type: 'daily', category: 'volume',      minRank: 'paper',     target: 3,  xpReward: 30, condition: 'trades_placed' },
  { id: 'd_trades5',  name: 'Place 5 trades',  description: 'Build screen time.',              type: 'daily', category: 'volume',      minRank: 'paper',     target: 5,  xpReward: 50, condition: 'trades_placed' },
  { id: 'd_min15',    name: 'Trade for 15 minutes', description: 'Stay in the chair.',         type: 'daily', category: 'volume',      minRank: 'paper',     target: 15, xpReward: 30, condition: 'minutes_traded' },
  { id: 'd_min30',    name: 'Trade for 30 minutes', description: 'A full focused session.',    type: 'daily', category: 'volume',      minRank: 'paper',     target: 30, xpReward: 40, condition: 'minutes_traded' },
  // Volume — unprofitable
  { id: 'd_trades8',  name: 'Place 8 trades',  description: 'High-volume day.',               type: 'daily', category: 'volume',      minRank: 'unprofitable', target: 8,  xpReward: 60, condition: 'trades_placed' },
  // Skill — paper
  { id: 'd_win2',     name: 'Win 2 in a row',  description: 'Back-to-back green.',             type: 'daily', category: 'skill',       minRank: 'paper',     target: 2,  xpReward: 40, condition: 'consecutive_wins' },
  { id: 'd_hold10',   name: 'Hold a winner for 10+ bars OR close at 2R+', description: 'Let your winners breathe — by time or by reward.', type: 'daily', category: 'skill', minRank: 'paper', target: 1, xpReward: 40, condition: 'winner_held_10_bars' },
  { id: 'd_cut5',     name: 'Cut a loser within 5 bars OR before 1R against you', description: 'Kill losers fast — by time or by risk.', type: 'daily', category: 'skill', minRank: 'paper', target: 1, xpReward: 40, condition: 'loser_cut_5_bars' },
  // Skill — unprofitable
  { id: 'd_win3',     name: 'Win 3 in a row',  description: 'A real heater.',                 type: 'daily', category: 'skill',       minRank: 'unprofitable', target: 3,  xpReward: 60, condition: 'consecutive_wins' },
  { id: 'd_greenday', name: 'End the day green', description: 'Min 3 trades, net positive.',   type: 'daily', category: 'skill',       minRank: 'unprofitable', target: 1,  xpReward: 60, condition: 'green_day' },
  // Skill — disciplined
  { id: 'd_wr55',     name: '55%+ win rate',   description: 'On 4+ trades today.',            type: 'daily', category: 'skill',       minRank: 'disciplined',      target: 1,  xpReward: 70, condition: 'win_rate_55' },
  // Process — disciplined
  { id: 'd_alljourn', name: 'Journal every trade', description: 'No trade left unreflected.',  type: 'daily', category: 'process',     minRank: 'disciplined',      target: 1,  xpReward: 50, condition: 'all_journaled' },
  { id: 'd_gradeab',  name: 'Grade A or B on 3 trades', description: 'Execute the plan.',      type: 'daily', category: 'process',     minRank: 'disciplined',      target: 3,  xpReward: 60, condition: 'grade_ab' },
  { id: 'd_emotions', name: 'Use 2 emotion tags', description: 'Notice how you felt.',        type: 'daily', category: 'process',     minRank: 'disciplined',      target: 2,  xpReward: 40, condition: 'unique_emotions' },
  // Discovery — paper
  { id: 'd_newsym',   name: 'Trade a new symbol', description: 'Step outside your comfort.',  type: 'daily', category: 'discovery',   minRank: 'paper',     target: 1,  xpReward: 40, condition: 'new_symbol_today' },
  { id: 'd_2sym',     name: 'Trade 2 different symbols', description: 'Diversify the session.', type: 'daily', category: 'discovery',  minRank: 'paper',     target: 2,  xpReward: 40, condition: 'unique_symbols' },
  // Consistency — paper
  { id: 'd_timegoal', name: 'Hit your daily time goal', description: 'Keep the streak alive.', type: 'daily', category: 'consistency', minRank: 'paper',     target: 1,  xpReward: 30, condition: 'time_goal_hit' },
  { id: 'd_quick',    name: 'Complete a trade within your first 10 minutes of your replay session today', description: 'Start decisive. No hesitation.', type: 'daily', category: 'consistency', minRank: 'paper', target: 1, xpReward: 30, condition: 'quick_start' },
  // ── New universal (style-agnostic) dailies ──────────────────────
  // STUBBED: detection needs per-session size tracking — excluded
  // from DETECTABLE_CONDITIONS until wired (see challengeDetection).
  { id: 'd_riskconsist', name: 'Risk Consistency', description: 'Use the same position size on every trade today (no sizing up after a loss).', type: 'daily', category: 'process', minRank: 'unprofitable', target: 1, xpReward: 40, condition: 'consistent_size' },
  // STUBBED: needs inter-trade timing — excluded until wired.
  { id: 'd_patience',    name: 'Patience', description: 'Wait at least 60 seconds between closing a trade and opening the next one, on 3 trades.', type: 'daily', category: 'process', minRank: 'disciplined', target: 3, xpReward: 40, condition: 'wait_between_trades' },
  // IMPLEMENTED (good_grade_on_loss).
  { id: 'd_goodgradeloss', name: 'Process Over Outcome', description: 'Grade yourself A or A+ on a losing trade.', type: 'daily', category: 'process', minRank: 'unprofitable', target: 1, xpReward: 50, condition: 'good_grade_on_loss' },
  // STUBBED: needs session-end + consecutive-loss tracking.
  { id: 'd_stop2losses', name: 'Drawdown Discipline', description: 'Stop trading for the session after 2 consecutive losses.', type: 'daily', category: 'skill', minRank: 'disciplined', target: 1, xpReward: 50, condition: 'stop_after_2_losses' },

  // ── Rank-correlated daily batch ─────────────────────────────────
  // PAPER: mechanics & reps
  { id: 'd_first5',     name: 'Getting Reps',        description: 'Place 5 trades today',                              type: 'daily', category: 'volume',      minRank: 'paper',        target: 5, xpReward: 35,  condition: 'trades_placed' },
  { id: 'd_journal2',   name: 'Write It Down',       description: 'Journal 2 trades today',                            type: 'daily', category: 'process',     minRank: 'paper',        target: 2, xpReward: 35,  condition: 'journal_count' },
  { id: 'd_time20',     name: 'Screen Time',         description: 'Train for 20 minutes today',                        type: 'daily', category: 'volume',      minRank: 'paper',        target: 20, xpReward: 30, condition: 'minutes_traded' },
  { id: 'd_green1',     name: 'First Green',         description: 'Finish a session (3+ trades) in profit',            type: 'daily', category: 'skill',       minRank: 'paper',        target: 1, xpReward: 45,  condition: 'green_session' },
  // UNPROFITABLE: survive, lose small
  { id: 'd_cutfast2',   name: 'Cut It Quick',        description: 'Cut 2 losers fast instead of holding and hoping',   type: 'daily', category: 'skill',       minRank: 'unprofitable', target: 2, xpReward: 55,  condition: 'loser_cut_5_bars' },
  { id: 'd_protected',  name: 'Always Protected',    description: 'Finish a session with TP & SL set on every trade',  type: 'daily', category: 'process',     minRank: 'unprofitable', target: 1, xpReward: 60,  condition: 'tp_sl_full_session' },
  { id: 'd_nochurn',    name: 'Quality Over Quantity', description: 'Finish a session taking 6 trades or fewer',       type: 'daily', category: 'process',     minRank: 'unprofitable', target: 1, xpReward: 55,  condition: 'session_under_6_trades' },
  { id: 'd_honestloss', name: 'Honest Loss',         description: 'Grade A on a losing trade — lose the right way',    type: 'daily', category: 'process',     minRank: 'unprofitable', target: 1, xpReward: 60,  condition: 'good_grade_on_loss' },
  // DISCIPLINED: process is the edge
  { id: 'd_alljournal', name: 'Full Accountability', description: 'Journal every trade you close today',               type: 'daily', category: 'process',     minRank: 'disciplined',  target: 1, xpReward: 75,  condition: 'all_journaled' },
  { id: 'd_plankept',   name: 'Plan Kept',           description: 'Win a trade that met your planned R:R (1.5+)',      type: 'daily', category: 'skill',       minRank: 'disciplined',  target: 1, xpReward: 80,  condition: 'plan_rr_kept' },
  { id: 'd_gradeab2',   name: 'Clean Execution',     description: 'Earn 2 A/B-grade trades today',                     type: 'daily', category: 'process',     minRank: 'disciplined',  target: 2, xpReward: 75,  condition: 'grade_ab' },
  { id: 'd_runner',     name: 'Let It Run',          description: 'Hold a winner 10+ bars or bank a 2R+ win',          type: 'daily', category: 'skill',       minRank: 'disciplined',  target: 1, xpReward: 70,  condition: 'winner_held_10_bars' },
  // CONSISTENT: repeatable, not lucky
  { id: 'd_wr55b',      name: 'Sharp Day',           description: 'Win over 55% across 4+ trades today',               type: 'daily', category: 'skill',       minRank: 'consistent',   target: 1, xpReward: 100, condition: 'win_rate_55' },
  { id: 'd_2r',         name: 'Paid Properly',       description: 'Close a winner at 2R or better',                    type: 'daily', category: 'skill',       minRank: 'consistent',   target: 1, xpReward: 100, condition: 'rr2_realized' },
  { id: 'd_greenstreak2', name: 'Back to Back',      description: 'Reach 2 green sessions in a row',                   type: 'daily', category: 'consistency', minRank: 'consistent',   target: 2, xpReward: 110, condition: 'consecutive_green_sessions' },
  // PROFITABLE: edge, pressure-tested
  { id: 'd_2r2',        name: 'Double Tap',          description: 'Close 2 winners at 2R or better today',             type: 'daily', category: 'skill',       minRank: 'profitable',   target: 2, xpReward: 140, condition: 'rr2_realized' },
  { id: 'd_wins4',      name: 'On a Heater',         description: 'Win 4 trades in a row',                             type: 'daily', category: 'skill',       minRank: 'profitable',   target: 4, xpReward: 150, condition: 'consecutive_wins' },
];

export const WEEKLY_POOL: ReadonlyArray<ChallengeTemplate> = [
  { id: 'w_trades15', name: 'Place 15 trades',  description: 'A full week of reps.',          type: 'weekly', category: 'volume',      minRank: 'paper',     target: 15, xpReward: 200, condition: 'trades_placed' },
  { id: 'w_win5',     name: 'Win 5 in a row',   description: 'A serious streak.',             type: 'weekly', category: 'skill',       minRank: 'paper',     target: 5,  xpReward: 300, condition: 'consecutive_wins' },
  { id: 'w_journ10',  name: 'Journal 10 trades', description: 'Reflection habit.',            type: 'weekly', category: 'process',     minRank: 'paper',     target: 10, xpReward: 250, condition: 'journal_count' },
  { id: 'w_days5',    name: 'Trade on 5 different days', description: 'Open the app and trade on 5 different calendar days this week.', type: 'weekly', category: 'consistency', minRank: 'paper', target: 5, xpReward: 200, condition: 'active_days' },
  { id: 'w_timegoal5', name: 'Hit time goal 5 days', description: 'Earn a streak freeze.',    type: 'weekly', category: 'consistency', minRank: 'paper',     target: 5,  xpReward: 250, bonusReward: 'streak_freeze', condition: 'time_goal_days' },
  { id: 'w_greenwk',  name: 'End week positive', description: 'Net green for the week.',       type: 'weekly', category: 'skill',       minRank: 'unprofitable', target: 1,  xpReward: 300, condition: 'green_week' },
  { id: 'w_aplus3',   name: 'Grade A+ on 3 trades', description: 'Flawless execution x3.',    type: 'weekly', category: 'process',     minRank: 'disciplined',      target: 3,  xpReward: 350, condition: 'grade_aplus' },
  { id: 'w_3sym',     name: 'Trade 3 symbols',  description: 'Range across the board.',        type: 'weekly', category: 'discovery',   minRank: 'paper',     target: 3,  xpReward: 200, condition: 'unique_symbols' },
  { id: 'w_streak7',  name: 'Maintain streak all week', description: '7-day streak.',          type: 'weekly', category: 'consistency', minRank: 'paper',     target: 7,  xpReward: 400, condition: 'streak_days' },
  // ── New universal (style-agnostic) weeklies ─────────────────────
  // IMPLEMENTED (same_setup_3x, max-mode).
  { id: 'w_samesetup3',  name: 'Setup Focus', description: 'Take the same setup type 3 times this week.', type: 'weekly', category: 'discovery', minRank: 'unprofitable', target: 3, xpReward: 250, condition: 'same_setup_3x' },
  // IMPLEMENTED (full_process_trades, max-mode).
  { id: 'w_fullprocess5', name: 'Full Process', description: 'Plan, trade, and journal 5 trades this week (pre-trade checklist + journal on all 5).', type: 'weekly', category: 'process', minRank: 'disciplined', target: 5, xpReward: 300, condition: 'full_process_trades' },
  // STUBBED: needs Setup-Library launch tracking — excluded until wired.
  { id: 'w_library3',    name: 'Library Student', description: 'Practice 3 different setups from the Setup Library this week.', type: 'weekly', category: 'discovery', minRank: 'paper', target: 3, xpReward: 250, condition: 'library_setups_practiced' },

  // ── Rank-correlated weekly batch ────────────────────────────────
  { id: 'w_active4',    name: 'Show Up',             description: 'Train on 4 different days this week',               type: 'weekly', category: 'consistency', minRank: 'paper',        target: 4, xpReward: 200, condition: 'active_days' },
  { id: 'w_journal10',  name: 'The Logbook',         description: 'Journal 10 trades this week',                       type: 'weekly', category: 'process',     minRank: 'unprofitable', target: 10, xpReward: 220, condition: 'journal_count' },
  { id: 'w_protected3', name: 'Risk Manager',        description: '3 sessions this week fully protected (TP & SL on every trade)', type: 'weekly', category: 'process', minRank: 'unprofitable', target: 3, xpReward: 250, condition: 'tp_sl_full_session' },
  { id: 'w_setup3',     name: 'Master One Setup',    description: 'Trade the same planned setup 3 times this week',    type: 'weekly', category: 'skill',       minRank: 'disciplined',  target: 3, xpReward: 260, condition: 'same_setup_3x' },
  { id: 'w_process5',   name: 'Full Process',        description: '5 trades this week with both a pre-trade plan and a journal entry', type: 'weekly', category: 'process', minRank: 'disciplined', target: 5, xpReward: 280, condition: 'full_process_trades' },
  { id: 'w_green3row',  name: 'String It Together',  description: 'Reach 3 green sessions in a row',                   type: 'weekly', category: 'consistency', minRank: 'consistent',   target: 3, xpReward: 320, bonusReward: 'streak_freeze', condition: 'consecutive_green_sessions' },
  { id: 'w_greenweek',  name: 'Green Week',          description: 'End the week with positive total P&L',              type: 'weekly', category: 'consistency', minRank: 'consistent',   target: 1, xpReward: 300, condition: 'green_week' },
  { id: 'w_2r3',        name: 'Paid Three Times',    description: 'Close 3 winners at 2R+ this week',                  type: 'weekly', category: 'skill',       minRank: 'profitable',   target: 3, xpReward: 350, condition: 'rr2_realized' },
  { id: 'w_green5row',  name: 'The Eval Streak',     description: 'Reach 5 green sessions in a row — funded-trader consistency', type: 'weekly', category: 'consistency', minRank: 'profitable', target: 5, xpReward: 450, condition: 'consecutive_green_sessions' },
];

export const MONTHLY_POOL: ReadonlyArray<ChallengeTemplate> = [
  { id: 'm_trades50', name: 'Place 50 trades',  description: 'A month of volume.',            type: 'monthly', category: 'volume',     minRank: 'paper', target: 50, xpReward: 1000, condition: 'trades_placed' },
  { id: 'm_journ30',  name: 'Journal 30 trades', description: 'Deep self-study.',             type: 'monthly', category: 'process',    minRank: 'paper', target: 30, xpReward: 1000, condition: 'journal_count' },
  { id: 'm_streak20', name: 'Maintain a 20-day streak', description: 'Identity, not motivation.', type: 'monthly', category: 'consistency', minRank: 'paper', target: 20, xpReward: 1500, condition: 'streak_days' },
  { id: 'm_wr55',     name: '55%+ win rate on 30+ trades', description: 'Edge at scale.',      type: 'monthly', category: 'skill',     minRank: 'disciplined',  target: 1,  xpReward: 1500, condition: 'win_rate_55_monthly' },

  // ── Rank-correlated monthly batch ───────────────────────────────
  // NOTE: requested batch also included `m_wr55` — skipped, id
  // already exists above.
  { id: 'm_green10',    name: 'Ten Green Sessions',  description: 'Bank 10 green sessions this month',                 type: 'monthly', category: 'consistency', minRank: 'consistent',  target: 10, xpReward: 600, condition: 'green_sessions_10' },
  { id: 'm_pf15',       name: 'The Evaluation',      description: 'Profit factor 1.5+ across your last 10 sessions — pass the funded eval', type: 'monthly', category: 'skill', minRank: 'profitable', target: 1, xpReward: 900, condition: 'pf15_last10' },
  { id: 'm_streak14',   name: 'Two Weeks Deep',      description: 'Hit a 14-day training streak',                      type: 'monthly', category: 'consistency', minRank: 'disciplined', target: 14, xpReward: 550, condition: 'streak_days' },
];

export const ALL_TEMPLATES: ReadonlyArray<ChallengeTemplate> = [
  ...DAILY_POOL, ...WEEKLY_POOL, ...MONTHLY_POOL,
];

export function getTemplate(id: string): ChallengeTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

export const RANK_ORDER: RankId[] =
  ['paper', 'unprofitable', 'disciplined', 'consistent', 'profitable', 'funded'];

export function rankAtLeast(userRank: RankId, minRank: RankId): boolean {
  return RANK_ORDER.indexOf(userRank) >= RANK_ORDER.indexOf(minRank);
}
