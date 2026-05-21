import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  Circle, Defs, LinearGradient, RadialGradient, Rect, Stop,
} from 'react-native-svg';

import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { useJournalStore } from '../store/journalStore';
import { useIsTodaySetupComplete } from '../store/dailySetupStore';
import { useWatchlistStore, savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { useBadgeStore } from '../store/badgeStore';
import { BADGES, Badge } from '../data/badges';
import { SETUP_LIBRARY_COUNT } from '../data/setupLibrary';
import { buildBadgeContext, getBadgeProgress } from '../utils/badgeChecker';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import { useChallengeStore, ChallengeInstance } from '../store/challengeStore';
import {
  getTodaySetup, setupStartUnixSeconds, SetupDifficulty,
} from '../data/dailySetups';

import StreakBadge from '../components/StreakBadge';
import SectionHeader from '../components/SectionHeader';
import Button from '../components/ui/Button';
import AccountPerformanceCard from '../components/AccountPerformanceCard';
import MetricsCard from '../components/MetricsCard';
import DailyChallengeTile from '../components/DailyChallengeTile';
import LongTermGoalsCollapsible from '../components/LongTermGoalsCollapsible';
import RankStrip from '../components/RankStrip';
import { colors as DT } from '../theme/tokens';

/**
 * DashboardScreen — restructured around trading performance and
 * visual variety (DESIGN_AUDIT §3.1 + user feedback).
 *
 * Top to bottom:
 *  1. Header                — archetype · handle · streak · cog
 *  2. AccountPerformanceCard — equity hero with count-up + sparkline
 *  3. MetricsCard           — single divided card, 4 cells
 *  4. Today's Mission       — staged-poster card, radial-gold glow
 *  5. Daily Challenges      — horizontal scroller of square tiles
 *  6. Long-term Goals       — collapsed row, expands to 2 cards
 *  7. RankStrip             — slim 64pt strip, replaces rank card
 *                             + next-badge grid + process stats
 *  8. Setup Library         — row card with stacked-cards glyph
 *  9. Daily time goal       — premium ring (gradient + dot)
 *  (10. Saved Setups        — only when ≥1, kept from prior IA)
 *
 * Recent Trades moved to the top of JournalScreen. The standalone
 * "Start session" footer button is removed — Today's Mission is the
 * one Primary CTA on the screen.
 */

const BG          = '#000000';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const TRACK       = '#1F1F1F';
const GOLD        = '#FFB800';
const GOLD_WARM   = '#FFD466';
const GREEN       = '#00D395';
const RED         = '#FF4757';
const WHITE       = '#FFFFFF';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

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

/** "2022-09-13" → "Sep 13, 2022", string-parsed (no `new Date()`). */
function formatSavedDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

// ── Premium daily time-goal ring (gradient stroke + arc-end dot) ───

function TrainingTimeRing({
  minutes, goal, size = 56, stroke = 10,
}: { minutes: number; goal: number; size?: number; stroke?: number }) {
  const safeGoal = Math.max(1, goal);
  const ratio    = Math.min(1, minutes / safeGoal);
  const radius   = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - ratio);
  const done = ratio >= 1;

  // Indicator dot at arc end. Arc starts at -90° (top) and sweeps
  // clockwise; the dot rides the leading edge of the gold stroke.
  const angle = -Math.PI / 2 + ratio * 2 * Math.PI;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="timeArc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD} />
            <Stop offset="1" stopColor={GOLD_WARM} />
          </LinearGradient>
        </Defs>
        <Circle cx={cx} cy={cy} r={radius} stroke={TRACK} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="url(#timeArc)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {ratio > 0 && !done && (
          <Circle cx={dotX} cy={dotY} r={stroke / 2 - 1} fill={GOLD_WARM} />
        )}
      </Svg>
      {done && (
        <Ionicons name="checkmark" size={Math.round(size * 0.42)} color={GOLD} />
      )}
    </View>
  );
}

// ── Setup Library stacked-cards glyph (3 offset rounded rects) ─────

function StackedCardsGlyph({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Back card */}
      <Rect x={6} y={4} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} fill="none" />
      {/* Middle card */}
      <Rect x={4} y={7} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.22)" strokeWidth={1.2} fill="none" />
      {/* Front card */}
      <Rect x={2} y={10} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.32)" strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

// ── Today's Mission radial gold ambient ────────────────────────────

function MissionGlow({ width, height }: { width: number; height: number }) {
  if (width <= 0) return null;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="missionGlow" cx="50%" cy="35%" rx="65%" ry="55%">
          <Stop offset="0" stopColor={GOLD} stopOpacity="0.06" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#missionGlow)" />
    </Svg>
  );
}

