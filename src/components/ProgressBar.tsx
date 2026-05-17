import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, StyleSheet, LayoutChangeEvent,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, motion } from '../theme/tokens';

/**
 * ProgressBar — the one progress bar for the whole app. Created as
 * part of the design-system foundation; not wired into screens yet.
 *
 *  - Track in `colors.border`, fully rounded.
 *  - Fill is a horizontal LinearGradient (variant → its bright
 *    sibling) with a 1px white "LED edge" highlight on top.
 *  - Width animates with a spring (feels iOS-native, not linear).
 *  - `glow` adds an outer shadow tinted to the variant.
 *  - `animated` sweeps a 40px white shimmer across the fill.
 */

export type ProgressSize = 'sm' | 'md' | 'lg';
export type ProgressVariant = 'gold' | 'green' | 'red';

interface Props {
  /** 0–1 (clamped). */
  progress: number;
  size?: ProgressSize;
  variant?: ProgressVariant;
  glow?: boolean;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ProgressSize, number> = { sm: 3, md: 4, lg: 6 };

const GRADIENT: Record<ProgressVariant, [string, string]> = {
  gold:  [colors.gold, colors.goldBright],
  green: [colors.pnlGreen, '#33E0B0'],
  red:   [colors.pnlRed, '#FF7A88'],
};

const GLOW_COLOR: Record<ProgressVariant, string> = {
  gold:  colors.gold,
  green: colors.pnlGreen,
  red:   colors.pnlRed,
};

const SHIMMER_W = 40;

export default function ProgressBar({
  progress,
  size = 'md',
  variant = 'gold',
  glow = false,
  animated = false,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const h = HEIGHT[size];

  const widthAnim = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: clamped,
      useNativeDriver: false, // width % is not native-drivable
      speed: 12,
      bounciness: 6,
    }).start();
  }, [clamped, widthAnim]);

  const widthInterp = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Shimmer sweep — needs the measured track width to know how far
  // to travel.
  const [trackW, setTrackW] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animated || trackW <= 0) return;
    shimmer.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: motion.shimmer.duration,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, trackW, shimmer]);

  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_W, trackW + SHIMMER_W],
  });

  const onLayout = (e: LayoutChangeEvent) =>
    setTrackW(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.track,
        { height: h, borderRadius: h / 2 },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            height: h,
            borderRadius: h / 2,
            width: widthInterp,
          },
          glow && {
            shadowColor: GLOW_COLOR[variant],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.7,
            shadowRadius: 4,
          },
        ]}
      >
        <LinearGradient
          colors={GRADIENT[variant]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        {/* 1px LED-edge highlight on the fill. */}
        <View style={styles.ledEdge} />
        {animated && trackW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: shimmerX }] },
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(255,255,255,0)',
                'rgba(255,255,255,0.35)',
                'rgba(255,255,255,0)',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: SHIMMER_W, height: '100%' }}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    overflow: 'hidden',
  },
  ledEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
