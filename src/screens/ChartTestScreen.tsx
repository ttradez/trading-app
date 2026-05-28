import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart from '../components/charts/TradingViewChart';
import { colors } from '../theme';

/**
 * Phase 1 verification surface for the TradingView WebView host.
 *
 * Reachable only via deep-link / temporary navigation — not wired into
 * the bottom tab bar. Lets us iterate on the chart_host.html bundle
 * without touching the existing TradingScreen canvas implementation.
 */
export default function ChartTestScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.chartWrap}>
        <TradingViewChart symbol="NQ" interval="5" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 12, paddingVertical: 8 },
  chartWrap: { flex: 1 },
});
