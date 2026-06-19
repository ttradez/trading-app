import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Stagger-entrance hook for stat sections.
 *
 * Returns an `Animated.Value` (`opacity` 0→1) and an interpolated
 * `translateY` (12→0) that fade-and-slide a view in on mount.
 * `delay` lets the parent stagger multiple cards (e.g. 0, 80, 160).
 *
 * Width-/transform-driven so safe under the JS driver — keeps it
 * compatible with the rest of the stats screen's `useNativeDriver: false`
 * style of layout animation.
 */
export function useReveal(delay = 0, duration = 420) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  return {
    style: {
      opacity: progress,
      transform: [{ translateY }],
    },
  };
}
