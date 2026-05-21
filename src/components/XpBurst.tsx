import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';

import NumericText from './NumericText';
import { colors } from '../theme';

/**
 * The visceral "+N XP" ding. Floating chip — no background, no
 * border, no padding box. Just gold text rising and fading out
 * over ~1000ms. Multiple instances stack independently; the
 * orchestrator caps concurrency at 5.
 *
 * Cycle:
 *   0–100ms   scale 0.85→1.0,  opacity 0→1
 *   100–700ms translateY 0→-24 (slow rise, ease-out)
 *   700–1000ms opacity 1→0,   translateY continues to -36
 *
 * Reanimated isn't a project dep — plain Animated.Sequence does
 * the job in a single useNativeDriver: true pass.
 */

const GOLD = colors.gold;

interface Props {
  amount: number;
  /** Delay before the animation begins — used by the orchestrator
   *  to stagger concurrent bursts ~150ms apart. */
  spawnDelayMs?: number;
  onComplete: () => void;
}

export default function XpBurst({ amount, spawnDelayMs = 0, onComplete }: Props) {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const ty      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.delay(spawnDelayMs),
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1, duration: 100, useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 100, useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
      ]),
      Animated.timing(ty, {
        toValue: -24, duration: 600, useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0, duration: 300, useNativeDriver: true,
        }),
        Animated.timing(ty, {
          toValue: -36, duration: 300, useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]),
    ]);
    seq.start(({ finished }) => {
      if (finished) onComplete();
    });
    return () => {
      seq.stop();
    };
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity, transform: [{ scale }, { translateY: ty }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.row}>
        <NumericText bold style={styles.amount} allowFontScaling={false}>
          +{amount}
        </NumericText>
        <Text style={styles.suffix} allowFontScaling={false}>XP</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  amount: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    marginLeft: 3,
    color: GOLD,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
