import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import Button from '../components/ui/Button';
import NumericText from '../components/NumericText';
import EquityCurveSparkline from '../components/EquityCurveSparkline';
import CalendarHeatmap from '../components/CalendarHeatmap';
import PnLDistributionHistogram from '../components/PnLDistributionHistogram';
import DayDetailSheet from '../components/DayDetailSheet';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import {
  getLibrarySetup, CATEGORY_LABEL,
} from '../data/setupLibrary';
import { getSetupStatsById } from '../lib/setupPerformance';
import { computeSetupPnLProgression } from '../lib/setupEquitySeries';
import {
  colors, typography, borders, surface,
} from '../theme';

/**
 * Per-setup performance detail. Filters the user's trades to a
 * single `setupId` and reuses the existing charts (equity / heatmap
 * / histogram) against that filtered slice.
 *
 * Reached from the Stats screen's per-setup breakdown rows.
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;
const HAIRLINE = '#1F1F1F';

export default function SetupStatsScreen({ route, navigation }: any) {
  const setupId = route?.params?.setupId as string | undefined;
  const setup = setupId ? getLibrarySetup(setupId) : undefined;

  const allTrades = useJournalStore((s) => s.entries);
  const setupTrades = useMemo(
    () => setupId ? allTrades.filter((t) => t.setupId === setupId) : [],
    [allTrades, setupId],
  );
  const stats = useMemo(
    () => setupId ? getSetupStatsById(allTrades, setupId) : null,
    [allTrades, setupId],
  );
  const equitySeries = useMemo(
    () => computeSetupPnLProgression(setupTrades),
    [setupTrades],
  );

  const [cardWidth, setCardWidth] = useState(0);
  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== cardWidth) setCardWidth(w);
  };

  // Day drill-down for the filtered heatmap. The day filter sits
  // ON TOP of the setupId filter, so the sheet only shows trades
  // for this setup on the tapped day — that's exactly what we want.
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const dayTrades = useMemo(() => {
    if (!openDay) return [] as JournalEntry[];
    const y = openDay.getFullYear();
    const m = openDay.getMonth();
    const d = openDay.getDate();
    return setupTrades
      .filter((t) => {
        const c = new Date(t.closedAt);
        return c.getFullYear() === y && c.getMonth() === m && c.getDate() === d;
      })
      .sort((a, b) => a.closedAt - b.closedAt);
  }, [setupTrades, openDay]);

  if (!setup) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
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
        <Text style={styles.missingText}>Setup not found.</Text>
      </SafeAreaView>
    );
  }

  const chartWidth = Math.max(0, cardWidth - 32); // 16pt padding × 2

  const pnlColor =
    !stats || stats.netPnl === 0 ? WHITE :
    stats.netPnl > 0 ? GREEN : RED;
  const pnlSign  =
    !stats || stats.netPnl === 0 ? '' :
    stats.netPnl > 0 ? '+' : '-';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header — back chevron + display title */}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={[typography.display, styles.title]}>{setup.name}</Text>
          <Text style={styles.subline}>
            {(CATEGORY_LABEL[setup.category] ?? setup.category).toUpperCase()}
            {' · '}
            {setup.difficulty.toUpperCase()}
          </Text>
        </View>

        {/* Hero stats row — 5 cells divided by vertical hairlines. */}
        <View style={[styles.heroCard, styles.sectionGap]}>
          <HeroCell label="TRADES" value={stats ? String(stats.tradeCount) : '—'} />
          <View style={styles.heroDivider} />
          <HeroCell
            label="WIN RATE"
            value={stats ? `${Math.round(stats.winRate)}%` : '—'}
          />
          <View style={styles.heroDivider} />
          <HeroCell
            label="NET P&L"
            value={
              stats
                ? `${pnlSign}$${formatAbsShort(Math.abs(stats.netPnl))}`
                : '—'
            }
            valueColor={pnlColor}
          />
          <View style={styles.heroDivider} />
          <HeroCell
            label="PF"
            value={
              !stats || stats.profitFactor === null
                ? '—'
                : stats.profitFactor === 'inf'
                  ? '∞'
                  : stats.profitFactor.toFixed(1)
            }
          />
          <View style={styles.heroDivider} />
          <HeroCell
            label="AVG R:R"
            value={
              stats && stats.tradeCount > 0
                ? avgRRDisplay(setupTrades)
                : '—'
            }
          />
        </View>

        {/* Equity progression — taller than the Stats hero spark. */}
        <View style={[styles.chartCard, styles.sectionGap]} onLayout={onCardLayout}>
          <Text style={styles.cardEyebrow}>P&amp;L PROGRESSION</Text>
          <EquityCurveSparkline
            data={equitySeries}
            startingBalance={0}
            width={chartWidth}
            height={120}
          />
        </View>

        {/* Calendar heatmap, filtered. */}
        <View style={[styles.chartCard, styles.sectionGap]}>
          <Text style={styles.cardEyebrow}>TRADING DAYS</Text>
          <CalendarHeatmap
            trades={setupTrades}
            onDayPress={(d) => setOpenDay(d)}
          />
        </View>

        {/* P&L distribution histogram, filtered. */}
        <View style={[styles.chartCard, styles.sectionGap]}>
          <Text style={styles.cardEyebrow}>P&amp;L DISTRIBUTION</Text>
          <PnLDistributionHistogram trades={setupTrades} />
        </View>

        {/* Bottom CTA — back to the lesson. */}
        <View style={styles.bottomCta}>
          <Button
            label="Read the lesson"
            variant="tertiary"
            onPress={() => navigation.navigate('SetupDetail', { setupId: setup.id })}
          />
        </View>
      </ScrollView>

      {/* Day drill-down sheet — opens when a heatmap cell with
          trades is tapped. The list shows ONLY this setup's trades
          for that day since `setupTrades` is already filtered
          upstream. */}
      <DayDetailSheet
        isVisible={openDay !== null}
        date={openDay}
        trades={dayTrades}
        onClose={() => setOpenDay(null)}
        onTradePress={(entryId) => {
          setOpenDay(null);
          // SetupStats is a root-stack screen; Journal is a tab
          // inside Main — bridge via nested navigation so the
          // openEntryId param threads through to JournalScreen.
          navigation.navigate('Main', {
            screen: 'Journal',
            params: { openEntryId: entryId },
          });
        }}
      />
    </SafeAreaView>
  );
}

