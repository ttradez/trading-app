import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import {
  computeEdgeStats, formatHold, EdgeTrade, InsightType,
} from '../utils/edgeStats';

/**
 * InsightsScreen — "Your Tendencies". Joins journal P&L/direction/
 * hold-time/plan-setup with journal grade/emotion tags, runs
 * `computeEdgeStats`, and renders the behavioral breakdown. Every
 * section degrades to a muted "need more data" line below its
 * sample threshold. Pushed onto the root stack (own back button).
 */

const BG          = '#000000';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const TRACK       = '#1F1F1F';
const GOLD        = '#FFB800';
const GREEN       = '#00D395';
const RED         = '#FF4757';
const WHITE       = '#FFFFFF';
const MUTED       = 'rgba(255,255,255,0.4)';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Win-rate → bar color. Green ≥55, red <45, white between. */
function rateColor(r: number): string {
  if (r >= 55) return GREEN;
  if (r < 45) return RED;
  return WHITE;
}

function StatBar({
  label, winRate, count, color, dim,
}: {
  label: string; winRate: number; count: number;
  color: string; dim?: boolean;
}) {
  return (
    <View style={[styles.barRow, dim && { opacity: 0.55 }]}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(2, Math.min(100, winRate))}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={styles.barValue}>
        {winRate}% <Text style={styles.barCount}>({count})</Text>
      </Text>
    </View>
  );
}

function Section({
  title, enough, placeholder, children,
}: {
  title: string; enough: boolean; placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {enough ? children : <Text style={styles.muted}>{placeholder}</Text>}
    </View>
  );
}

const INSIGHT_ICON: Record<InsightType, { name: any; color: string; lib: 'ion' | 'mci' }> = {
  positive: { name: 'checkmark-circle', color: GREEN, lib: 'ion' },
  neutral:  { name: 'information-circle', color: GOLD, lib: 'ion' },
  warning:  { name: 'alert-circle', color: RED, lib: 'ion' },
};

