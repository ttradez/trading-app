import React from 'react';
import {
  View, Text, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DashboardHeader from '../components/DashboardHeader';
import AccountPerformanceCard from '../components/AccountPerformanceCard';
import MetricsCard from '../components/MetricsCard';
import { colors, typography } from '../theme';

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

        {/* Placeholder — a follow-up adds equity curve, calendar
            heatmap, and per-setup breakdown here. */}
        <View style={[styles.sectionGap, styles.placeholderCard]}>
          <Text style={styles.placeholderEyebrow}>DETAILED INSIGHTS</Text>
          <Text style={[typography.body, styles.placeholderBody]}>
            Coming soon. Equity curve, calendar heatmap, and per-setup
            breakdown land here next.
          </Text>
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

  placeholderCard: {
    // Placeholder is a secondary surface — L1.
    backgroundColor: '#0A0A0A',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
  },
  placeholderEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  placeholderBody: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.65)',
  },
});
