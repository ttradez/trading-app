import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardHeader from '../components/DashboardHeader';
import AccountPerformanceCard from '../components/AccountPerformanceCard';
import MetricsCard from '../components/MetricsCard';
import CalendarHeatmap from '../components/CalendarHeatmap';
import SetupPerformanceBreakdown from '../components/SetupPerformanceBreakdown';
import { colors, borders, surface } from '../theme';

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
          <CalendarHeatmap />
        </View>

        {/* Per-setup performance — gold-bar magnitude + colored P&L
            number. Sort by net P&L descending. */}
        <View style={[styles.sectionGap, styles.cardL1]}>
          <Text style={styles.cardEyebrow}>BY SETUP</Text>
          <SetupPerformanceBreakdown
            // We're already inside the MainTabs navigator — jump
            // sideways to the Learn tab directly.
            onBrowseLibrary={() => navigation.navigate('Learn')}
          />
        </View>
      </ScrollView>
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
