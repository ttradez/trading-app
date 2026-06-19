import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';

/**
 * SelectCircle — shared selection control used by the Sessions
 * (Continue list) and Journal screens to provide a unified bulk-
 * delete UX. Always visible (no edit mode), tapping toggles the
 * row's selected state without triggering the row's primary action.
 *
 *  • Unselected: ~22px transparent circle, 1.5px white-30% ring.
 *  • Selected:   gold fill (`colors.gold`) with a centered white
 *                Ionicons checkmark (~14px).
 */
export interface SelectCircleProps {
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

export default function SelectCircle({
  selected,
  onPress,
  accessibilityLabel,
}: SelectCircleProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      <View
        style={[
          styles.circle,
          selected ? styles.circleSelected : styles.circleUnselected,
        ]}
      >
        {selected && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  wrapPressed: {
    opacity: 0.7,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  circleSelected: {
    backgroundColor: colors.gold,
  },
});
