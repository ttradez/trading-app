import React from 'react';
import {
  Pressable, Text, StyleSheet,
  StyleProp, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

/**
 * Locked button system (DESIGN_AUDIT §2.4). Three variants only —
 * if a call site doesn't fit, flag it rather than add a 4th.
 *
 *  - primary   — solid gold fill, black text, pill radius, 52pt.
 *                Pass `hero` for a subtle gold glow; reserved for
 *                the dominant CTA per screen (max ONE per viewport).
 *  - secondary — transparent fill, 1px border, white text. Same
 *                box as primary so the two read as siblings.
 *  - tertiary  — text-link with a trailing arrow. No fill, no
 *                border, no padding box. For "View all", "View
 *                trading insights →", "Learn & Practice →".
 *
 * Color tokens from `theme/colors` only — no inline brand values.
 * Type / spacing tokens stay external; this file owns the
 * button-specific box (height, radius, padding) so the three
 * variants stay structurally identical.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';

interface Props {
  label: string;
  variant?: ButtonVariant;
  /** On `primary` only: adds the gold glow shadow. */
  hero?: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const HEIGHT = 52;     // primary + secondary tap target (>= 44pt HIG)
const PADDING_X = 24;
const RADIUS = 999;    // pill

export default function Button({
  label,
  variant = 'primary',
  hero = false,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
  testID,
}: Props) {
  if (variant === 'tertiary') {
    // Text-link style — no padding box.
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={({ pressed }) => [
          styles.tertiary,
          pressed && !disabled && styles.pressedOpacity,
          disabled && styles.disabled,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        testID={testID}
      >
        <Text style={styles.tertiaryText}>{label}</Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.gold}
          style={styles.tertiaryArrow}
        />
      </Pressable>
    );
  }

  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.box,
        isPrimary ? styles.primary : styles.secondary,
        isPrimary && hero && styles.heroGlow,
        pressed && !disabled && styles.pressedOpacity,
        disabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text
        style={[
          styles.label,
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    height: HEIGHT,
    borderRadius: RADIUS,
    paddingHorizontal: PADDING_X,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary:   { backgroundColor: colors.gold },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Subtle gold halo — only when the caller opts in via `hero`.
  heroGlow: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primaryLabel:   { color: colors.textInverse },
  secondaryLabel: { color: colors.textPrimary },

  // Tertiary — inline link, no box.
  tertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tertiaryText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tertiaryArrow: { marginLeft: 2, marginTop: 1 },

  pressedOpacity: { opacity: 0.85 },
  disabled:       { opacity: 0.5 },
});
