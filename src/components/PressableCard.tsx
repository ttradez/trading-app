import React, { useRef } from 'react';
import {
  Animated, Pressable, StyleProp, ViewStyle, Easing,
} from 'react-native';

import { surface } from '../theme';

/**
 * Tappable-card wrapper for the Home polish pass. Every press
 * gets visible feedback: scale 1.0 → 0.97 and a subtle background
 * lift to surface.l3 over 100ms in, 150ms out (ease-out both
 * directions).
 *
 * Caller passes:
 *   onPress     — the tap handler
 *   baseBg      — the card's resting background colour
 *   pressedBg   — optional override (defaults to surface.l3)
 *   style       — caller's style applied OVER the wrapper's
 *                 animated transform + bg
 *
 * Cards already at L3 can pass baseBg=L3 and pressedBg=L3 — the
 * scale alone provides the press signal in that case.
 */

const PRESS_IN_MS  = 100;
const PRESS_OUT_MS = 150;
const PRESS_SCALE  = 0.97;

interface Props {
  onPress?: () => void;
  baseBg: string;
  pressedBg?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
  disabled?: boolean;
  hitSlop?: number;
  children?: React.ReactNode;
}

export default function PressableCard({
  onPress,
  baseBg,
  pressedBg = surface.l3,
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
  hitSlop,
  children,
}: Props) {
  // Scale uses the native driver; backgroundColor interpolation
  // must run JS-driven. We start one Animated.timing per axis in
  // parallel.
  const scale = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current; // 0 → 1

  const animate = (toValue: 0 | 1) => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: toValue === 1 ? PRESS_SCALE : 1,
        duration: toValue === 1 ? PRESS_IN_MS : PRESS_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(press, {
        toValue,
        duration: toValue === 1 ? PRESS_IN_MS : PRESS_OUT_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const backgroundColor = press.interpolate({
    inputRange: [0, 1],
    outputRange: [baseBg, pressedBg],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          { transform: [{ scale }], backgroundColor },
          style,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
