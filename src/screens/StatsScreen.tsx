import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardHeader from '../components/DashboardHeader';
import AccountPerformanceCard from '../components/AccountPerformanceCard';
import MetricsCard from '../components/MetricsCard';
import CalendarHeatmap from '../components/CalendarHeatmap';
import SetupPerformanceBreakdown from '../components/SetupPerformanceBreakdown';
import PnLDistributionHistogram from '../components/PnLDistributionHistogram';
import DisciplineRateCard from '../components/DisciplineRateCard';
import PlanAdherenceCard from '../components/PlanAdherenceCard';
import SymbolPerformanceBreakdown from '../components/SymbolPerformanceBreakdown';
import DayDetailSheet from '../components/DayDetailSheet';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import { colors, borders, surface } from '../theme';

/** Filter a trade list to a single local-tz calendar day. */
function tradesForDay(
  trades: ReadonlyArray<JournalEntry>,
  date: Date | null,
): JournalEntry[] {
  if (!date) return [];
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return trades
    .filter((t) => {
      const c = new Date(t.closedAt);
      return c.getFullYear() === y && c.getMonth() === m && c.getDate() === d;
    })
    .sort((a, b) => a.closedAt - b.closedAt);
}

/**
 * Stats — the "how am I doing" surface (5-tab restructure).
 *
 * Splits out from the old monolithic Dashboard. Hosts the Account
 * hero card and the four-cell key metrics row, plus a placeholder
 * section for the equity curve / calendar heatmap / per-setup
 * breakdown that a follow-up will fill in.
 *
 * Visual treatment unchanged from the prior DashboardScreen — this
 * pass is purely content migration + nav restructure.
 */

const BG    = colors.bg;
const WHITE = colors.textPrimary;

export default function StatsScreen({ navigation }: any) {
  // Day drill-down state for the heatmap → DayDetailSheet flow.
  const allTrades = useJournalStore((s) => s.entries);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const dayTrades = useMemo(
    () => tradesForDay(allTrades, openDay),
    [allTrades, openDay],
  );

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

        {/* Account hero — taps through to the AccountDetail stub. */}
        <View style={styles.sectionGap}>
          <AccountPerformanceCard
            onPress={() => navigation.navigate('AccountDetail')}
            onStartSession={() => navigation.navigate('Chart')}
          />
        </View>

        {/* Key metrics row. */}
        <View style={styles.sectionGap}>
          <MetricsCard />
        </View>

        {/* Trading-day heatmap — replaces the old "Detailed insights
            coming soon" placeholder. Each day cell tinted by net
            P&L magnitude (4 tiers green / red). */}
        <View style={[styles.sectionGap, styles.cardL1]}>
          <Text style={styles.cardEyebrow}>TRADING DAYS</Text>
          <CalendarHeatmap onDayPress={(d) => setOpenDay(d)} />
        </View>

        {/* Per-setup performance — gold-bar magnitude + colored P&L
            number. Sort by net P&L descending. */}
        <View style={[styles.sectionGap, styles.cardL1]}>
          <Text style={styles.cardEyebrow}>BY SETUP</Text>
          <SetupPerformanceBreakdown
            // We're already inside the MainTabs navigator — jump
            // sideways to the Learn tab directly.
            onBrowseLibrary={() => navigation.navigate('Learn')}
            // Row tap drills into the per-setup detail screen — the
            // SetupStats route lives at the root stack level, so we
            // just bubble up by name.
            onRowPress={(setupId) =>
              navigation.navigate('SetupStats', { setupId })
            }
          />
        </View>

        {/* Discipline rate — % of trades with full checklist
            completed. Rings + number, process-not-outcome. */}
        <View style={styles.sectionGap}>
          <DisciplineRateCard />
        </View>

        {/* Plan adherence — stacked bar of how each trade played
            out vs its own plan (hit-target / partial / early /
            stopped). Trades without a captured plan are excluded. */}
        <View style={styles.sectionGap}>
          <PlanAdherenceCard />
        </View>

        {/* Per-symbol performance — same visual treatment as the
            per-setup breakdown above. Rows static for now; symbol
            drill-down is a future task. */}
        <View style={[styles.sectionGap, styles.cardL1]}>
          <Text style={styles.cardEyebrow}>BY SYMBOL</Text>
          <SymbolPerformanceBreakdown />
        </View>

        {/* P&L distribution — symmetric histogram around $0, green
            right side / red left side, "drawn not filled" bars. */}
        <View style={[styles.sectionGap, styles.cardL1]}>
          <Text style={styles.cardEyebrow}>P&amp;L DISTRIBUTION</Text>
          <PnLDistributionHistogram
            onStartSession={() => navigation.navigate('Chart')}
          />
        </View>
      </ScrollView>

      {/* Day drill-down sheet — opens when a heatmap cell with
          trades is tapped. Routes per-trade taps to Journal with
          the entry id pre-selected. */}
      <DayDetailSheet
        isVisible={openDay !== null}
        date={openDay}
        trades={dayTrades}
        onClose={() => setOpenDay(null)}
        onTradePress={(entryId) => {
          setOpenDay(null);
          navigation.navigate('Journal', { openEntryId: entryId });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  sectionGap: { marginTop: 24 },

  // Shared L1 card shell — hosts both the heatmap and the per-setup
  // breakdown.
  cardL1: {
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
});
