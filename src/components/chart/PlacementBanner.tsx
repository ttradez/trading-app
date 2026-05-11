import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';
import { useDrawingsStore } from '../../store/drawingsStore';

// Tools that have shipped their TradingView-parity v1 implementation and
// therefore opt into the placement banner. Other tools intentionally do
// not trigger this banner yet — they will be added as each ships its pass.
const BANNER_LABELS: Partial<Record<string, string>> = {
  trendline: 'PLACING TRENDLINE',
  hray:      'PLACING HORIZONTAL RAY',
};

/**
 * Top-of-chart banner shown while a v1-shipped drawing tool is active, so
 * the user can confirm they're in placement mode. Per
 * docs/TRADINGVIEW_REFERENCE.md §1–§2 + per-tool implementation prompts.
 */
export default function PlacementBanner() {
  const activeTool = useDrawingsStore((s) => s.activeTool);
  const label = BANNER_LABELS[activeTool];
  if (!label) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.text}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    backgroundColor: 'rgba(41, 98, 255, 0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  text: {
    color: colors.textPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.0,
  },
});
