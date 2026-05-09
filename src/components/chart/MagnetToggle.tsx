import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDrawingsStore, MagnetMode } from '../../store/drawingsStore';
import { colors, radius, spacing } from '../../theme';

/**
 * Tap to cycle: off → weak → strong → off …
 *  - off: gray icon
 *  - weak: gold icon
 *  - strong: gold filled background
 * Magnet causes drawing-tool taps to snap to the nearest candle's OHLC.
 */
export default function MagnetToggle() {
  const { magnet, setMagnet } = useDrawingsStore();
  const next: Record<MagnetMode, MagnetMode> = { off: 'weak', weak: 'strong', strong: 'off' };

  const tint = magnet === 'off' ? colors.textTertiary : colors.gold;
  const bg   = magnet === 'strong' ? colors.gold : 'transparent';

  return (
    <TouchableOpacity
      onPress={() => setMagnet(next[magnet])}
      style={[styles.btn, { backgroundColor: bg }]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons
        name="magnet-outline"
        size={16}
        color={magnet === 'strong' ? colors.bg : tint}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 32, height: 32,
    borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
});
