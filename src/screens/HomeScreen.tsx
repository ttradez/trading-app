import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useStreakStore } from '../store/streakStore';
import { useJournalStore } from '../store/journalStore';
import { useWatchlistStore, savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { useBadgeStore } from '../store/badgeStore';
import { BADGES, Badge } from '../data/badges';
import { buildBadgeContext, getBadgeProgress } from '../utils/badgeChecker';
import { useXpStore } from '../store/xpStore';
import { useAuthStore } from '../store/authStore';
import { getRankForXP } from '../data/rankConfig';
import { useChallengeStore, ChallengeInstance } from '../store/challengeStore';

import SectionHeader from '../components/SectionHeader';
import NumericText from '../components/NumericText';
import DailyChallengeTile from '../components/DailyChallengeTile';
import {
  AtRiskChip, FreezeConsumedToast,
} from '../components/HomeStreakSignals';
import SundayWrapBanner from '../components/SundayWrapBanner';
import WeeklyRecapModal from '../components/WeeklyRecapModal';
import { useRecapStore } from '../store/recapStore';
import { isoWeekId, WeeklyRecap } from '../utils/weeklyRecap';
import LongTermGoalsCollapsible from '../components/LongTermGoalsCollapsible';
import RankStrip from '../components/RankStrip';
import DashboardHeader from '../components/DashboardHeader';
import StartSessionHero from '../components/StartSessionHero';
import { colors as DT } from '../theme/tokens';

/**
 * Home — the "what to do right now" surface (5-tab restructure).
 *
 * Splits out from the old monolithic Dashboard. Account hero +
 * key metrics moved to Stats. What stays here: identity header,
 * Daily Challenges scroller, Long-term Goals collapsed row,
 * RankStrip, daily time-goal ring, and the conditional Saved
 * Setups row (kept here because it's a "do this next" affordance,
 * not a performance metric).
 *
 * Visual treatment unchanged from the prior DashboardScreen — this
 * pass is purely content migration + nav restructure. Visual polish
 * follows in a separate task.
 */

const BG          = '#000000';
// Secondary cards on Home — L1 in the layered surface system.
const CARD_BG     = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const GREEN       = '#00D395';
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

// Daily time-goal ring now lives in DashboardHeader — see
// src/components/TrainingTimeRing.tsx. The standalone Home card
// was retired in the polish pass.

// ── Screen ─────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
  // Streak — drives the next-badge memo's dependency list (the
  // training-minutes / daily-goal ring lives in DashboardHeader
  // now, so we no longer read them here).
  const streakCount  = useStreakStore((s) => s.currentStreak);

  // Saved setups (watchlist) — conditional row.
  const savedSetups = useWatchlistStore((s) => s.savedSetups);

  // Badge ledger — drives the RankStrip "next badge" indicator.
  const unlockedBadges = useBadgeStore((s) => s.unlockedBadges);

  // Trade entries — dependency for the next-badge memo.
  const entries = useJournalStore((s) => s.entries);

  // Real XP / rank progression. Backend XP (via DashboardHeader's
  // refreshServerXp on mount) is the source of truth; this screen's
  // RankStrip falls back to the local mirror until the first fetch
  // lands. Phase 2: when the backend rank object is present, override
  // the label + progress numbers with the server's authoritative
  // values (the new ladder has 7 tiers vs the local 5). The visual
  // chip (`rank`, `subTier`) keeps using the local derivation so the
  // legacy RankBanner visual still renders correctly.
  const currentXP   = useXpStore((s) => s.currentXP);
  const serverXp    = useXpStore((s) => s.serverXp);
  const serverRank  = useXpStore((s) => s.serverRank);
  // Server XP can lag behind currentXP when challenge grants are
  // local-only — use max so progress is monotonic in the UI.
  const xpForRank   = Math.max(serverXp ?? 0, currentXP);
  const localRank   = useMemo(() => getRankForXP(xpForRank), [xpForRank]);
  const rankInfo = useMemo(() => {
    if (!serverRank) return localRank;
    return {
      ...localRank,
      label: serverRank.level_name,
      xpInTier: serverRank.xp_into_level,
      xpNeededForNext: serverRank.is_max
        ? 0
        : serverRank.xp_into_level + serverRank.xp_for_next,
      next: serverRank.is_max || !serverRank.next_level_name
        ? null
        : { ...(localRank.next ?? {} as any), label: serverRank.next_level_name },
    } as typeof localRank;
  }, [serverRank, localRank]);

  // Pull authoritative XP from backend on mount + whenever uid changes.
  const uid = useAuthStore((s) => s.uid);
  const refreshServerXp = useXpStore((s) => s.refreshServerXp);
  useEffect(() => {
    if (uid) refreshServerXp(uid);
  }, [uid, refreshServerXp]);

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

  const goToBadges = () =>
    navigation.navigate('Leaderboard', { initialSegment: 'badges' });

  // Sunday Wrap banner → modal. The banner only renders during the
  // Sun-Tue window and self-hides when viewedAt / bannerDismissedAt
  // is set. Tap → look up the same target-week recap and open the
  // shared modal locally (the app's auto-trigger modal mounted in
  // MainTabs is a one-shot; this gives the banner a re-entry path).
  const [bannerRecap, setBannerRecap] = useState<WeeklyRecap | null>(null);
  const openBannerRecap = useCallback(() => {
    const now = new Date();
    const dow = now.getDay();
    const ref = dow === 0 ? now : new Date(now.getTime() - 7 * 86_400_000);
    const stored = useRecapStore.getState().getRecap(isoWeekId(ref));
    if (stored) setBannerRecap(stored.recap);
  }, []);
  const dismissBannerRecap = useCallback(() => {
    setBannerRecap((cur) => {
      if (cur) useRecapStore.getState().markViewed(cur.weekId);
      return null;
    });
  }, []);

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

        {/* Quiet at-risk chip — only renders after 18:00 local when
            the user hasn't trained today and has a streak going.
            Tap dismisses for the session. */}
        <AtRiskChip />

        {/* Sunday Wrap banner — only renders Sun-Tue local when an
            unviewed, undismissed recap is stored for the target
            week (≥1 trade). Self-hides (returns null) otherwise so
            its absence costs zero layout. */}
        <SundayWrapBanner onOpen={openBannerRecap} />

        {/* ── Start Session hero (primary action) ────────────── */}
        <View style={styles.firstSectionGap}>
          <StartSessionHero
            streakDays={streakCount}
            onPress={() => navigation.navigate('Chart')}
          />
        </View>

        {/* ── Daily Challenges (horizontal scroller) ─────────── */}
        <View style={styles.sectionGap}>
          <DailyChallengesStrip />
        </View>

        {/* ── Challenges banner — "see all" entry below the dailies */}
        <View style={styles.sectionGap}>
          <ChallengesBanner />
        </View>

        {/* ── Long-term Goals (collapsed row) ────────────────── */}
        <View style={styles.sectionGap}>
          <LongTermGoalsRow />
        </View>

        {/* ── Rank strip ─────────────────────────────────────── */}
        {/* Phase 2: the strip taps into the rank-journey screen
            (Clash-Royale-style ladder) instead of the badges tab. */}
        <View style={styles.sectionGap}>
          <RankStrip
            rankInfo={rankInfo}
            nextBadge={nextBadge}
            // Tap-through now lands on the Ranks BOTTOM TAB (which
            // defaults to the Journey sub-tab with the new vertical
            // ladder). The old `Journey` stack route still exists but
            // wraps the deprecated JourneyRoad — slated for cleanup.
            onPress={() => navigation.navigate('Ranks')}
          />
        </View>

        {/* The daily time-goal ring moved into DashboardHeader in
            the polish pass — no standalone card on Home anymore. */}

        {/* ── Saved Setups (conditional) ─────────────────────── */}
        {savedSetups.length > 0 && (
          <>
            <View style={[styles.sectionHeader, styles.sectionGap]}>
              <SectionHeader
                title="Saved Setups"
                icon={<Ionicons name="bookmark-outline" size={16} color="rgba(255,255,255,0.5)" />}
              />
              <NumericText style={styles.savedCount}>{savedSetups.length} saved</NumericText>
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
      {/* Freeze-consumed toast — bottom of the SafeAreaView, sibling
          of the ScrollView so it sits above content but inside the
          screen safe area. Auto-fades after ~4s. */}
      <FreezeConsumedToast />

      {/* Sunday Wrap re-entry modal — opened from the banner above.
          Independent of the app's auto-trigger modal (App.tsx /
          MainTabs) so the banner has a guaranteed open path even
          after the auto-trigger has fired this session. */}
      <WeeklyRecapModal
        visible={bannerRecap !== null}
        recap={bannerRecap}
        onClose={dismissBannerRecap}
        onOpenTrade={(tradeId) => {
          dismissBannerRecap();
          navigation.navigate('Journal', { openEntryId: tradeId });
        }}
        onStartSession={() => navigation.navigate('Chart')}
      />
    </SafeAreaView>
  );
}

// ── Daily Challenges horizontal scroller ───────────────────────────

function DailyChallengesStrip() {
  const navigation = useNavigation<any>();
  const dailies        = useChallengeStore((s) => s.activeDailies);
  const skipsUsed      = useChallengeStore((s) => s.skipsUsedThisWeek);
  const skipDaily      = useChallengeStore((s) => s.skipDaily);
  const claimChallenge = useChallengeStore((s) => s.claimChallenge);
  const userRank       = useXpStore((s) => s.currentRank);

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
            // Tap-to-claim: grant XP, then drop the user on the Ranks
            // tab so they see their XP bar fill toward the next rank.
            onClaim={
              d.completed && !d.claimed
                ? () => {
                    claimChallenge(d.challengeId);
                    try { navigation.navigate('Ranks'); }
                    catch { /* non-fatal */ }
                  }
                : undefined
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Challenges banner ──────────────────────────────────────────────
//
// "See all" entry point below the dailies strip — opens the full
// ChallengesScreen (active rows + rank-locked preview). Lives
// alongside the 3-tile strip rather than replacing it so quick-view
// stays on Home while the screen handles the full browse.

function ChallengesBanner() {
  const navigation = useNavigation<any>();
  const dailies = useChallengeStore((s) => s.activeDailies);
  const weekly  = useChallengeStore((s) => s.activeWeekly);
  const monthly = useChallengeStore((s) => s.activeMonthly);

  const activeTotal = dailies.length + (weekly ? 1 : 0) + (monthly ? 1 : 0);
  const completedTotal =
    dailies.filter((d) => d.completed).length +
    (weekly?.completed ? 1 : 0) +
    (monthly?.completed ? 1 : 0);
  const allDone = activeTotal > 0 && completedTotal === activeTotal;

  return (
    <Pressable
      onPress={() => navigation.navigate('Challenges')}
      style={({ pressed }) => [
        styles.challengesBanner,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open Challenges"
    >
      <View style={styles.challengesIconWrap}>
        <Ionicons name="trophy" size={26} color="#FFB800" />
      </View>

      <View style={styles.challengesBannerBody}>
        <Text style={styles.challengesBannerTitle}>CHALLENGES</Text>
        <Text style={styles.challengesBannerSub} numberOfLines={1}>
          {activeTotal === 0
            ? 'Start a session to unlock today\'s set'
            : allDone
              ? 'All current challenges complete ✓'
              : `${completedTotal} / ${activeTotal} complete · climb the ranks`}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="rgba(255,255,255,0.45)"
      />
    </Pressable>
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
  // 24pt between every section on Home (polish-pass spec). The
  // first section uses a tighter 16pt below the header (or below
  // the at-risk chip if it's visible) — see firstSectionGap.
  sectionGap: { marginTop: 24 },
  firstSectionGap: { marginTop: 16 },

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

  // ── Challenges banner (Home CTA) ────────────────────────────────
  challengesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderColor: 'rgba(255,184,0,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 4,
    shadowColor: '#FFB800',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  challengesIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,184,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  challengesBannerBody: {
    flex: 1,
    minWidth: 0,
  },
  challengesBannerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  challengesBannerSub: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
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
    // Responsive width — was hardcoded 160dp, which made budget Android
    // devices (Galaxy A05s ≈ 320dp) only show one card at a time, hiding
    // the horizontal-scroll affordance. min(160, 42% of screen) keeps
    // two cards visible with a small peek on every device class we
    // care about (iPhone Pro Max, Pixel, Galaxy A-series).
    width: Math.min(160, Dimensions.get('window').width * 0.42),
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
