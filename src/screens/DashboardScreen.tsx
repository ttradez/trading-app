import React, { useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Animated,
  Easing, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import { useTradeJournalStore, TradeGrade } from '../store/tradeJournalStore';
import { useIsTodaySetupComplete } from '../store/dailySetupStore';
import { useWatchlistStore, savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { useBadgeStore } from '../store/badgeStore';
import { BADGES, BADGE_COUNT, Badge } from '../data/badges';
import { buildBadgeContext, getBadgeProgress } from '../utils/badgeChecker';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import { useChallengeStore, ChallengeInstance } from '../store/challengeStore';
import { getTemplate, challengeIcon } from '../data/challengePool';
import {
  getTodaySetup, setupStartUnixSeconds, SetupDifficulty,
} from '../data/dailySetups';

import StreakBadge from '../components/StreakBadge';
import TradeCard from '../components/TradeCard';
import RankBanner from '../components/RankBanner';

/**
 * DashboardScreen — 3-zone restructure (2026-05-15).
 *
 * Reads exclusively from in-process Zustand stores so the first
 * paint is immediate. Organized into three scannable zones so the
 * answer to "why open the app right now" is always above the fold:
 *
 *   ZONE 1 · TODAY     — Today's Mission, Daily Challenges
 *                        (compact), small inline Training ring.
 *   ZONE 2 · PROGRESS  — Rank progression, Next Badges, process
 *                        stats (Trades / Win Rate / Journal Rate /
 *                        Avg Grade).
 *   ZONE 3 · ACTIVITY  — Recent Trades, Saved Setups (only when
 *                        the user has ≥1 — empty states never take
 *                        dashboard real estate).
 *
 * A thin divider + extra gap separates zones for visual grouping.
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
 *  Convergence into a shared module is deferred (would require
 *  touching onboarding screens). */
const ARCHETYPE_META: Record<Archetype, { name: string; icon: MCIName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

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

// Journal grade ↔ number mapping for the "Avg Grade" stat tile.
const GRADE_NUM: Record<string, number> = { 'A+': 5, A: 4, B: 3, C: 2, F: 1 };
const NUM_GRADE: Record<number, string> = { 5: 'A+', 4: 'A', 3: 'B', 2: 'C', 1: 'F' };

// ── Daily training progress ring (parameterized; now a small
//    supporting element, not a hero) ─────────────────────────────

function ProgressRing({
  minutes, goal, size, stroke,
}: { minutes: number; goal: number; size: number; stroke: number }) {
  const safeGoal = Math.max(1, goal);
  const ratio    = Math.min(1, minutes / safeGoal);
  const radius   = (size - stroke) / 2;
  const circ     = 2 * Math.PI * radius;
  const offset   = circ * (1 - ratio);
  const done     = ratio >= 1;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={TRACK} strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={GOLD} strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {done && (
        <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={GOLD} />
      )}
    </View>
  );
}

// ── Per-trade grade-aware wrapper around TradeCard ─────────────────────────

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
  const archetype     = useOnboardingStore((s) => s.archetype);
  const displayName   = useOnboardingStore((s) => s.displayName);
  const dailyGoalMin  = useOnboardingStore((s) => s.dailyTimeGoalMinutes);
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  // Daily mission — deterministic by day-of-year.
  const todaySetup = useMemo(() => getTodaySetup(), []);
  const setupComplete = useIsTodaySetupComplete();

  // User-curated watchlist (bookmarked from the chart screen).
  const savedSetups = useWatchlistStore((s) => s.savedSetups);

  // Badge unlock ledger — drives the "Next Badges" picker.
  const unlockedBadges = useBadgeStore((s) => s.unlockedBadges);

  // Real XP / rank progression.
  const currentXP = useXpStore((s) => s.currentXP);
  const rankInfo = useMemo(() => getRankForXP(currentXP), [currentXP]);

  const scrollRef = useRef<ScrollView>(null);

  // Goal-gradient (Kivetz et al. 2006): the closer to the next
  // tier, the louder the cue. ≥80 % → pulsing glow; ≥95 % → a
  // specific, actionable nudge mapped from the XP gap.
  const pct = rankInfo.next
    ? Math.min(1, rankInfo.xpInTier / Math.max(1, rankInfo.xpNeededForNext))
    : 1;
  const gap = rankInfo.next
    ? Math.max(0, rankInfo.xpNeededForNext - rankInfo.xpInTier)
    : 0;
  const showPulse = !!rankInfo.next && pct >= 0.8;
  const showNudge = !!rankInfo.next && pct >= 0.95;

  const glow = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    if (!showPulse) { glow.setValue(0.3); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 0.7, duration: 750, easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.3, duration: 750, easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showPulse, glow]);

  // Smallest gap = most specific bucket (evaluate tightest first).
  const nudge = useMemo(() => {
    if (!showNudge || !rankInfo.next) return null;
    const to = rankInfo.next.label;
    if (gap <= 15) {
      return { text: `1 journaled trade to ${to}`, action: 'chart' as const };
    }
    if (gap <= 30) {
      return { text: `2 trades to ${to}`, action: 'chart' as const };
    }
    if (gap <= 50) {
      return { text: `1 Daily Setup away from ${to}`, action: 'top' as const };
    }
    return { text: `${gap} XP to ${to}`, action: 'challenges' as const };
  }, [showNudge, gap, rankInfo.next]);

  const onNudge = () => {
    if (!nudge) return;
    if (nudge.action === 'chart') { navigation.navigate('Chart'); return; }
    if (nudge.action === 'top') {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  // Trade history — auto-persisted on close by TradingScreen.
  const entries = useJournalStore((s) => s.entries);
  // Per-trade grades / reflections (keyed by the trade id).
  const tjEntries = useTradeJournalStore((s) => s.entries);

  // Derived process stats (outcome stats — Total P&L / Best Trade —
  // intentionally dropped in favor of process metrics).
  const stats = useMemo(() => {
    const total = entries.length;
    if (total === 0) {
      return {
        hasTrades: false, total: 0, winRate: 0,
        journalRate: null as number | null, avgGrade: null as string | null,
      };
    }
    const wins = entries.filter((e) => e.pnl > 0).length;
    const journaled = entries.filter((e) => tjEntries[e.id]).length;
    const grades = entries
      .map((e) => tjEntries[e.id]?.grade)
      .filter((g): g is TradeGrade => !!g)
      .map((g) => GRADE_NUM[g]);
    const avgGrade =
      grades.length > 0
        ? NUM_GRADE[Math.min(5, Math.max(1, Math.round(
            grades.reduce((a, b) => a + b, 0) / grades.length,
          )))]
        : null;
    return {
      hasTrades: true,
      total,
      winRate: (wins / total) * 100,
      journalRate: Math.round((journaled / total) * 100),
      avgGrade,
    };
  }, [entries, tjEntries]);

  // Next 3 unlockable badges — the locked numeric-progress badges
  // closest to completion (ratio desc, then smallest remaining).
  // Boolean-only badges (no clean "x/y") are skipped here.
  const nextBadges = useMemo(() => {
    const ctx = buildBadgeContext();
    const cands: { badge: Badge; current: number; target: number; ratio: number }[] = [];
    for (const b of BADGES) {
      if (unlockedBadges[b.id]) continue;
      const prog = getBadgeProgress(b.id, ctx);
      if (!prog || prog.target <= 0) continue;
      cands.push({
        badge: b,
        current: prog.current,
        target: prog.target,
        ratio: prog.current / prog.target,
      });
    }
    cands.sort(
      (a, b) =>
        b.ratio - a.ratio ||
        (a.target - a.current) - (b.target - b.current),
    );
    return cands.slice(0, 3);
  }, [entries, tjEntries, unlockedBadges, streakCount, savedSetups]);

  const recentTrades = useMemo(() => entries.slice(0, 3), [entries]);
  const goalDone = minutesToday >= dailyGoalMin;

  const goToBadges = () =>
    navigation.navigate('Leaderboard', { initialSegment: 'badges' });

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER — identity + rank + streak, one compact row ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {archetypeMeta && (
              <MaterialCommunityIcons
                name={archetypeMeta.icon}
                size={18}
                color={GOLD}
                style={styles.archetypeIcon}
              />
            )}
            <Text style={styles.identityText} numberOfLines={1}>
              <Text style={styles.identityStrong}>
                {archetypeMeta ? archetypeMeta.name : 'Trader'}
              </Text>
              {displayName ? (
                <Text style={styles.identityDim}>{`  ·  ${displayName}`}</Text>
              ) : null}
              <Text style={styles.identityDim}>{`  ·  ${rankInfo.label}`}</Text>
            </Text>
            <View style={styles.pips}>
              {[1, 2, 3].map((t) => (
                <View
                  key={t}
                  style={[
                    styles.pip,
                    t <= rankInfo.subTier ? styles.pipOn : styles.pipOff,
                  ]}
                />
              ))}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => {
                if (streakCount === 0) {
                  Alert.alert('Streak', 'Train today to start your streak.');
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={
                streakCount === 0
                  ? 'No streak yet — train today to start'
                  : `${streakCount}-day streak`
              }
            >
              <StreakBadge count={streakCount} status={streakStatus} size="small" />
            </Pressable>
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

        {/* ═══════════ ZONE 1 · TODAY ═══════════ */}

        {/* SECTION 1 — Today's Mission (unchanged, best card in app) */}
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

        {/* SECTION 2 — Daily Challenges (compact) + long-term */}
        <View style={styles.sectionGap}>
          <ChallengesSection />
        </View>

        {/* SECTION 3 — Training Progress (small inline) */}
        <Pressable
          style={[styles.card, styles.trainCard, styles.sectionGap]}
          onPress={() => navigation.navigate('Chart')}
          accessibilityRole="button"
          accessibilityLabel={`${Math.floor(minutesToday)} of ${dailyGoalMin} training minutes today`}
        >
          <ProgressRing
            minutes={minutesToday}
            goal={dailyGoalMin}
            size={56}
            stroke={6}
          />
          <View style={styles.trainText}>
            {goalDone ? (
              <Text style={styles.trainBigDone}>Goal hit ✓</Text>
            ) : (
              <>
                <Text style={styles.trainBig}>
                  {Math.floor(minutesToday)} / {dailyGoalMin} min
                </Text>
                <Text style={styles.trainSub}>minutes today</Text>
              </>
            )}
          </View>
        </Pressable>

        {/* ── zone divider ── */}
        <View style={styles.zoneDivider} />

        {/* ═══════════ ZONE 2 · PROGRESS ═══════════ */}

        {/* SECTION 4 — Rank Progression (moved up) */}
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
                  { width: `${Math.round(pct * 100)}%` },
                ]}
              />
              {showPulse && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.rankBarGlow,
                    { width: `${Math.round(pct * 100)}%`, opacity: glow },
                  ]}
                />
              )}
            </View>
            <Text style={styles.rankSub}>
              {rankInfo.next
                ? `${rankInfo.xpInTier} / ${rankInfo.xpNeededForNext} XP to ${rankInfo.next.label}`
                : 'Max rank reached'}
            </Text>
          </View>
        </View>

        {/* Goal-gradient nudge — only at ≥95 %. */}
        {nudge && (
          <Pressable
            onPress={onNudge}
            style={({ pressed }) => [
              styles.nudgeCard,
              pressed && { opacity: 0.8 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={nudge.text}
          >
            <View style={styles.nudgeAccent} />
            <View style={styles.nudgeInner}>
              <MaterialCommunityIcons
                name="rocket-launch-outline"
                size={18}
                color={GOLD}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.nudgeText}>{nudge.text}</Text>
              <View style={{ flex: 1 }} />
              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255,255,255,0.4)"
              />
            </View>
          </Pressable>
        )}

        {/* SECTION 5 — Next Badges (replaces the 0/30 counter) */}
        <View style={[styles.sectionHeader, styles.sectionGap]}>
          <Text style={styles.sectionTitle}>Next Badges</Text>
        </View>
        {nextBadges.length > 0 && (
          <View style={styles.badgeRow}>
            {nextBadges.map(({ badge, current, target }) => (
              <Pressable
                key={badge.id}
                style={({ pressed }) => [
                  styles.badgeItem,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={goToBadges}
                accessibilityRole="button"
                accessibilityLabel={`${badge.name}, ${current} of ${target}`}
              >
                <MaterialCommunityIcons
                  name={badge.icon}
                  size={24}
                  color="rgba(255,184,0,0.5)"
                />
                <Text style={styles.badgeName} numberOfLines={2}>
                  {badge.name}
                </Text>
                <Text style={styles.badgeProg}>
                  {current}/{target}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable
          onPress={goToBadges}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.badgeViewAll, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel={`View all ${BADGE_COUNT} badges`}
        >
          <Text style={styles.badgeViewAllText}>
            View all {BADGE_COUNT} →
          </Text>
        </Pressable>

        {/* SECTION 6 — Process Stats (2 × 2) */}
        <View style={[styles.statsGrid, styles.sectionGap]}>
          <StatCard
            label="Trades"
            value={String(stats.total)}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Win Rate"
            value={stats.hasTrades
              ? `${Math.round(stats.winRate)}% (${stats.total})`
              : '—'}
            color={stats.hasTrades
              ? (stats.winRate >= 50 ? GREEN : RED)
              : undefined}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Journal Rate"
            value={stats.journalRate !== null ? `${stats.journalRate}%` : '—'}
            color={stats.journalRate !== null
              ? (stats.journalRate >= 50 ? GREEN : undefined)
              : undefined}
            muted={!stats.hasTrades}
          />
          <StatCard
            label="Avg Grade"
            value={stats.avgGrade ?? '—'}
            color={stats.avgGrade
              ? (GRADE_NUM[stats.avgGrade] >= 4 ? GREEN
                : GRADE_NUM[stats.avgGrade] <= 2 ? RED : undefined)
              : undefined}
            muted={!stats.avgGrade}
          />
        </View>

        {/* ── zone divider ── */}
        <View style={styles.zoneDivider} />

        {/* ═══════════ ZONE 3 · ACTIVITY ═══════════ */}

        {/* SECTION 7 — Recent Trades */}
        <View style={styles.sectionHeaderTight}>
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

        {/* SECTION 8 — Saved Setups (only when ≥1; no empty state) */}
        {savedSetups.length > 0 && (
          <>
            <View style={[styles.sectionHeader, styles.sectionGap]}>
              <Text style={styles.sectionTitle}>Saved Setups</Text>
              <Text style={styles.savedCount}>{savedSetups.length} saved</Text>
            </View>
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
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Difficulty badge ───────────────────────────────────────────────────────

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

// ── Challenges (compact) ───────────────────────────────────────────────────

function CompactChallengeCard({
  inst, tag, large, onSwap, swapAvailable,
}: {
  inst: ChallengeInstance;
  tag?: 'WEEKLY' | 'MONTHLY';
  large?: boolean;
  onSwap?: () => void;
  swapAvailable?: boolean;
}) {
  const t = getTemplate(inst.challengeId);
  if (!t) return null;
  const pct = Math.min(1, inst.target > 0 ? inst.progress / inst.target : 0);
  return (
    <View
      style={[
        styles.cCard,
        inst.completed && styles.cCardDone,
      ]}
    >
      {inst.completed && <View style={styles.cAccent} />}
      <View style={[styles.cInner, large && styles.cInnerLarge]}>
        <View style={styles.cRow}>
          <MaterialCommunityIcons
            name={challengeIcon(t.category) as any}
            size={16}
            color="rgba(255,255,255,0.4)"
            style={styles.cIcon}
          />
          {tag && <Text style={styles.cTag}>{tag}</Text>}
          <Text style={styles.cName} numberOfLines={1}>{t.name}</Text>
          <View style={{ flex: 1 }} />
          {inst.completed ? (
            <Ionicons name="checkmark-circle" size={18} color={GREEN} />
          ) : (
            <Text style={styles.cProg}>
              {Math.floor(inst.progress)}/{inst.target}
            </Text>
          )}
          {onSwap && !inst.completed && (
            <Pressable
              onPress={onSwap}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => [styles.cSwap, pressed && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={`Swap challenge ${t.name}`}
            >
              <Ionicons name="refresh" size={16} color={GOLD} />
              {swapAvailable && <Text style={styles.cSwapBadge}>1 left</Text>}
            </Pressable>
          )}
        </View>
        <View style={styles.cBarTrack}>
          <View
            style={[
              styles.cBarFill,
              {
                width: `${Math.round(pct * 100)}%`,
                backgroundColor: inst.completed ? GREEN : GOLD,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function ChallengesSection() {
  const dailies   = useChallengeStore((s) => s.activeDailies);
  const weekly    = useChallengeStore((s) => s.activeWeekly);
  const monthly   = useChallengeStore((s) => s.activeMonthly);
  const skipsUsed = useChallengeStore((s) => s.skipsUsedThisWeek);
  const skipDaily = useChallengeStore((s) => s.skipDaily);
  const userRank  = useXpStore((s) => s.currentRank);

  const allComplete =
    dailies.length > 0 && dailies.every((d) => d.completed);
  const canSwap = skipsUsed < 1;

  return (
    <View>
      <Text style={styles.sectionTitle}>Daily Challenges</Text>

      {allComplete && (
        <Text style={styles.cAllDone}>All daily challenges complete ✓</Text>
      )}

      <View style={[styles.cList, allComplete && styles.cListDone]}>
        {dailies.map((d, i) => (
          <CompactChallengeCard
            key={d.challengeId}
            inst={d}
            onSwap={
              canSwap && !d.completed
                ? () => skipDaily(i, userRank)
                : undefined
            }
            swapAvailable={canSwap}
          />
        ))}
      </View>

      {(weekly || monthly) && (
        <>
          <Text style={styles.cLongTermLabel}>LONG-TERM</Text>
          <View style={styles.cList}>
            {weekly && (
              <CompactChallengeCard inst={weekly} tag="WEEKLY" large />
            )}
            {monthly && (
              <CompactChallengeCard inst={monthly} tag="MONTHLY" large />
            )}
          </View>
        </>
      )}
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

  // Gap between sections within a zone (~16 px).
  sectionGap: { marginTop: 16 },
  // Between zones: extra space + a hairline rule for visual grouping.
  zoneDivider: {
    marginTop: 24,
    marginBottom: 0,
    height: 1,
    backgroundColor: CARD_BORDER,
  },

  // Header — one compact row
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gearBtn: { padding: 2 },
  archetypeIcon: { marginRight: 6 },
  identityText: {
    flexShrink: 1,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  identityStrong: { color: WHITE, fontWeight: '700' },
  identityDim: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  pips: { flexDirection: 'row', alignItems: 'center', marginLeft: 6, gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  pipOn: { backgroundColor: GOLD },
  pipOff: { backgroundColor: 'rgba(255,255,255,0.2)' },

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
  },
  missionCardDone: {
    borderColor: GREEN,
  },
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

  // Training (compact, inline)
  trainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  trainText: { flex: 1 },
  trainBig: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  trainBigDone: {
    color: GREEN,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  trainSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Stats grid
  statsGrid: {
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

  // Section headers
  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionHeaderTight: {
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

  // Rank progression
  rankCard: {
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
  rankBarGlow: {
    position: 'absolute',
    left: 0,
    top: -2,
    height: 8,
    backgroundColor: '#FFE08A',
    borderRadius: 4,
  },
  rankSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  nudgeCard: {
    marginTop: 10,
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  nudgeAccent: { width: 3, backgroundColor: GOLD },
  nudgeInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  nudgeText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // Next Badges
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badgeItem: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  badgeName: {
    marginTop: 8,
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  badgeProg: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badgeViewAll: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  badgeViewAllText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },

  // Saved Setups (watchlist) — conditional, Zone 3
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

  // Challenges (compact)
  cAllDone: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  cList: { gap: 8, marginTop: 12 },
  cListDone: { opacity: 0.7 },
  cLongTermLabel: {
    marginTop: 16,
    marginBottom: 0,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cCardDone: { borderColor: GREEN },
  cAccent: { width: 3, backgroundColor: GREEN },
  cInner: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  cInnerLarge: { paddingVertical: 13 },
  cRow: { flexDirection: 'row', alignItems: 'center' },
  cIcon: { marginRight: 8 },
  cTag: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginRight: 6,
  },
  cName: {
    flexShrink: 1,
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  cProg: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  cSwap: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cSwapBadge: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
  },
  cBarTrack: {
    marginTop: 8,
    height: 3,
    backgroundColor: '#1F1F1F',
    borderRadius: 2,
    overflow: 'hidden',
  },
  cBarFill: { height: '100%', borderRadius: 2 },
});
