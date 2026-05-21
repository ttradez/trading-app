import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme';

/**
 * Locked filter-chip shape (DESIGN_AUDIT §2.4). Rounded pill,
 * consistent height + padding + radius across every filter row in
 * the app (Journal ALL/WINS/LOSSES, Setup Library All/Momentum/…,
 * etc.). Don't ship a competing chip — extend this if a new state
 * is genuinely needed.
 *
 *  - selected   → solid gold fill, black text.
 *  - unselected → transparent fill, 1px `colors.border` outline,
 *                 white@60% text.
 */

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Optional trailing count, rendered as " (N)" after the label. */
  count?: number;
  accessibilityLabel?: string;
}

const HEIGHT = 36;
const PADDING_X = 16;
const RADIUS = 999;

export default function FilterChip({
  label, selected, onPress, count, accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && !selected && styles.pressedOpacity,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text
        style={[
          styles.label,
          selected ? styles.labelSelected : styles.labelUnselected,
        ]}
        numberOfLines={1}
      >
        {label}
        {typeof count === 'number' ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: HEIGHT,
    paddingHorizontal: PADDING_X,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  selected: {
    backgroundColor: colors.gold,
  },
  unselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  labelSelected:   { color: colors.textInverse },
  labelUnselected: { color: 'rgba(255,255,255,0.6)' },

  pressedOpacity: { opacity: 0.7 },
});
