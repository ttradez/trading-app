import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

/**
 * Onboarding screen 2 — The Premise.
 *
 * Visual spec (docs/ONBOARDING_RETENTION_RESEARCH.md §D2):
 * - Hero "95%" anchors the screen, ticks up from 0 over 1.2 s.
 * - Faint red candle silhouette at bottom-right (~8% opacity)
 *   suggests a losing trade falling out of frame — texture, not chart.
 * - Supporting headline + body fade in AFTER the number lands.
 *
 * All animation goes through built-in `Animated` — no new deps. The
 * counter timing uses `useNativeDriver: false` because we read its
 * value on the JS thread to update text content; the fades use the
 * native driver.
 */

const BG = '#000000';
const GOLD = '#FFB800';
const RED  = '#FF4757';

// Entrance timeline (ms) — staggered reveal.
const CANDLE_FADE_MS  = 300;
const COUNTER_DELAY   = 200;
const COUNTER_MS      = 1200;
const TEXT_DELAY      = 1500;
const TEXT_FADE_MS    = 350;
const COUNTER_TARGET  = 95;

interface Props {
  navigation: any;
}

function CandleSilhouette() {
  // Stylized single candle (wick + body + wick) — partially clipped
  // off-screen on the right, low-alpha red. ~150 px tall.
  return (
    <Svg width={150} height={170} viewBox="0 0 150 170">
      <Line   x1={75} y1={8}   x2={75} y2={48}  stroke={RED} strokeWidth={2} />
      <Rect   x={50} y={48}    width={50} height={84} fill={RED} />
      <Line   x1={75} y1={132} x2={75} y2={162} stroke={RED} strokeWidth={2} />
    </Svg>
  );
}

export default function OnboardingPremiseScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const bgOpacity   = useRef(new Animated.Value(0)).current;
  const counterVal  = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    // Bridge the counter's animated value to displayed text. The listener
    // runs on the JS thread, so the counter timing below cannot use the
    // native driver.
    const listenerId = counterVal.addListener(({ value }) => {
      setDisplayed(Math.round(value));
    });

    Animated.parallel([
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: CANDLE_FADE_MS,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(COUNTER_DELAY),
        Animated.timing(counterVal, {
          toValue: COUNTER_TARGET,
          duration: COUNTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // text-content updates require JS thread
        }),
      ]),
      Animated.sequence([
        Animated.delay(TEXT_DELAY),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: TEXT_FADE_MS,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => {
      counterVal.removeListener(listenerId);
    };
    // animated refs are stable; mount-once effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingArchetype');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Background candle — partially off-screen right, ~8% red. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.bgCandleWrap, { opacity: Animated.multiply(bgOpacity, 0.08) }]}
      >
        <CandleSilhouette />
      </Animated.View>

      {/* Foreground content */}
      <View style={styles.content}>
        <View style={styles.topSpacer} />

        {/* Hero number — "95%" with tick-up */}
        <View style={styles.heroRow}>
          <Text style={styles.heroNumber} allowFontScaling={false}>
            {displayed}
          </Text>
          <Text style={styles.heroPercent} allowFontScaling={false}>%</Text>
        </View>

        {/* Supporting headline */}
        <Animated.Text style={[styles.supporting, { opacity: textOpacity }]}>
          of new traders blow their account in their first year.
        </Animated.Text>

        {/* Body */}
        <Animated.View style={[styles.bodyBlock, { opacity: textOpacity }]}>
          <Text style={styles.body}>
            You're not weak for being nervous. You're smart.
          </Text>
          <View style={styles.bodyGap} />
          <Text style={styles.body}>
            Pocket Trade is where you fail 1,000 times — without losing a dollar.
          </Text>
        </Animated.View>
      </View>

      {/* CTA — unchanged from the previous build of this screen. */}
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="I'm in"
        >
          <Text style={styles.ctaText}>I'm in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Background candle, "falling out of frame" bottom-right.
  bgCandleWrap: {
    position: 'absolute',
    right: -30,
    bottom: 110,
  },

  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  // Push the hero toward the upper-third without depending on a
  // percentage height (which can jump on small devices).
  topSpacer: { height: 80 },

  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  heroNumber: {
    color: GOLD,
    fontSize: 150,
    fontWeight: '700',
    lineHeight: 160,
    letterSpacing: -4,
    fontVariant: ['tabular-nums'], // stable width while counting
    includeFontPadding: false as any,
  },
  heroPercent: {
    color: GOLD,
    fontSize: 80,
    fontWeight: '700',
    lineHeight: 110,
    marginLeft: 4,
    marginBottom: 16,
  },

  supporting: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.3,
    textAlign: 'center',
  },

  bodyBlock: { marginTop: 36 },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,    // ~1.5×
  },
  bodyGap: { height: 18 },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cta: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
