import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Count-up animation hook for stat numbers.
 *
 * Drives a JS-side rAF loop via `Animated.Value` + a listener so the
 * caller can render the *current* interpolated value as plain text
 * (RN's `<Animated.Text>` only animates style props, not text content).
 *
 * Usage:
 *   const display = useAnimatedNumber(2847.50);
 *   <Text>{display.toFixed(2)}</Text>
 *
 * On `target` change, animates from the previous displayed value to
 * the new target over `duration` ms. Initial render starts at 0 →
 * target so a fresh screen plays the count-up on first paint.
 */
export function useAnimatedNumber(
  target: number,
  duration = 900,
): number {
  const animated = useRef(new Animated.Value(0)).current;
  const lastTarget = useRef(target);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = animated.addListener(({ value }) => setDisplay(value));
    return () => animated.removeListener(id);
  }, [animated]);

  useEffect(() => {
    Animated.timing(animated, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    lastTarget.current = target;
  }, [target, duration, animated]);

  return display;
}