export default function InsightsScreen({ navigation }: any) {
  const entries   = useJournalStore((s) => s.entries);
  const tjEntries = useTradeJournalStore((s) => s.entries);

  const trades: EdgeTrade[] = useMemo(
    () =>
      entries.map((e) => {
        const tj = tjEntries[e.id];
        return {
          direction: e.side === 'buy' ? 'long' : 'short',
          pnl: e.pnl,
          openedAt: e.openedAt,
          closedAt: e.closedAt,
          savedAt: e.savedAt,
          setupType: e.planSetupType ?? null,
          emotions: tj?.emotions ?? [],
          grade: tj?.grade ?? null,
        };
      }),
    [entries, tjEntries],
  );

  const s = useMemo(() => computeEdgeStats(trades), [trades]);

  const Header = (
    <View style={styles.headerBar}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="arrow-back" size={24} color={WHITE} />
      </Pressable>
    </View>
  );

  // ── Empty state (< 5 trades) ─────────────────────────────────
  if (s.totalTrades < 5) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        {Header}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Your Tendencies</Text>
          <Text style={styles.subtitle}>Patterns from your trading data</Text>
        </View>
        <View style={styles.emptyWrap}>
          <MaterialCommunityIcons
            name="brain"
            size={64}
            color="rgba(255,184,0,0.3)"
          />
          <Text style={styles.emptyTitle}>Not enough data yet</Text>
          <Text style={styles.emptyBody}>
            Place at least 5 trades to start seeing your patterns. The
            more you trade and journal, the sharper your insights get.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Main', { screen: 'Chart' })}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Start trading"
          >
            <Text style={styles.ctaText}>Start trading</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hi = s.headlineInsight!;
  const hiIcon = INSIGHT_ICON[hi.type];
  const hiBorder =
    hi.type === 'warning' ? RED : hi.type === 'positive' ? GOLD : GOLD;

  const dirEnough = s.longWinRate != null && s.shortWinRate != null;
  const holdEnough =
    s.avgWinnerHoldMinutes != null && s.avgLoserHoldMinutes != null;

  const weekTrend =
    s.tradesThisWeek === s.tradesLastWeek
      ? null
      : s.tradesThisWeek > s.tradesLastWeek
        ? '↑'
        : '↓';

  // Positive grade↔outcome correlation: top grades beat bottom grades.
  const gradeCorrPositive = (() => {
    if (!s.gradeStats) return false;
    const top = s.gradeStats.filter((g) => g.grade === 'A+' || g.grade === 'A');
    const bot = s.gradeStats.filter((g) => g.grade === 'C' || g.grade === 'F');
    if (top.length === 0 || bot.length === 0) return false;
    const avg = (xs: typeof top) =>
      xs.reduce((a, b) => a + b.winRate, 0) / xs.length;
    return avg(top) > avg(bot);
  })();

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {Header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Tendencies</Text>
        <Text style={styles.subtitle}>Patterns from your trading data</Text>

        {/* Headline insight */}
        <View style={[styles.insightCard, { borderLeftColor: hiBorder }]}>
          <View style={styles.insightTop}>
            <Ionicons name={hiIcon.name} size={16} color={hiIcon.color} />
            <Text style={styles.insightLabel}>INSIGHT</Text>
          </View>
          <Text style={styles.insightText}>{hi.text}</Text>
        </View>

        {/* Direction Bias */}
        <Section
          title="Direction Bias"
          enough={dirEnough}
          placeholder="Take 3+ trades in each direction to see your bias"
        >
          <StatBar
            label="LONG"
            winRate={s.longWinRate ?? 0}
            count={s.longCount}
            color={GREEN}
            dim={(s.longWinRate ?? 0) < (s.shortWinRate ?? 0)}
          />
          <StatBar
            label="SHORT"
            winRate={s.shortWinRate ?? 0}
            count={s.shortCount}
            color={RED}
            dim={(s.shortWinRate ?? 0) < (s.longWinRate ?? 0)}
          />
        </Section>

        {/* Hold Duration */}
        <Section
          title="Hold Duration"
          enough={holdEnough}
          placeholder="Take 3+ winners and 3+ losers to see your hold habits"
        >
          <View style={styles.holdRow}>
            <Text style={styles.holdLabel}>Winners</Text>
            <Text style={[styles.holdVal, { color: GREEN }]}>
              avg {formatHold(s.avgWinnerHoldMinutes ?? 0)}
            </Text>
          </View>
          <View style={styles.holdRow}>
            <Text style={styles.holdLabel}>Losers</Text>
            <Text style={[styles.holdVal, { color: RED }]}>
              avg {formatHold(s.avgLoserHoldMinutes ?? 0)}
            </Text>
          </View>
          {s.holdRatio != null && (
            <Text style={styles.holdInsight}>
              {s.holdRatio >= 1
                ? `You hold winners ${s.holdRatio.toFixed(1)}x longer than losers`
                : `You hold losers ${(1 / s.holdRatio).toFixed(1)}x longer than winners — consider cutting faster`}
            </Text>
          )}
        </Section>

        {/* Setup Performance */}
        <Section
          title="Setup Performance"
          enough={s.setupStats != null}
          placeholder="Use the pre-trade checklist on 5+ trades to see which setups work for you"
        >
          {s.setupStats?.map((st) => (
            <StatBar
              key={st.setup}
              label={cap(st.setup)}
              winRate={st.winRate}
              count={st.count}
              color={rateColor(st.winRate)}
            />
          ))}
        </Section>

        {/* Emotional Patterns */}
        <Section
          title="Emotional Patterns"
          enough={s.emotionStats != null}
          placeholder="Tag emotions in the journal on 5+ trades"
        >
          {s.emotionStats?.map((em) => (
            <StatBar
              key={em.emotion}
              label={em.emotion}
              winRate={em.winRate}
              count={em.count}
              color={rateColor(em.winRate)}
            />
          ))}
        </Section>

        {/* Grade vs. Outcome */}
        <Section
          title="Grade vs. Outcome"
          enough={s.gradeStats != null}
          placeholder="Grade your execution in the journal on 5+ trades"
        >
          {s.gradeStats?.map((g) => (
            <StatBar
              key={g.grade}
              label={g.grade}
              winRate={g.winRate}
              count={g.count}
              color={rateColor(g.winRate)}
            />
          ))}
          {gradeCorrPositive && (
            <Text style={styles.holdInsight}>
              Higher self-grades correlate with better outcomes. Trust
              your process.
            </Text>
          )}
        </Section>

        {/* Consistency — always shown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consistency</Text>
          <View style={styles.consRow}>
            <Text style={styles.consLabel}>Trades this week</Text>
            <Text style={styles.consVal}>
              {s.tradesThisWeek}
              {weekTrend ? (
                <Text
                  style={{
                    color: weekTrend === '↑' ? GREEN : RED,
                  }}
                >
                  {' '}{weekTrend}
                </Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.consRow}>
            <Text style={styles.consLabel}>Trades last week</Text>
            <Text style={styles.consVal}>{s.tradesLastWeek}</Text>
          </View>
          <View style={styles.consRow}>
            <Text style={styles.consLabel}>Journal rate</Text>
            <Text style={styles.consVal}>{s.journalRate}%</Text>
          </View>
          <View style={styles.consRow}>
            <Text style={styles.consLabel}>Average grade</Text>
            <Text style={styles.consVal}>{s.avgGrade ?? '—'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },

  headerBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6 },

  titleWrap: { paddingHorizontal: 20 },
  title: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },

  // Headline insight card
  insightCard: {
    marginTop: 22,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 14,
    padding: 16,
  },
  insightTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  insightText: {
    marginTop: 10,
    color: WHITE,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 25.5,
  },

  // Sections
  section: { marginTop: 28 },
  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  muted: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },

  // Bars
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    width: 78,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: TRACK,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: {
    width: 92,
    textAlign: 'right',
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  barCount: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
  },

  // Hold duration
  holdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  holdLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  holdVal: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  holdInsight: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },

  // Consistency
  consRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  consLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  consVal: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emptyTitle: {
    marginTop: 20,
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  emptyBody: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
  },
  cta: {
    marginTop: 28,
    backgroundColor: GOLD,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ctaText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
