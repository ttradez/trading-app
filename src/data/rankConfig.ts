export type RankId =
  | 'paper'
  | 'unprofitable'
  | 'disciplined'
  | 'consistent'
  | 'profitable'
  | 'funded';

/**
 * Divisions (I/II/III) were removed in Phase 4 — one threshold per
 * rank. `SubTier` is kept exported as `1 | null` so the existing
 * `RankForXP.subTier` contract stays a union (everything resolves to
 * null) without breaking call sites that still destructure it.
 * Anything reading the value already null-guards; remove the field
 * entirely in a later cleanup pass.
 */
export type SubTier = 1;

export interface RankBeat {
  rank: RankId;
  /** Always null in the divisionless ladder. Kept for shape parity. */
  subTier: SubTier | null;
  /** Display label — now identical to the rank name (no Roman). */
  label: string;
  /** Lifetime XP at which this rank is entered. */
  cumulativeXP: number;
  /** True — every beat in the new ladder is a full rank promotion. */
  isRankPromotion: boolean;
}

const RANK_NAME: Record<RankId, string> = {
  paper: 'Paper',
  unprofitable: 'Unprofitable',
  disciplined: 'Disciplined',
  consistent: 'Consistent',
  profitable: 'Profitable',
  funded: 'Funded',
};

function beat(rank: RankId, cumulativeXP: number): RankBeat {
  return {
    rank,
    subTier: null,
    label: RANK_NAME[rank],
    cumulativeXP,
    isRankPromotion: true,
  };
}

/** 6 beats — one per rank. Must stay in sync with backend RANK_LADDER. */
export const RANK_BEATS: ReadonlyArray<RankBeat> = [
  beat('paper',        0),
  beat('unprofitable', 800),
  beat('disciplined',  3200),
  beat('consistent',   7500),
  beat('profitable',   14500),
  beat('funded',       25000),
];

/** Ordered list of the 6 ranks, low to high. */
export const RANK_ORDER: ReadonlyArray<RankId> = [
  'paper', 'unprofitable', 'disciplined', 'consistent', 'profitable', 'funded',
];

/**
 * Result of resolving an XP value to its current beat + progress.
 * `subTier` stays in the type for shape parity but is always null;
 * `next` is null at the Funded cap.
 */
export interface RankForXP {
  rank: RankId;
  subTier: SubTier | null;
  label: string;
  /** XP earned within the current beat (xp − current.cumulativeXP). */
  xpInTier: number;
  /** Span from the current beat to the next (0 at the max beat). */
  xpNeededForNext: number;
  /** Whether reaching the NEXT beat is a full rank promotion.
   *  `false` only at the max beat. */
  isRankPromotion: boolean;
  /** The next beat, or null at the cap. */
  next: RankBeat | null;
}

/**
 * Celebration copy shown when the user is promoted INTO a rank.
 * `paper` is null: you start there, never get promoted into it.
 * Funded gets the apex line.
 */
export const RANK_PROMOTION_COPY: Record<RankId, string | null> = {
  paper: null,
  unprofitable: "You've stopped gambling. You're learning to wait.",
  disciplined: "You're past paper hands. Now you have aim.",
  consistent: 'You see what others miss. Trade with conviction.',
  profitable: "You've made it. You are the market.",
  funded: "You're funded. The market pays you now.",
};

/** Theme accent per rank. */
export const RANK_THEME_COLOR: Record<RankId, string> = {
  paper:        '#C0C0C0',
  unprofitable: '#00D395',
  disciplined:  '#4A9EFF',
  consistent:   '#9B59B6',
  profitable:   '#FFB800',
  funded:       '#FFB800',
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
