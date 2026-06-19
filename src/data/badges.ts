import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Achievement badge catalogue — 30 badges, 5 categories. The
 * Zeigarnik / collection-completion lever (Pokémon GO / Duolingo /
 * Strava / Apple Fitness). The onboarding First Strike badge
 * proved the pattern; this gives it depth.
 *
 * Pure data — unlock predicates + progress live in
 * `src/utils/badgeChecker.ts` (badges.ts stays logic-free so it
 * can be expanded to 60/100 later without touching detection).
 *
 * Icon note: the spec references lucide icon names;
 * `lucide-react-native` isn't installed (it never was in this
 * project). Each `icon` is the nearest MaterialCommunityIcons
 * glyph (`@expo/vector-icons`, already a dependency). Typed
 * against the MCI glyph union so an invalid name fails the
 * type-check.
 */

export type BadgeCategory =
  | 'volume' | 'skill' | 'consistency' | 'discovery' | 'journal';

export type BadgeRarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type BadgeIcon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  condition: string;   // human-readable unlock condition
  icon: BadgeIcon;
  rarity: BadgeRarity;
}

/** Rarity → accent colour (toast border, trophy-case ring). */
export const RARITY_COLOR: Record<BadgeRarity, string> = {
  common:    '#FFFFFF',
  uncommon:  '#00D395',
  rare:      '#4A9EFF',
  epic:      '#9B59B6',
  legendary: '#FFB800',
};

export const CATEGORY_ORDER: BadgeCategory[] =
  ['volume', 'skill', 'consistency', 'discovery', 'journal'];

export const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  volume: 'VOLUME',
  skill: 'SKILL',
  consistency: 'CONSISTENCY',
  discovery: 'DISCOVERY',
  journal: 'JOURNAL',
};

