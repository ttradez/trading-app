import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, {
  Circle, Defs, LinearGradient, RadialGradient, Rect, Stop,
} from 'react-native-svg';

import { useStreakStore } from '../store/streakStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useJournalStore } from '../store/journalStore';
import { useIsTodaySetupComplete } from '../store/dailySetupStore';
import { useWatchlistStore, savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { useBadgeStore } from '../store/badgeStore';
import { BADGES, Badge } from '../data/badges';
import { buildBadgeContext, getBadgeProgress } from '../utils/badgeChecker';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import { useChallengeStore, ChallengeInstance } from '../store/challengeStore';
import {
  getTodaySetup, setupStartUnixSeconds, SetupDifficulty,
} from '../data/dailySetups';

import SectionHeader from '../components/SectionHeader';
import Button from './../components/ui/Button';
import DailyChallengeTile from '../components/DailyChallengeTile';
import LongTermGoalsCollapsible from '../components/LongTermGoalsCollapsible';
import RankStrip from '../components/RankStrip';
import DashboardHeader from '../components/DashboardHeader';
import { colors as DT } from '../theme/tokens';

/**
 * Home — the "what to do right now" surface (5-tab restructure).
 *
 * Splits out from the old monolithic Dashboard. Account hero +
 * key metrics moved to Stats; Setup Library moved to Learn.
 * What stays here: identity header, Today's Mission, Daily
 * Challenges scroller, Long-term Goals collapsed row, RankStrip,
 * daily time-goal ring, and the conditional Saved Setups row
 * (kept here because it's a "do this next" affordance, not a
 * performance metric).
 *
 * Visual treatment unchanged from the prior DashboardScreen — this
 * pass is purely content migration + nav restructure. Visual polish
 * follows in a separate task.
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

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatSavedDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

// ── Premium daily time-goal ring ───────────────────────────────────

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

export default function HomeScreen({ navigation }: any) {
  // Streak / training time
  const streakCount  = useStreakStore((s) => s.currentStreak);
  const minutesToday = useStreakStore((s) => s.todayTrainingMinutes);

  // Onboarding goal
  const dailyGoalMin = useOnboardingStore((s) => s.dailyTimeGoalMinutes);

  // Daily mission
  const todaySetup = useMemo(() => getTodaySetup(), []);
  const setupComplete = useIsTodaySetupComplete();

  // Saved setups (watchlist) — conditional row.
  const savedSetups = useWatchlistStore((s) => s.savedSetups);

  // Badge ledger — drives the RankStrip "next badge" indicator.
  const unlockedBadges = useBadgeStore((s) => s.unlockedBadges);

  // Trade entries — dependency for the next-badge memo.
  const entries = useJournalStore((s) => s.entries);

  // Real XP / rank progression.
  const currentXP = useXpStore((s) => s.currentXP);
  const rankInfo = useMemo(() => getRankForXP(currentXP), [currentXP]);

  // Closest-to-completion next badge for RankStrip.
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

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader
          onSettingsPress={() => navigation.navigate('Settings')}
        />

        {/* ── Today's Mission ─────────────────────────────────── */}
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

        {/* ── Daily Challenges (horizontal scroller) ─────────── */}
        <View style={styles.sectionGap}>
          <DailyChallengesStrip />
        </View>

        {/* ── Long-term Goals (collapsed row) ────────────────── */}
        <View style={styles.sectionGap}>
          <LongTermGoalsRow />
        </View>

        {/* ── Rank strip ─────────────────────────────────────── */}
        <View style={styles.sectionGap}>
          <RankStrip
            rankInfo={rankInfo}
            nextBadge={nextBadge}
            onPress={goToBadges}
          />
        </View>

        {/* ── Daily time-goal ring ───────────────────────────── */}
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

        {/* ── Saved Setups (conditional) ─────────────────────── */}
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
    paddingBottom: 100,
  },
  sectionGap: { marginTop: 24 },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: DT.hairlineHighlight,
    borderRadius: 16,
  },

  // Today's Mission
  missionCard: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  missionElevated: { backgroundColor: DT.surfaceElevated },
  missionCardDone: { borderColor: GREEN },
  missionAccent: { width: 3, backgroundColor: GREEN },
  missionInner: { flex: 1, padding: 20 },
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

  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
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

  // Saved Setups
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
