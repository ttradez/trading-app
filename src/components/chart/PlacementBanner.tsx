import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';
import { useDrawingsStore } from '../../store/drawingsStore';

/**
 * Top-of-chart banner shown only while the trendline tool is active so the
 * user can confirm they're in placement mode. Per docs/TRADINGVIEW_REFERENCE.md
 * §1 + the v1 implementation prompt — trendline-only for this round; other
 * tools intentionally do not trigger this banner yet.
 */
export default function PlacementBanner() {
  const activeTool = useDrawingsStore((s) => s.activeTool);
  if (activeTool !== 'trendline') return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.text}>PLACING TRENDLINE</Text>
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
