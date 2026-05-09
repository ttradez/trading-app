/**
 * Rank progression — derived from the user's stats so it updates automatically
 * (no backend change needed). XP is computed from total trades + win rate +
 * R-expectancy; ranks are tier breakpoints on that XP.
 */

export interface RankTier {
  id: string;
  label: string;
  minXp: number;
  color: string;
  icon: string;
}

export const RANKS: RankTier[] = [
  { id: 'beginner',     label: 'Beginner',     minXp:    0, color: '#6B7280', icon: 'leaf-outline' },
  { id: 'rookie',       label: 'Rookie',       minXp:  100, color: '#9CA3AF', icon: 'paw-outline' },
  { id: 'intermediate', label: 'Intermediate', minXp:  500, color: '#3B82F6', icon: 'flash-outline' },
  { id: 'advanced',     label: 'Advanced',     minXp: 1500, color: '#A855F7', icon: 'trophy-outline' },
  { id: 'elite',        label: 'Elite',        minXp: 3500, color: '#EC4899', icon: 'star-outline' },
  { id: 'funded',       label: 'Funded',       minXp: 6000, color: '#22C55E', icon: 'medal-outline' },
  { id: 'professional', label: 'Professional', minXp:10000, color: '#D4AF37', icon: 'diamond-outline' },
];

export interface RankInfo {
  current: RankTier;
  next: RankTier | null;
  xp: number;
  progressPct: number;   // 0..1 progress through the current tier
}

export function computeRank(stats: {
  totalTrades: number;
  winRate: number;       // 0..1
  totalPnl: number;
  startingBalance: number;
}): RankInfo {
  const baseXp = stats.totalTrades * 10;
  const wrBonus = Math.max(0, stats.winRate - 0.4) * 1000;     // bonus above 40% win rate
  const returnPct = stats.startingBalance > 0 ? stats.totalPnl / stats.startingBalance : 0;
  const returnXp = Math.max(0, returnPct * 2000);              // +2000 XP per +100% return
  const xp = Math.floor(baseXp + wrBonus + returnXp);

  let current = RANKS[0];
  let next: RankTier | null = RANKS[1] ?? null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) {
      current = RANKS[i];
      next = RANKS[i + 1] ?? null;
    }
  }
  const progressPct = next
    ? Math.min(1, Math.max(0, (xp - current.minXp) / (next.minXp - current.minXp)))
    : 1;
  return { current, next, xp, progressPct };
}
