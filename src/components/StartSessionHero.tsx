import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Line, Polygon } from 'react-native-svg';

/**
 * StartSessionHero — the "what to do right now" primary action at
 * the top of the Home screen. Tapping anywhere routes into the
 * existing Chart tab, which lands the user on SessionsScreen with
 * its Continue list + "New Session" CTA. No new session machinery —
 * this is just the hero entry point for the existing flow.
 */

const GOLD       = '#FFB800';
const GREEN      = '#00D395';
const RED        = '#FF4757';
const WHITE      = '#FFFFFF';
const CARD_BG    = '#0E0E0E';

const CARD_HEIGHT = 220;
const PLAY_SIZE   = 80;
const HALO_SIZE   = 122;

const CANDLE_COUNT = 22;
const CANDLE_SLOT  = 18;          // viewBox px per candle column
const VB_WIDTH     = CANDLE_COUNT * CANDLE_SLOT;
const VB_HEIGHT    = CARD_HEIGHT;

// Deterministic pseudo-random so the candle field is stable across
// renders (avoids a flicker of new candles every re-render) but still
// looks varied. Math.sin trick — same approach used in shader land.
function seeded(i: number): number {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

const CANDLES = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  const r1 = seeded(i * 2 + 1);
  const r2 = seeded(i * 2 + 2);
  const bodyHeight = 18 + Math.floor(r1 * 56);                 // 18-74
  const yCenter    = 0.40 + (r2 - 0.5) * 0.28;                 // 0.26-0.54
  const wickExtra  = 6 + Math.floor(r1 * 16);                  // 6-22
  const isGreen    = r1 > 0.48;
  return { idx: i, bodyHeight, yCenter, wickExtra, isGreen };
});

interface Props {
  streakDays: number;
  onPress: () => void;
}

export default function StartSessionHero({ streakDays, onPress }: Props) {
  // ── Pulsing halo behind the play button. Animated.loop on a single
  // Animated.Value driving opacity + scale via interpolation; smooth
  // because both target props are useNativeDriver-eligible. ──
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloOpacity = pulse.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.55, 0],
  });
  const haloScale = pulse.interpolate({
    inputRange:  [0, 1],
    outputRange: [1, 1.35],
  });

  const streakText = streakDays > 0
    ? `${streakDays} day streak`
    : 'Start your streak';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Start a new replay session"
      style={({ pressed }) => [
        styles.cardWrap,
        pressed && styles.cardWrapPressed,
      ]}
    >
      <View style={styles.card}>
        {/* ── Candlestick + grid backdrop ── */}
        <View style={styles.bgWrap} pointerEvents="none">
          <Svg
            width="100%"
            height={CARD_HEIGHT}
            viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
            preserveAspectRatio="none"
          >
            {/* Faint horizontal grid */}
            {[0.30, 0.50, 0.70].map((y, i) => (
              <Line
                key={`grid-${i}`}
                x1={0}
                x2={VB_WIDTH}
                y1={VB_HEIGHT * y}
                y2={VB_HEIGHT * y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={1}
              />
            ))}
            {/* Candles */}
            {CANDLES.map((c) => {
              const x       = c.idx * CANDLE_SLOT + CANDLE_SLOT / 2;
              const yMid    = c.yCenter * VB_HEIGHT;
              const bodyTop = yMid - c.bodyHeight / 2;
              const wickTop = bodyTop - c.wickExtra;
              const wickBot = bodyTop + c.bodyHeight + c.wickExtra;
              const color   = c.isGreen ? GREEN : RED;
              return (
                <React.Fragment key={c.idx}>
                  <Line
                    x1={x} y1={wickTop}
                    x2={x} y2={wickBot}
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={0.20}
                  />
                  <Rect
                    x={x - 3.5}
                    y={bodyTop}
                    width={7}
                    height={c.bodyHeight}
                    fill={color}
                    opacity={0.24}
                  />
                </React.Fragment>
              );
            })}
          </Svg>
        </View>

        {/* ── Dark scrim so the play button + label pop ── */}
        <View style={styles.scrim} pointerEvents="none" />

        {/* ── Centered content ── */}
        <View style={styles.content}>
          <View style={styles.playWrap}>
            {/* Pulsing gold halo */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.halo,
                {
                  opacity: haloOpacity,
                  transform: [{ scale: haloScale }],
                },
              ]}
            />
            {/* Gold play button */}
            <View style={styles.playBtn}>
              <Svg width={32} height={32} viewBox="0 0 32 32">
                <Polygon points="11,7 11,25 25,16" fill="#000000" />
              </Svg>
            </View>
          </View>

          <Text style={styles.label}>Start Session</Text>

          <View style={styles.streakRow}>
            <Ionicons
              name="flame"
              size={13}
              color={GOLD}
              style={styles.streakIcon}
            />
            <Text style={styles.streakText}>{streakText}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
  },
  cardWrapPressed: {
    opacity: 0.92,
  },
  card: {
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.40)',
    // Soft gold glow around the card
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.40)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playWrap: {
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: GOLD,
  },
  playBtn: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  label: {
    marginTop: 12,
    color: WHITE,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streakRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    marginRight: 4,
  },
  streakText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
