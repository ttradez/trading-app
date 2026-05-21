import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors, type as typo } from '../theme/tokens';

/**
 * BadgeTile — the one trophy-case tile for the whole app. Created
 * as part of the design-system foundation; not wired into screens
 * yet.
 *
 *  - unlocked: gold ring + gold-tint fill + gold icon + gold glow.
 *    `justUnlocked` adds a slow (20s) spinning gold sweep ring.
 *  - in-progress: SVG progress arc on a track ring, muted icon,
 *    percentage below.
 *  - locked: dashed gold-dim ring, Lock glyph, `categoryHint`
 *    instead of "???".
 *
 * `icon` is a MaterialCommunityIcons glyph name (matches the badge
 * catalogue's `icon` field) — lucide-react-native isn't installed.
 */

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  state: 'unlocked' | 'in-progress' | 'locked';
  icon?: MCIName;
  name?: string;
  /** Locked tiles show this ("Volume") instead of "???". */
  categoryHint?: string;
  /** 0–1, for the in-progress arc. */
  progress?: number;
  /** Triggers the rotating gold ring (caller decides the 48h window). */
  justUnlocked?: boolean;
  onPress?: () => void;
}

const CIRCLE = 64;
const STROKE = 3;
const R = (CIRCLE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function BadgeTile({
  state,
  icon,
  name,
  categoryHint,
  progress = 0,
  justUnlocked = false,
  onPress,
}: Props) {
  const clamped = Math.max(0, Math.min(1, progress));

  // Slow spinning sweep ring for a freshly-unlocked badge.
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (state !== 'unlocked' || !justUnlocked) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [state, justUnlocked, spin]);
  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const emblem = (
    <View style={styles.emblemWrap}>
      {/* Spinning gold sweep — only when just unlocked. */}
      {state === 'unlocked' && justUnlocked && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweepRing,
            { transform: [{ rotate: spinDeg }] },
          ]}
        />
      )}

      {state === 'in-progress' || state === 'locked' ? (
        <Svg width={CIRCLE} height={CIRCLE} style={StyleSheet.absoluteFill}>
          {state === 'in-progress' ? (
            <>
              <Circle
                cx={CIRCLE / 2}
                cy={CIRCLE / 2}
                r={R}
                stroke={colors.border}
                strokeWidth={STROKE}
                fill="none"
              />
              <Circle
                cx={CIRCLE / 2}
                cy={CIRCLE / 2}
                r={R}
                stroke={colors.gold}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${CIRC} ${CIRC}`}
                strokeDashoffset={CIRC * (1 - clamped)}
                strokeLinecap="round"
                transform={`rotate(-90 ${CIRCLE / 2} ${CIRCLE / 2})`}
              />
            </>
          ) : (
            <Circle
              cx={CIRCLE / 2}
              cy={CIRCLE / 2}
              r={R}
              stroke={colors.goldDim}
              strokeWidth={STROKE}
              strokeDasharray="4 4"
              fill="none"
            />
          )}
        </Svg>
      ) : null}

      <View
        style={[
          styles.inner,
          state === 'unlocked' && styles.innerUnlocked,
        ]}
      >
        {state === 'locked' ? (
          <Ionicons
            name="lock-closed"
            size={22}
            color={colors.textQuaternary}
          />
        ) : (
          <MaterialCommunityIcons
            name={icon ?? 'trophy-outline'}
            size={26}
            color={
              state === 'unlocked' ? colors.gold : colors.textSecondary
            }
          />
        )}
      </View>
    </View>
  );

  const content = (
    <View style={styles.tile}>
      {emblem}
      {state === 'locked' ? (
        // Locked tiles now show the real badge title (data was
        // already populated in `src/data/badges.ts`); the lock
        // glyph + dashed gold-dim ring + dimmer text color already
        // signal the locked state. Falls back to category hint
        // then "???" only if no name was passed.
        <Text style={styles.hint} numberOfLines={1}>
          {name ?? categoryHint ?? '???'}
        </Text>
      ) : (
        <Text
          style={[
            styles.name,
            state === 'unlocked' && { color: colors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {name ?? ''}
        </Text>
      )}
      {state === 'in-progress' && (
        <Text style={styles.pct}>{Math.round(clamped * 100)}%</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'locked'
            ? `${name ?? 'Badge'}, locked${categoryHint ? `, ${categoryHint}` : ''}`
            : `${name ?? 'Badge'}, ${state}`
        }
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    width: 96,
  },
  emblemWrap: {
    width: CIRCLE,
    height: CIRCLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The spinning sweep sits just outside the emblem; a half-gold
  // border on a rotating circle reads as a conic sweep.
  sweepRing: {
    position: 'absolute',
    width: CIRCLE + 8,
    height: CIRCLE + 8,
    borderRadius: (CIRCLE + 8) / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.gold,
    borderRightColor: colors.gold,
  },
  inner: {
    width: CIRCLE - 12,
    height: CIRCLE - 12,
    borderRadius: (CIRCLE - 12) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerUnlocked: {
    borderWidth: 2,
    borderColor: colors.gold,
    backgroundColor: colors.goldTint,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  name: {
    ...typo.caption,
    marginTop: 8,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  hint: {
    ...typo.caption,
    marginTop: 8,
    color: colors.textQuaternary,
    textAlign: 'center',
  },
  pct: {
    ...typo.micro,
    marginTop: 2,
    color: colors.gold,
  },
});
