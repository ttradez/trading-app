import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';

import StreakBadge from '../components/StreakBadge';
import TradeCard from '../components/TradeCard';
import RankBanner from '../components/RankBanner';

/**
 * DashboardScreen — local-state-only rebuild (2026-05-14).
 *
 * The previous build short-circuited on a backend `getAccount`
 * fetch and got stuck on "Loading..." whenever Firebase wasn't
 * authenticated. The rewrite reads exclusively from the
 * in-process Zustand stores (`onboardingStore`, `streakStore`,
 * `journalStore`, `tradeJournalStore`) so the first paint is
 * immediate and the data is always honest about what the user
 * has actually done in-app.
 *
 * Five sections beneath the persistent header:
 *  1. Daily Training Progress — SVG ring against
 *     `dailyTimeGoalMinutes`.
 *  2. Performance Stats — 2 × 2 grid (count / win-rate /
 *     total P&L / best trade), all derived from journalStore.
 *  3. Recent Trades — top 3 entries via `TradeCard`, with a
 *     "View all" link to the Journal tab and an empty-state CTA
 *     to the Chart tab.
 *  4. Rank Progression — Gambler banner + hardcoded 10 % bar
 *     toward Paper Hands (matches the post-onboarding state;
 *     real XP wiring is a follow-up).
 *  5. Challenges — placeholder card pending the real feature.
 */

const BG          = '#000000';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const TRACK       = '#1F1F1F';
const GOLD        = '#FFB800';
const GREEN       = '#00D395';
const RED         = '#FF4757';
const WHITE       = '#FFFFFF';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Archetype meta — third inline copy of the name + icon mapping.
 *  Convergence pass into a shared `archetypeMeta` module is
 *  deliberately deferred (would require touching onboarding
 *  screens — see prior DashboardScreen commit). */
