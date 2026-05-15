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
import { useIsTodaySetupComplete } from '../store/dailySetupStore';
import { useWatchlistStore, savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { useUnlockedCount } from '../store/badgeStore';
import { BADGE_COUNT } from '../data/badges';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import {
  getTodaySetup, setupStartUnixSeconds, SetupDifficulty,
} from '../data/dailySetups';

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

function formatUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs  = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "2022-09-13" → "Sep 13, 2022". String-parsed (no `new Date()`)
 *  so a YYYY-MM-DD never shifts a day in negative-UTC zones. */
function formatSavedDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
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

  // Daily mission — deterministic by day-of-year; completion is
  // tracked in dailySetupStore (set by TradingScreen when the user
  // closes a trade on the matching symbol + replay date).
  const todaySetup = useMemo(() => getTodaySetup(), []);
  const setupComplete = useIsTodaySetupComplete();

  // User-curated watchlist (bookmarked from the chart screen).
  const savedSetups = useWatchlistStore((s) => s.savedSetups);

  // Achievement badge progress (counter near rank progression).
  const unlockedBadges = useUnlockedCount();

  // Real XP / rank progression (replaces the old hardcoded 10%).
  const currentXP = useXpStore((s) => s.currentXP);
  const rankInfo = useMemo(() => getRankForXP(currentXP), [currentXP]);

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
          <View style={styles.headerRight}>
            <StreakBadge count={streakCount} status={streakStatus} size="small" />
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={styles.gearBtn}
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color="rgba(255,255,255,0.5)"
              />
            </Pressable>
          </View>
        </View>

        {/* TODAY'S MISSION — the cold-start solver, top card. */}
        <View
          style={[
            styles.card,
            styles.missionCard,
            setupComplete && styles.missionCardDone,
          ]}
        >
          {setupComplete && <View style={styles.missionAccent} />}
          <View style={styles.missionInner}>
            <View style={styles.missionTopRow}>
              <Text style={styles.missionLabel}>TODAY'S MISSION</Text>
              <DifficultyBadge difficulty={todaySetup.difficulty} />
            </View>

            <Text style={styles.missionTitle}>{todaySetup.title}</Text>
            <Text style={styles.missionSubtitle}>
              {todaySetup.symbol} · {todaySetup.setupType}
            </Text>
            <Text style={styles.missionDescription}>
              {todaySetup.description}
            </Text>
            <Text style={styles.missionTip}>💡 {todaySetup.tip}</Text>

            <Pressable
              onPress={() =>
                navigation.navigate('Chart', {
                  dailySetup: {
                    symbol: todaySetup.symbol,
                    timeframe: todaySetup.timeframe,
                    startTs: setupStartUnixSeconds(todaySetup),
                    date: todaySetup.date,
                    key: `${todaySetup.id}-${Date.now()}`,
                  },
                })
              }
              disabled={setupComplete}
              style={({ pressed }) => [
                styles.missionCta,
                setupComplete && styles.missionCtaDone,
                !setupComplete && pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                setupComplete ? 'Mission completed' : 'Trade this setup'
              }
              accessibilityState={{ disabled: setupComplete }}
            >
              <Text
                style={[
                  styles.missionCtaText,
                  setupComplete && styles.missionCtaTextDone,
                ]}
              >
                {setupComplete ? 'Completed ✓' : 'Trade this setup'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* SAVED SETUPS — user-curated watchlist (between the daily
            mission and the training ring; no existing section moved). */}
        <View style={styles.savedHeader}>
          <Text style={styles.sectionTitle}>Saved Setups</Text>
          {savedSetups.length > 0 && (
            <Text style={styles.savedCount}>{savedSetups.length} saved</Text>
          )}
        </View>
        {savedSetups.length === 0 ? (
          <View style={styles.savedEmptyCard}>
            <Ionicons
              name="bookmark-outline"
              size={26}
              color="rgba(255,184,0,0.3)"
            />
            <Text style={styles.savedEmptyText}>
              Bookmark setups from the chart
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedRow}
          >
            {savedSetups.map((s) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.savedCard,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() =>
                  navigation.navigate('Chart', {
                    dailySetup: {
                      symbol: s.symbol,
                      timeframe: s.timeframe,
                      startTs: savedSetupStartUnixSeconds(s.date),
                      date: s.date,
                      key: `wl-${s.id}-${Date.now()}`,
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Open saved setup ${s.symbol} ${s.date}`}
              >
                <Text style={styles.savedSymbol}>{s.symbol}</Text>
                <Text style={styles.savedDate}>{formatSavedDate(s.date)}</Text>
                {s.label ? (
                  <Text style={styles.savedLabel} numberOfLines={1}>
                    {s.label}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        )}

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

        {/* SECTION 4 — Rank Progression (real XP data) */}
        <View style={[styles.card, styles.rankCard]}>
          <View style={styles.rankBannerWrap}>
            <RankBanner
              rank={rankInfo.rank}
              width={130}
              subTier={rankInfo.subTier}
            />
          </View>
          <View style={styles.rankTextWrap}>
            <Text style={styles.rankName}>{rankInfo.label}</Text>
            <View style={styles.rankBarTrack}>
              <View
                style={[
                  styles.rankBarFill,
                  {
                    width: `${
                      rankInfo.next
                        ? Math.round(
                            (rankInfo.xpInTier /
                              Math.max(1, rankInfo.xpNeededForNext)) * 100,
                          )
                        : 100
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.rankSub}>
              {rankInfo.next
                ? `${rankInfo.xpInTier} / ${rankInfo.xpNeededForNext} XP to ${rankInfo.next.label}`
                : 'Max rank reached'}
            </Text>
          </View>
        </View>

        {/* Badge counter — taps through to the Ranks tab's trophy case. */}
        <Pressable
          style={({ pressed }) => [
            styles.badgeCounter,
            pressed && { opacity: 0.7 },
          ]}
          onPress={() =>
            navigation.navigate('Leaderboard', { initialSegment: 'badges' })
          }
          accessibilityRole="button"
          accessibilityLabel={`${unlockedBadges} of ${BADGE_COUNT} badges unlocked`}
        >
          <Ionicons name="trophy" size={16} color={GOLD} />
          <Text style={styles.badgeCounterText}>
            {unlockedBadges} / {BADGE_COUNT}
          </Text>
          <Text style={styles.badgeCounterLabel}>badges</Text>
          <View style={{ flex: 1 }} />
          <Ionicons
            name="chevron-forward"
            size={16}
            color="rgba(255,255,255,0.3)"
          />
        </Pressable>

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

function DifficultyBadge({ difficulty }: { difficulty: SetupDifficulty }) {
  const color =
    difficulty === 'beginner' ? GREEN :
    difficulty === 'advanced' ? RED : GOLD;
  const label =
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return (
    <View style={[styles.diffBadge, { borderColor: color }]}>
      <Text style={[styles.diffBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gearBtn: { padding: 2 },
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

  // TODAY'S MISSION
  missionCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 16,
  },
  missionCardDone: {
    borderColor: GREEN,
  },
  // 3 px green left accent when done — same language as TradeCard.
  missionAccent: {
    width: 3,
    backgroundColor: GREEN,
  },
  missionInner: {
    flex: 1,
    padding: 20,
  },
  missionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  missionTitle: {
    marginTop: 14,
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  missionSubtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
  missionDescription: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  missionTip: {
    marginTop: 12,
    color: 'rgba(255,184,0,0.8)',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  missionCta: {
    marginTop: 18,
    height: 48,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCtaDone: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GREEN,
  },
  missionCtaText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  missionCtaTextDone: {
    color: GREEN,
  },

  // Saved Setups (watchlist)
  savedHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  savedCount: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  savedRow: {
    gap: 10,
    paddingRight: 4,
  },
  savedCard: {
    width: 160,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  savedSymbol: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  savedDate: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  savedLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },
  savedEmptyCard: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedEmptyText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
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

  badgeCounter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  badgeCounterText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  badgeCounterLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
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