// ── Hero cell ──────────────────────────────────────────────────────

function HeroCell({
  label, value, valueColor,
}: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.heroCell}>
      <NumericText
        bold
        style={[styles.heroValue, valueColor ? { color: valueColor } : null]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </NumericText>
      <Text style={styles.heroLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function avgRRDisplay(trades: ReadonlyArray<{ rrAchieved: number | null }>): string {
  // rrAchieved only — no rMultiple fallback. Trades pre-plan-
  // capture (no intendedRisk) cleanly read as "no signal" rather
  // than mixing backend R with discipline-signal R.
  const xs = trades
    .map((t) => t.rrAchieved)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (xs.length === 0) return '—';
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
  return `${avg >= 0 ? '' : '−'}${Math.abs(avg).toFixed(2)}`;
}

function formatAbsShort(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  headerBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6 },
  missingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    paddingHorizontal: 20,
  },

  titleWrap: { marginTop: 4 },
  title: { color: WHITE },
  subline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  sectionGap: { marginTop: 20 },

  // Hero stats row — same divided-cells pattern as the Stats MetricsCard.
  heroCard: {
    flexDirection: 'row',
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  heroCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  heroDivider: {
    width: 1,
    backgroundColor: HAIRLINE,
    marginVertical: 8,
  },
  heroValue: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  // Chart card shell — re-used for the three charts below the hero.
  chartCard: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
  },
  cardEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  bottomCta: {
    marginTop: 24,
    alignItems: 'center',
  },
});