export const BADGES: ReadonlyArray<Badge> = [
  // ── VOLUME ────────────────────────────────────────────────────
  { id: 'rookie',          name: 'Rookie',          category: 'volume', rarity: 'common',    icon: 'school-outline',
    condition: 'Place 1 trade',        description: 'Every trader starts somewhere. You placed your first trade.' },
  { id: 'getting_started', name: 'Getting Started', category: 'volume', rarity: 'common',    icon: 'play-circle-outline',
    condition: 'Place 10 trades',      description: 'Ten trades in. The reps are starting to add up.' },
  { id: 'committed',       name: 'Committed',       category: 'volume', rarity: 'uncommon',  icon: 'arm-flex',
    condition: 'Place 25 trades',      description: '25 trades. You keep showing up — that is the whole game.' },
  { id: 'veteran',         name: 'Veteran',         category: 'volume', rarity: 'uncommon',  icon: 'medal-outline',
    condition: 'Place 50 trades',      description: '50 trades of experience earned, not bought.' },
  { id: 'centurion',       name: 'Centurion',       category: 'volume', rarity: 'rare',      icon: 'numeric-1-box-multiple',
    condition: 'Place 100 trades',     description: '100 trades. You have real screen time now.' },
  { id: 'market_machine',  name: 'Market Machine',  category: 'volume', rarity: 'legendary', icon: 'robot-industrial',
    condition: 'Place 500 trades',     description: '500 trades. The reps are no longer optional — they are who you are.' },

  // ── SKILL ─────────────────────────────────────────────────────
  { id: 'first_green',     name: 'First Green',     category: 'skill',  rarity: 'common',    icon: 'cash-check',
    condition: 'Win your first trade', description: 'Your first winning trade. The feeling never gets old.' },
  { id: 'hot_hand',        name: 'Hot Hand',        category: 'skill',  rarity: 'uncommon',  icon: 'fire',
    condition: 'Win 3 trades in a row', description: 'Three green in a row. Momentum is real.' },
  { id: 'on_fire',         name: 'On Fire',         category: 'skill',  rarity: 'rare',      icon: 'fire-alert',
    condition: 'Win 5 trades in a row', description: 'Five straight wins. Ride it — but stay disciplined.' },
  { id: 'untouchable',     name: 'Untouchable',     category: 'skill',  rarity: 'epic',      icon: 'shield-star',
    condition: 'Win 10 trades in a row', description: 'Ten in a row. Elite consistency.' },
  { id: 'perfect_day',     name: 'Perfect Day',     category: 'skill',  rarity: 'rare',      icon: 'weather-sunny',
    condition: 'All trades green in one day (min 3)', description: 'A flawless session. Every trade green.' },
  { id: 'green_week',      name: 'Green Week',      category: 'skill',  rarity: 'epic',      icon: 'calendar-check',
    condition: 'Positive P&L over 7 consecutive trading days', description: 'Seven straight days of trading, all net green.' },
  { id: 'sharpshooter',    name: 'Sharpshooter',    category: 'skill',  rarity: 'rare',      icon: 'bullseye-arrow',
    condition: '70%+ win rate over 20+ trades', description: 'Precision over a real sample. That is an edge.' },
  { id: 'big_catch',       name: 'Big Catch',       category: 'skill',  rarity: 'uncommon',  icon: 'fish',
    condition: 'Single trade P&L over $1,000', description: 'A four-figure winner. You let it run.' },
  { id: 'whale',           name: 'Whale',           category: 'skill',  rarity: 'epic',      icon: 'cash-multiple',
    condition: 'Single trade P&L over $5,000', description: 'A five-figure-adjacent monster. Conviction paid off.' },

  // ── CONSISTENCY ───────────────────────────────────────────────
  { id: 'day_3',           name: 'Day 3',           category: 'consistency', rarity: 'common',    icon: 'numeric-3-circle',
    condition: 'Reach a 3-day streak', description: 'Three days running. The habit is forming.' },
  { id: 'one_week',        name: 'One Week',        category: 'consistency', rarity: 'uncommon',  icon: 'calendar-week',
    condition: 'Reach a 7-day streak', description: 'A full week. This is how edges are built.' },
  { id: 'two_weeks',       name: 'Two Weeks',       category: 'consistency', rarity: 'rare',      icon: 'calendar-range',
    condition: 'Reach a 14-day streak', description: 'Fourteen days. Most people quit before here.' },
  { id: 'monthly',         name: 'Monthly',         category: 'consistency', rarity: 'epic',      icon: 'calendar-month',
    condition: 'Reach a 30-day streak', description: 'Thirty days. This is identity, not motivation.' },
  { id: 'iron_will',       name: 'Iron Will',       category: 'consistency', rarity: 'legendary', icon: 'anvil',
    condition: 'Reach a 60-day streak', description: 'Sixty days. Iron will. Unteachable, only earned.' },
  { id: 'freeze_saver',    name: 'Freeze Saver',    category: 'consistency', rarity: 'common',    icon: 'snowflake',
    condition: 'Use a streak freeze for the first time', description: 'A freeze caught you. The system works.' },
  { id: 'unbreakable',     name: 'Unbreakable',     category: 'consistency', rarity: 'legendary', icon: 'diamond-stone',
    condition: 'Reach a 30-day streak with 0 freezes used', description: 'Thirty days, zero freezes. Untouchable discipline.' },

  // ── DISCOVERY ─────────────────────────────────────────────────
  { id: 'explorer',        name: 'Explorer',        category: 'discovery', rarity: 'common',   icon: 'compass-outline',
    condition: 'Trade 3 different symbols', description: 'You ventured beyond your comfort symbol.' },
  { id: 'global_trader',   name: 'Global Trader',   category: 'discovery', rarity: 'uncommon', icon: 'earth',
    condition: 'Trade every available symbol', description: 'You have traded the whole board.' },
  { id: 'bookworm',        name: 'Bookworm',        category: 'discovery', rarity: 'uncommon', icon: 'bookmark-multiple',
    condition: 'Save 10 setups to your watchlist', description: 'A curated library of setups to study.' },

  // ── JOURNAL ───────────────────────────────────────────────────
  { id: 'first_page',      name: 'First Page',      category: 'journal', rarity: 'common',   icon: 'notebook-outline',
    condition: 'Journal your first trade', description: 'The first page of your trading story.' },
  { id: 'dedicated',       name: 'Dedicated',       category: 'journal', rarity: 'uncommon', icon: 'notebook-edit',
    condition: 'Journal 10 trades', description: 'Ten reflections. Self-awareness compounds.' },
  { id: 'self_aware',      name: 'Self-Aware',      category: 'journal', rarity: 'rare',     icon: 'head-cog',
    condition: 'Journal 50 trades', description: 'Fifty trades reviewed. You study yourself, not just the chart.' },
];

export const BADGE_COUNT = BADGES.length;

export function getBadge(id: string): Badge | undefined {
  return BADGES.find((b) => b.id === id);
}
