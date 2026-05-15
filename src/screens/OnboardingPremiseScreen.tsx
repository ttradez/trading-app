import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, StatusBar,
  useWindowDimensions,
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

// Subtle 6-candle bearish row — sits along the very bottom of the
// screen behind the CTA. Heights stagger downward (with a small
// retrace) so it reads as a sequence of bearish bars, not a chart.
function BearishCandleRow({ width }: { width: number }) {
  const HEIGHTS = [44, 38, 32, 36, 26, 20]; // mild downtrend + one retrace
  const ROW_H   = 60;
  const BODY_W  = 18;
  const WICK_TOP = 6;
  const WICK_BOT = 4;
  const slotW = width / HEIGHTS.length;
  return (
    <Svg width={width} height={ROW_H}>
      {HEIGHTS.map((h, i) => {
        const cx       = i * slotW + slotW / 2;
        const bodyTop  = ROW_H - h;
        const bodyH    = Math.max(h - (WICK_TOP + WICK_BOT), 4);
        return (
          <React.Fragment key={i}>
            {/* upper wick */}
            <Line x1={cx} y1={bodyTop - WICK_TOP} x2={cx} y2={bodyTop}
                  stroke={RED} strokeWidth={1.5} />
            {/* body */}
            <Rect x={cx - BODY_W / 2} y={bodyTop} width={BODY_W} height={bodyH}
                  fill={RED} />
            {/* lower wick */}
            <Line x1={cx} y1={bodyTop + bodyH} x2={cx} y2={bodyTop + bodyH + WICK_BOT}
                  stroke={RED} strokeWidth={1.5} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export default function OnboardingPremiseScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

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

      {/* Background bearish candle row — sits along the bottom of the
          screen behind the CTA, ~7% red. zIndex 0 keeps it under the
          opaque gold button (CTA wrap has zIndex 2). */}
      <Animated.View
        pointerEvents="none"
        style={[styles.candleRow, { opacity: Animated.multiply(bgOpacity, 0.07) }]}
      >
        <BearishCandleRow width={screenW} />
      </Animated.View>

      {/* Foreground content — vertically centered between top edge and CTA. */}
      <View style={styles.content}>
        {/* Hero number — "95%" with tick-up */}
        <View style={styles.heroRow}>
          <Text style={styles.heroNumber} allowFontScaling={false}>
            {displayed}
          </Text>
          <Text style={styles.heroPercent} allowFontScaling={false}>%</Text>
        </View>

        {/* Supporting headline */}
        <Animated.Text style={[styles.supporting, { opacity: textOpacity }]}>
          of new traders blow their account in their first 90 days.
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

        {/* Trust line — pre-empts the "is this a real brokerage?"
            objection from finance-wary users without slowing the
            pitch above. Shares the body's fade-in. */}
        <Animated.Text style={[styles.trustLine, { opacity: textOpacity }]}>
          Pocket Trade is a simulator. No real money. No accounts. No funny business.
        </Animated.Text>
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

  // Subtle bearish candle row pinned to the very bottom edge, full
  // width. Sits behind the CTA via z-index — the opaque gold button
  // hides the section directly beneath it; wick tips visible above /
  // beside the button.
  candleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
    elevation: 0,
  },

  content: {
    flex: 1,
    paddingHorizontal: 32,
    // Vertically center hero + supporting + body in the space above
    // the CTA (which lives outside this flex container).
    justifyContent: 'center',
    zIndex: 1,
  },

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

  // Fine-print-weight reassurance line that the app is a sim, not a
  // brokerage. Lighter than the body so it reads as a footnote, not
  // another headline.
  trustLine: {
    marginTop: 24,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    // Keep the gold button above the absolutely-positioned candle row.
    zIndex: 2,
    elevation: 2,
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
