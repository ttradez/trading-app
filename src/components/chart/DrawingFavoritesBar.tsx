import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors, radius } from '../../theme';
import { useDrawingsStore } from '../../store/drawingsStore';
import { TOOL_BY_ID, DrawingType } from '../../types/drawings';

/**
 * Per-tool icon component. Falls back to Ionicons when no custom icon is
 * registered for the tool. Custom icons exist because some tools have no
 * good Ionicons equivalent (e.g. horizontal_line — the closest generic
 * icon, 'remove-outline', is indistinguishable from a minus glyph).
 */
function ToolIcon({ id, size, color }: { id: DrawingType; size: number; color: string }) {
  if (id === 'horizontal_line') {
    // Horizontal line with an anchor dot at the left end (per
    // TRADINGVIEW_REFERENCE.md §2 implementation prompt — the
    // tool extends right-only from the anchor).
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Line x1={4} y1={12} x2={22} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={4} cy={12} r={2.5} fill={color} />
      </Svg>
    );
  }
  const def = TOOL_BY_ID[id];
  return <Ionicons name={def.icon as any} size={size} color={color} />;
}

/**
 * Floating favorites bar — shows the user's starred drawing tools as pills
 * along the top of the chart so they're one tap away. The full set of tools
 * still lives in the left toolbar; this is the quick-access version.
 *
 * - Reads `favorites` and `activeTool` from drawingsStore
 * - Tapping a pill activates that tool (same path as the toolbar button)
 * - Tapping the active tool again deactivates back to cursor mode
 * - Hidden when there are no favorites (avoids an empty floating chip)
 */
export default function DrawingFavoritesBar() {
  const favorites    = useDrawingsStore((s) => s.favorites);
  const activeTool   = useDrawingsStore((s) => s.activeTool);
  const setActiveTool = useDrawingsStore((s) => s.setActiveTool);

  // Build an ordered list (Set has no defined order). Filter out anything
  // not in the catalog defensively (storage could carry stale entries).
  const items = React.useMemo(() => {
    const ids: DrawingType[] = [];
    favorites.forEach((id) => { if (TOOL_BY_ID[id]) ids.push(id); });
    return ids;
  }, [favorites]);

  if (items.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((id) => {
          const def = TOOL_BY_ID[id];
          const isActive = activeTool === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.pill, isActive && styles.pillActive]}
              onPress={() => setActiveTool(isActive ? 'cursor_cross' : id)}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={def.label}
            >
              <ToolIcon
                id={id}
                size={18}
                color={isActive ? colors.bg : colors.textPrimary}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Float above the chart, centered horizontally, just below the OHLC overlay.
  // pointerEvents='box-none' so the bar accepts taps on the pills only and
  // empty space falls through to chart pan/zoom.
  wrap: {
    position: 'absolute',
    top: 56,         // sits below the OHLC two-line readout
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15,15,18,0.85)',
    borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 4, paddingVertical: 4,
    gap: 4,
  },
  pill: {
    width: 32, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm,
  },
  pillActive: {
    backgroundColor: colors.gold,
  },
});