const ARCHETYPE_META: Record<Archetype, { name: string; icon: MCIName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

// Rank progression — for v1 the post-onboarding state is the only
// state we visualise. Real XP wiring lands when the rank system
// is built out (see PROJECT_CONTEXT follow-ups).
const RANK_PROGRESS_PCT = 10;

function formatUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs  = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

// ── Daily training progress ring ───────────────────────────────────────────

const RING_SIZE   = 120;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC   = 2 * Math.PI * RING_RADIUS;

function ProgressRing({
  minutes, goal,
}: { minutes: number; goal: number }) {
  const safeGoal = Math.max(1, goal);
  const ratio    = Math.min(1, minutes / safeGoal);
  const offset   = RING_CIRC * (1 - ratio);
  const done     = ratio >= 1;

  // Display minutes as a whole number once we're past the first
  // tick — partial-minute precision in the ring center is noise.
  const displayMinutes = Math.floor(minutes);

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.ringSvg}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={TRACK} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
          stroke={GOLD} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          // -90° start so the fill begins from the top.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        {done ? (
          <Ionicons name="checkmark" size={44} color={GOLD} />
        ) : (
          <View style={styles.ringCount}>
            <Text style={styles.ringCountNow} allowFontScaling={false}>
              {displayMinutes}
            </Text>
            <Text style={styles.ringCountGoal} allowFontScaling={false}>
              /{safeGoal}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Per-trade grade-aware wrapper around TradeCard ─────────────────────────
// Hooks can't live inside a .map render callback, so each row is its
// own component that calls useTradeJournalStore once.

function RecentTradeRow({ entry }: { entry: JournalEntry }) {
  const grade = useTradeJournalStore((s) => s.entries[entry.id]?.grade);
  return (
    <TradeCard
      symbol={entry.symbol}
      direction={entry.side === 'buy' ? 'long' : 'short'}
      entryPrice={entry.entryPrice}
      exitPrice={entry.exitPrice}
      pnl={entry.pnl}
      entryTime={entry.openedAt}
      exitTime={entry.closedAt}
      contracts={entry.lots}
      status="closed"
      grade={grade}
    />
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: any) {
  // Streak / training time
  const streakCount  = useStreakStore((s) => s.currentStreak);
  const streakStatus = useStreakStore(computeDisplayStatus);
  const minutesToday = useStreakStore((s) => s.todayTrainingMinutes);

  // Onboarding identity + goal
  const archetype       = useOnboardingStore((s) => s.archetype);
  const dailyGoalMin    = useOnboardingStore((s) => s.dailyTimeGoalMinutes);
  const archetypeMeta   = archetype ? ARCHETYPE_META[archetype] : null;

  // Trade history — auto-persisted on close by TradingScreen.
  const entries = useJournalStore((s) => s.entries);

  // Derived performance stats.
  const stats = useMemo(() => {
    if (entries.length === 0) {
      return { hasTrades: false, total: 0, winRate: 0, totalPnl: 0, best: 0 };
    }
    const wins = entries.filter((e) => e.pnl > 0).length;
    const totalPnl = entries.reduce((acc, e) => acc + e.pnl, 0);
    const best = entries.reduce(
      (acc, e) => (e.pnl > acc ? e.pnl : acc),
      -Infinity,
    );
    return {
      hasTrades: true,
      total: entries.length,
      winRate: (wins / entries.length) * 100,
      totalPnl,
      best,
    };
  }, [entries]);

  const recentTrades = useMemo(() => entries.slice(0, 3), [entries]);
  const goalDone = minutesToday >= dailyGoalMin;

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — archetype identity (left) + streak badge (right). */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {archetypeMeta ? (
              <View style={styles.archetypeRow}>
                <MaterialCommunityIcons
                  name={archetypeMeta.icon}
                  size={20}
                  color={GOLD}
                  style={styles.archetypeIcon}
                />
                <Text style={styles.archetypeName} numberOfLines={1}>
                  {archetypeMeta.name}
                </Text>
              </View>
            ) : (
              <Text style={styles.archetypeName}>Trader</Text>
            )}
          </View>
          <StreakBadge count={streakCount} status={streakStatus} size="small" />
        </View>

        {/* SECTION 1 — Daily Training Progress */}
        <View style={[styles.card, styles.trainingCard]}>
          <ProgressRing minutes={minutesToday} goal={dailyGoalMin} />
          <Text style={styles.trainingLabel}>
            {goalDone ? 'Goal hit!' : 'minutes today'}
          </Text>
        </View>

        {/* SECTION 2 — Performance Stats (2 × 2) */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Trades"
            value={String(stats.total)}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Win Rate"
            value={stats.hasTrades ? `${Math.round(stats.winRate)}%` : '—'}
            color={stats.hasTrades
              ? (stats.winRate >= 50 ? GREEN : RED)
              : undefined}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Total P&L"
            value={stats.hasTrades ? formatUSD(stats.totalPnl) : '$0.00'}
            color={stats.hasTrades
              ? (stats.totalPnl >= 0 ? GREEN : RED)
              : undefined}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Best Trade"
            value={stats.hasTrades ? formatUSD(stats.best) : '—'}
            color={stats.hasTrades && stats.best > 0 ? GREEN : undefined}
            muted={!stats.hasTrades}
          />
        </View>

        {/* SECTION 3 — Recent Trades */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Trades</Text>
          {stats.hasTrades && (
            <Pressable
              onPress={() => navigation.navigate('Journal')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.viewAllLink}>View all</Text>
            </Pressable>
          )}
        </View>

        {recentTrades.length === 0 ? (
          <View style={styles.emptyTrades}>
            <Text style={styles.emptyTradesText}>
              No trades yet. Start a replay to place your first trade.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Chart')}
              style={({ pressed }) => [
                styles.startBtn,
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start training"
            >
              <Text style={styles.startBtnText}>Start training</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.tradeList}>
            {recentTrades.map((e) => (
              <RecentTradeRow key={e.id} entry={e} />
            ))}
          </View>
        )}

        {/* SECTION 4 — Rank Progression */}
        <View style={[styles.card, styles.rankCard]}>
          <View style={styles.rankBannerWrap}>
            <RankBanner rank="gambler" width={130} />
          </View>
          <View style={styles.rankTextWrap}>
            <Text style={styles.rankName}>Gambler</Text>
            <View style={styles.rankBarTrack}>
              <View
                style={[styles.rankBarFill, { width: `${RANK_PROGRESS_PCT}%` }]}
              />
            </View>
            <Text style={styles.rankSub}>
              {RANK_PROGRESS_PCT}% toward Paper Hands
            </Text>
          </View>
        </View>

        {/* SECTION 5 — Challenges (placeholder) */}
        <Text style={[styles.sectionTitle, styles.challengesSectionTitle]}>
          Challenges
        </Text>
        <View style={[styles.card, styles.challengesCard]}>
          <Ionicons
            name="trophy-outline"
            size={32}
            color={GOLD}
            style={styles.challengesIcon}
          />
          <Text style={styles.challengesText}>
            Challenges coming soon. Compete against other traders in timed events.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, muted,
}: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View style={[styles.statCard, muted && styles.statCardMuted]}>
      <Text
        style={[
          styles.statValue,
          color ? { color } : null,
          muted && styles.statValueMuted,
        ]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    // ~100 px clear of the tab bar so the last card isn't hidden.
    paddingBottom: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  headerLeft: { flexShrink: 1, paddingRight: 12 },
  archetypeRow: { flexDirection: 'row', alignItems: 'center' },
  archetypeIcon: { marginRight: 6 },
  archetypeName: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // Card shell
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
  },

  // SECTION 1 — Daily Training Progress
  trainingCard: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  trainingLabel: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Ring
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: { position: 'absolute' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringCount: { flexDirection: 'row', alignItems: 'baseline' },
  ringCountNow: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  ringCountGoal: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // SECTION 2 — Performance stats
  statsGrid: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statCardMuted: { opacity: 0.6 },
  statValue: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statValueMuted: { color: 'rgba(255,255,255,0.5)' },
  statLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // SECTION 3 — Recent trades
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  viewAllLink: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '600',
  },
  tradeList: { gap: 10 },
  emptyTrades: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyTradesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  startBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  startBtnText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // SECTION 4 — Rank progression
  rankCard: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rankBannerWrap: { marginRight: 12 },
  rankTextWrap: { flex: 1 },
  rankName: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rankBarTrack: {
    marginTop: 8,
    height: 4,
    backgroundColor: TRACK,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rankBarFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 2,
  },
  rankSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // SECTION 5 — Challenges placeholder
  challengesSectionTitle: {
    marginTop: 28,
    marginBottom: 12,
  },
  challengesCard: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  challengesIcon: {
    opacity: 0.3,
    marginBottom: 10,
  },
  challengesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
});