// ── Screen ─────────────────────────────────────────────────────────

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

  // Badge unlock ledger — drives the "next badge" inline on RankStrip.
  const unlockedBadges = useBadgeStore((s) => s.unlockedBadges);

  // Trade entries — used by the badge "next" picker dependency list.
  const entries = useJournalStore((s) => s.entries);

  // Real XP / rank progression.
  const currentXP = useXpStore((s) => s.currentXP);
  const rankInfo = useMemo(() => getRankForXP(currentXP), [currentXP]);

  // Single closest-to-completion next badge (drives RankStrip's
  // right side). Locked badges with numeric progress, ratio desc,
  // tie-broken by lowest remaining.
  const nextBadge = useMemo(() => {
    const ctx = buildBadgeContext();
    const cands: {
      badge: Badge; current: number; target: number; ratio: number;
    }[] = [];
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
    return cands[0] ?? null;
  }, [entries, unlockedBadges, streakCount, savedSetups]);

  const goalDone = minutesToday >= dailyGoalMin;

  const goToBadges = () =>
    navigation.navigate('Leaderboard', { initialSegment: 'badges' });

  const startSession = () => navigation.navigate('Chart');

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1 · HEADER ────────────────────────────────────── */}
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

        {/* ── 2 · ACCOUNT PERFORMANCE HERO ───────────────────── */}
        <View style={styles.sectionGap}>
          <AccountPerformanceCard
            onPress={() => navigation.navigate('AccountDetail')}
            onStartSession={startSession}
          />
        </View>

        {/* ── 3 · KEY METRICS ────────────────────────────────── */}
        <View style={styles.sectionGap}>
          <MetricsCard />
        </View>

        {/* ── 4 · TODAY'S MISSION ────────────────────────────── */}
        <View style={styles.sectionGap}>
          <TodaysMissionCard
            todaySetup={todaySetup}
            setupComplete={setupComplete}
            onTrade={() =>
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
          />
        </View>

        {/* ── 5 · DAILY CHALLENGES (horizontal scroller) ─────── */}
        <View style={styles.sectionGap}>
          <DailyChallengesStrip />
        </View>

        {/* ── 6 · LONG-TERM GOALS (collapsed row) ────────────── */}
        <View style={styles.sectionGap}>
          <LongTermGoalsRow />
        </View>

        {/* ── 7 · RANK STRIP (replaces rank card + badges grid) */}
        <View style={styles.sectionGap}>
          <RankStrip
            rankInfo={rankInfo}
            nextBadge={nextBadge}
            onPress={goToBadges}
          />
        </View>

        {/* ── 8 · SETUP LIBRARY ──────────────────────────────── */}
        <Pressable
          style={[styles.card, styles.libCard, styles.sectionGap]}
          onPress={() => navigation.navigate('SetupLibrary')}
          accessibilityRole="button"
          accessibilityLabel={`Setup Library, ${SETUP_LIBRARY_COUNT} patterns to learn`}
        >
          <Ionicons name="book-outline" size={24} color={GOLD} />
          <View style={styles.libText}>
            <Text style={styles.libTitle}>Setup Library</Text>
            <Text style={styles.libSub}>
              {SETUP_LIBRARY_COUNT} patterns to learn
            </Text>
          </View>
          {/* Decorative stacked-cards glyph hints at "library of
              patterns." White@30% so it reads as ambient, not as
              an actionable affordance. */}
          <View style={styles.libGlyph}>
            <StackedCardsGlyph size={36} />
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(255,255,255,0.3)"
          />
        </Pressable>

        {/* ── 9 · DAILY TIME GOAL RING ───────────────────────── */}
        <Pressable
          style={[styles.card, styles.trainCard, styles.sectionGap]}
          onPress={() => navigation.navigate('Chart')}
          accessibilityRole="button"
          accessibilityLabel={`${Math.floor(minutesToday)} of ${dailyGoalMin} training minutes today`}
        >
          <TrainingTimeRing
            minutes={minutesToday}
            goal={dailyGoalMin}
            size={64}
            stroke={10}
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

        {/* ── 10 · SAVED SETUPS (conditional, kept from prior IA) */}
        {savedSetups.length > 0 && (
          <>
            <View style={[styles.sectionHeader, styles.sectionGap]}>
              <SectionHeader
                title="Saved Setups"
                icon={<Ionicons name="bookmark-outline" size={16} color="rgba(255,255,255,0.5)" />}
              />
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

// ── Today's Mission card ───────────────────────────────────────────

function TodaysMissionCard({
  todaySetup, setupComplete, onTrade,
}: {
  todaySetup: ReturnType<typeof getTodaySetup>;
  setupComplete: boolean;
  onTrade: () => void;
}) {
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  return (
    <View
      style={[
        styles.card,
        styles.missionCard,
        styles.missionElevated,
        setupComplete && styles.missionCardDone,
      ]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ w: width, h: height });
      }}
    >
      {/* Radial gold ambient — turns the card from "flat dark
          rectangle" into a stage (~6% peak per §3.1). */}
      <MissionGlow width={size.w} height={size.h} />
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
        <View style={styles.missionTipRow}>
          {/* Filled bulb at gold@90% (PART C — filled where it
              should read with weight). */}
          <Ionicons
            name="bulb"
            size={14}
            color="rgba(255,184,0,0.9)"
            style={styles.missionTipIcon}
          />
          <Text style={[styles.missionTip, styles.missionTipText]}>
            {todaySetup.tip}
          </Text>
        </View>

        <View style={styles.missionCtaWrap}>
          {setupComplete ? (
            <View style={styles.missionCtaDone}>
              <Text style={styles.missionCtaTextDone}>Completed ✓</Text>
            </View>
          ) : (
            <Button
              label="Trade this setup"
              variant="primary"
              hero
              onPress={onTrade}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ── Difficulty badge — refined to label-size, 1px border ──────────

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

// ── Daily Challenges horizontal scroller ───────────────────────────

function DailyChallengesStrip() {
  const dailies   = useChallengeStore((s) => s.activeDailies);
  const skipsUsed = useChallengeStore((s) => s.skipsUsedThisWeek);
  const skipDaily = useChallengeStore((s) => s.skipDaily);
  const userRank  = useXpStore((s) => s.currentRank);

  const allComplete =
    dailies.length > 0 && dailies.every((d) => d.completed);
  const canSwap = skipsUsed < 1;

  return (
    <View>
      <SectionHeader
        title="Daily Challenges"
        icon={<MaterialCommunityIcons name="target" size={16} color="rgba(255,255,255,0.5)" />}
      />

      {allComplete && (
        <Text style={styles.cAllDone}>All daily challenges complete ✓</Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dailiesRow}
        style={[allComplete && { opacity: 0.7 }]}
      >
        {dailies.map((d: ChallengeInstance, i: number) => (
          <DailyChallengeTile
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
      </ScrollView>
    </View>
  );
}

// ── Long-term Goals collapsed row ──────────────────────────────────

function LongTermGoalsRow() {
  const weekly  = useChallengeStore((s) => s.activeWeekly);
  const monthly = useChallengeStore((s) => s.activeMonthly);
  if (!weekly && !monthly) return null;
  return <LongTermGoalsCollapsible weekly={weekly} monthly={monthly} />;
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100, // ~100px clear of the tab bar
  },

  // PART B — more breathing room: 24pt between major sections.
  sectionGap: { marginTop: 24 },

  // Header — one compact row
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
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

  // Card shell — 1px top hairline simulates light catching the edge.
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: DT.hairlineHighlight,
    borderRadius: 16,
  },

  // ── Today's Mission ──
  missionCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  missionElevated: {
    backgroundColor: DT.surfaceElevated,
  },
  missionCardDone: { borderColor: GREEN },
  missionAccent: { width: 3, backgroundColor: GREEN },
  missionInner: { flex: 1, padding: 20 },
  missionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // KEPT GOLD — deliberate exception (singular hero card eyebrow).
  missionLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  // Refined: 1px border, smaller padding so the pill reads as a
  // label-sized chip rather than a chunky button.
  diffBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diffBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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
  missionTipRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  missionTipIcon: { marginRight: 6, marginTop: 2 },
  missionTip: {
    color: 'rgba(255,184,0,0.85)',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  missionTipText: { flex: 1 },
  missionCtaWrap: { marginTop: 18 },
  missionCtaDone: {
    height: 52,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCtaTextDone: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Setup Library entry card ──
  libCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  libText: { flex: 1 },
  libTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  libSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  libGlyph: {
    marginRight: 4,
  },

  // ── Training (compact, inline) ──
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

  // ── Section header (light-weight) ──
  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },

  // ── Daily Challenges row ──
  dailiesRow: {
    paddingRight: 4,
    paddingTop: 8,
    gap: 10,
  },
  cAllDone: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },

  // ── Saved Setups (watchlist) ──
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
    borderTopColor: DT.hairlineHighlight,
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
});
