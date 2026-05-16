/**
 * Rank progression: 5 ranks × 3 sub-tiers = 15 beats.
 *
 * `cumulativeXP` is the lifetime XP at which a beat is ENTERED.
 * A user with `xp` is at the highest beat whose `cumulativeXP <=
 * xp`. XP never decreases and ranks are permanent (see xpStore) —
 * so `getRankForXP` is a pure lookup, no history needed.
 *
 * Rank ids match `RankBanner`'s `Rank` union.
 */

export type RankId =
  | 'gambler' | 'paper_hands' | 'sniper' | 'inside_trader' | 'market_maker';

export type SubTier = 1 | 2 | 3;

export interface RankBeat {
  rank: RankId;
  subTier: SubTier;
  /** Display label e.g. "Gambler I". */
  label: string;
  /** Lifetime XP at which this beat is entered. */
  cumulativeXP: number;
  /** True when entering this beat is a full rank promotion (a new
   *  rank), false for an intra-rank sub-tier step. */
  isRankPromotion: boolean;
}

const RANK_NAME: Record<RankId, string> = {
  gambler: 'Gambler',
  paper_hands: 'Paper Hands',
  sniper: 'Sniper',
  inside_trader: 'Inside Trader',
  market_maker: 'Market Maker',
};

const ROMAN: Record<SubTier, string> = { 1: 'I', 2: 'II', 3: 'III' };

function beat(rank: RankId, subTier: SubTier, cumulativeXP: number): RankBeat {
  return {
    rank,
    subTier,
    label: `${RANK_NAME[rank]} ${ROMAN[subTier]}`,
    cumulativeXP,
    isRankPromotion: subTier === 1, // tier I of any rank = rank-up
  };
}

/** The 15 beats in ascending XP order. */
export const RANK_BEATS: ReadonlyArray<RankBeat> = [
  beat('gambler',       1, 0),
  beat('gambler',       2, 150),
  beat('gambler',       3, 300),
  beat('paper_hands',   1, 500),
  beat('paper_hands',   2, 1_100),
  beat('paper_hands',   3, 1_800),
  beat('sniper',        1, 3_000),
  beat('sniper',        2, 5_000),
  beat('sniper',        3, 7_500),
  beat('inside_trader', 1, 10_500),
  beat('inside_trader', 2, 15_000),
  beat('inside_trader', 3, 20_500),
  beat('market_maker',  1, 27_500),
  beat('market_maker',  2, 36_500),
  beat('market_maker',  3, 48_500),
];

export interface RankForXP {
  rank: RankId;
  subTier: SubTier;
  label: string;
  /** XP earned within the current beat (xp − current.cumulativeXP). */
  xpInTier: number;
  /** Span from the current beat to the next (0 at the max beat). */
  xpNeededForNext: number;
  /** Whether reaching the NEXT beat is a full rank promotion.
   *  `false` at the max beat. */
  isRankPromotion: boolean;
  /** The next beat, or null at the cap. */
  next: RankBeat | null;
}

/**
 * Celebration copy shown when the user is promoted INTO a rank
 * (main-rank promotion only — sub-tier steps don't use this).
 * `gambler` is null: you start there, never get promoted into it.
 * Kept here so copy edits don't touch celebration components.
 */
export const RANK_PROMOTION_COPY: Record<RankId, string | null> = {
  gambler: null,
  paper_hands: "You've stopped gambling. You're learning to wait.",
  sniper: "You're past paper hands. Now you have aim.",
  inside_trader: 'You see what others miss. Trade with conviction.',
  market_maker: "You've made it. You are the market.",
};

/** Theme accent per rank (matches the RankBanner palette). */
export const RANK_THEME_COLOR: Record<RankId, string> = {
  gambler: '#C0C0C0',
  paper_hands: '#00D395',
  sniper: '#4A9EFF',
  inside_trader: '#9B59B6',
  market_maker: '#FFB800',
};

/** Pure lookup — the highest beat the XP has reached, plus the
 *  span to the next one. */
export function getRankForXP(xp: number): RankForXP {
  let idx = 0;
  for (let i = 0; i < RANK_BEATS.length; i++) {
    if (xp >= RANK_BEATS[i].cumulativeXP) idx = i;
    else break;
  }
  const cur = RANK_BEATS[idx];
  const next = idx + 1 < RANK_BEATS.length ? RANK_BEATS[idx + 1] : null;
  return {
    rank: cur.rank,
    subTier: cur.subTier,
    label: cur.label,
    xpInTier: xp - cur.cumulativeXP,
    xpNeededForNext: next ? next.cumulativeXP - cur.cumulativeXP : 0,
    isRankPromotion: next ? next.isRankPromotion : false,
    next,
  };
}
