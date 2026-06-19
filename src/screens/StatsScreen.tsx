import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardHeader from '../components/DashboardHeader';
import AccountPerformanceCard from '../components/AccountPerformanceCard';
import MetricsCard from '../components/MetricsCard';
import CalendarHeatmap from '../components/CalendarHeatmap';
import PnLDistributionHistogram from '../components/PnLDistributionHistogram';
import ProcessQualityCard from '../components/ProcessQualityCard';
import SymbolPerformanceBreakdown from '../components/SymbolPerformanceBreakdown';
import DayDetailSheet from '../components/DayDetailSheet';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import { useReveal } from '../hooks/useReveal';
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
 * Stats — "how am I doing" surface, tabbed restructure (June 2026).
 *
 * Previously a single long scroll with 9 stacked cards. Restructured
 * into 3 segments to reduce visual noise and let each surface own its
 * scroll:
 *
 *  - Overview     Account hero + key metrics + process quality + by symbol
 *  - Calendar     Calendar heatmap (full bleed)
 *  - Distribution P&L distribution histogram
 *
 * Each section's cards stagger-reveal on mount via `useReveal` for the
 * "feels alive" feel, layering on top of the existing per-card animations
 * (count-up numbers, ring draws, sparkline path animation). The Account
 * hero retains its own first-mount session guard so revisiting the tab
 * doesn't replay the equity count-up.
 */

type Segment = 'overview' | 'calendar' | 'distribution';

const BG = colors.bg;

const SEGMENT_LABEL: Record<Segment, string> = {
  overview:     'Overview',
  calendar:     'Calendar',
  distribution: 'P&L',
};
const SEGMENT_ORDER: ReadonlyArray<Segment> = [
  'overview', 'calendar', 'distribution',
];

export default function StatsScreen({ navigation }: any) {
  const [segment, setSegment] = useState<Segment>('overview');

  // Day drill-down state for the heatmap → DayDetailSheet flow.
  const allTrades = useJournalStore((s) => s.entries);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const dayTrades = useMemo(
    () => tradesForDay(allTrades, openDay),
    [allTrades, openDay],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <DashboardHeader
        onSettingsPress={() => navigation.navigate('Settings')}
      />

      {/* Segmented control sits below the dashboard header — pill-
          group pattern matching the rest of the app's tabs. */}
      <SegmentedTabs value={segment} onChange={setSegment} />

      {/* Each segment is its OWN ScrollView so switching tabs always
          resets to the top of that pane — a long-scroll user
          scrolling through Setups doesn't accidentally land deep in
          Overview when they tap back. The key prop forces remount on
          segment change so the reveal animations re-fire. */}
      <ScrollView
        key={segment}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {segment === 'overview' && (
          <OverviewPane navigation={navigation} />
        )}
        {segment === 'calendar' && (
          <CalendarPane onDayPress={(d) => setOpenDay(d)} />
        )}
        {segment === 'distribution' && (
          <DistributionPane navigation={navigation} />
        )}
      </ScrollView>

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

// ── Segmented tabs ───────────────────────────────────────────────────

function SegmentedTabs({
  value, onChange,
}: { value: Segment; onChange: (s: Segment) => void }) {
  return (
    <View style={styles.tabRow}>
      {SEGMENT_ORDER.map((seg) => {
        const active = seg === value;
        return (
          <Pressable
            key={seg}
            onPress={() => onChange(seg)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && !active && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={SEGMENT_LABEL[seg]}
          >
            <Text
              style={[styles.tabLabel, active && styles.tabLabelActive]}
              numberOfLines={1}
            >
              {SEGMENT_LABEL[seg]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Reveal wrapper ───────────────────────────────────────────────────

function Section({
  delay = 0, children, style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}) {
  const reveal = useReveal(delay);
  return (
    <Animated.View style={[styles.sectionGap, reveal.style, style]}>
      {children}
    </Animated.View>
  );
}

// ── Panes ────────────────────────────────────────────────────────────

function OverviewPane({ navigation }: { navigation: any }) {
  return (
    <>
      <Section delay={0}>
        <AccountPerformanceCard
          onPress={() => navigation.navigate('AccountDetail')}
          onStartSession={() => navigation.navigate('Chart')}
        />
      </Section>
      <Section delay={80}>
        <MetricsCard />
      </Section>
      <Section delay={160}>
        <ProcessQualityCard />
      </Section>
      <Section delay={240} style={styles.cardL1}>
        <Text style={styles.cardEyebrow}>BY SYMBOL</Text>
        <SymbolPerformanceBreakdown />
      </Section>
    </>
  );
}

function CalendarPane({ onDayPress }: { onDayPress: (d: Date) => void }) {
  return (
    <Section delay={0} style={styles.cardL1}>
      <Text style={styles.cardEyebrow}>TRADING DAYS</Text>
      <CalendarHeatmap onDayPress={onDayPress} />
    </Section>
  );
}

function DistributionPane({ navigation }: { navigation: any }) {
  return (
    <Section delay={0} style={styles.cardL1}>
      <Text style={styles.cardEyebrow}>P&amp;L DISTRIBUTION</Text>
      <PnLDistributionHistogram
        onStartSession={() => navigation.navigate('Chart')}
      />
    </Section>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 100,
  },
  sectionGap: { marginTop: 16 },

  // Segmented control — gold underline for the active tab to match
  // the secondary-nav language used elsewhere in the app.
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: borders.card,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabActive: {
    borderBottomColor: colors.gold,
  },
  tabLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: colors.textPrimary,
  },

  // Shared L1 card shell.
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
