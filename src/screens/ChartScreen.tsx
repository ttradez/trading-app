import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import TradingViewChart from '../components/charts/TradingViewChart';
import SymbolPickerSheet from '../components/SymbolPickerSheet';
import { colors } from '../theme';

/**
 * ChartScreen — the live Chart tab. Hosts the TradingView WebView
 * with a compact header bar showing the current symbol and a
 * Watchlist button that opens a bottom-sheet symbol picker.
 */
export default function ChartScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState('NQ');
  const [selectedInterval] = useState('5');
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.symbol}>{selectedSymbol}</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.watchlistBtn}
          accessibilityRole="button"
          accessibilityLabel="Open watchlist"
        >
          <Ionicons name="bookmarks-outline" size={20} color={colors.gold} />
          <Text style={styles.watchlistLabel}>Watchlist</Text>
        </Pressable>
      </View>

      <View style={styles.chartWrap}>
        <TradingViewChart symbol={selectedSymbol} interval={selectedInterval} />
      </View>

      <SymbolPickerSheet
        visible={pickerOpen}
        selectedSymbol={selectedSymbol}
        onSelect={(symbol) => {
          setSelectedSymbol(symbol);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  symbol: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  watchlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  watchlistLabel: {
    marginLeft: 6,
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
  },
  chartWrap: { flex: 1 },
});
