import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import RankBanner from '../components/RankBanner';

/**
 * Onboarding screen 10 — Rank progression reveal.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md the "where you're going"
 * moment. Cashes the identity check from screen 4: user picked an
 * identity, made a first trade on screen 9, now they SEE the journey.
 *
 * Staggered entrance: headline → Gambler (YOU) → progress bar fills
 * from 0% to 10% over 600ms → Paper Hands (UP NEXT) → Sniper /
 * Inside Trader / Market Maker dimmed → CTA. Total ~1.3 s.
 *
 * No new persistence — reads existing onboardingStore.firstTrade
 * (already populated on screen 9) implicitly via narrative; the
 * actual bar fill is hardcoded to 10% for v1.
 */

const BG    = '#000000';
const GOLD  = '#FFB800';
const TRACK = '#1F1F1F';

const PROGRESS_PCT = 10;        // hardcoded for v1
const BANNER_GAP   = 10;        // vertical gap between adjacent banners

interface Props {
  navigation: any;
}

export default function OnboardingRankRevealScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // Per-element opacity animated values. Each starts at 0; sequenced
  // delays below stagger the entrance.
  const headOp        = useRef(new Animated.Value(0)).current;
  const gamblerOp     = useRef(new Animated.Value(0)).current;
  const progressOp    = useRef(new Animated.Value(0)).current;
  const paperHandsOp  = useRef(new Animated.Value(0)).current;
  const sniperOp      = useRef(new Animated.Value(0)).current;
  const insideOp      = useRef(new Animated.Value(0)).current;
  const marketOp      = useRef(new Animated.Value(0)).current;
  const ctaOp         = useRef(new Animated.Value(0)).current;
  // Progress bar fill — animates 0→1, interpolated to width %.
  const fill          = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]);

    Animated.parallel([
      fadeIn(headOp,       0),
      fadeIn(gamblerOp,    200),
      fadeIn(progressOp,   400),
      // Progress bar fill — width animation needs the JS driver.
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(fill, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      fadeIn(paperHandsOp, 500),
      fadeIn(sniperOp,     600),
      fadeIn(insideOp,     700),
      fadeIn(marketOp,     800),
      fadeIn(ctaOp,        1000),
    ]).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingPlanSummary');
  };

  // Interpolate fill (0→1) into a width string. The cast satisfies
  // TS — RN accepts percentage strings on `width` at runtime.
  const fillWidth = fill.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${PROGRESS_PCT}%`],
  }) as unknown as number;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: headOp }}>
          <Text style={styles.headline}>Where you're going</Text>
          <Text style={styles.subheadline}>
            Your first trade just moved the needle. Most traders never climb out of Gambler. You're on your way.
          </Text>
        </Animated.View>

        <View style={styles.stack}>
          <Animated.View style={{ opacity: gamblerOp }}>
            <RankBanner rank="gambler" showYouIndicator />
          </Animated.View>

          <Animated.View style={[styles.progressBlock, { opacity: progressOp }]}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
            </View>
            <Text style={styles.progressLabel}>{PROGRESS_PCT}% toward Paper Hands</Text>
          </Animated.View>

          <Animated.View style={{ opacity: paperHandsOp }}>
            <RankBanner rank="paper_hands" upNext />
          </Animated.View>

          <Animated.View style={[styles.bannerGap, { opacity: sniperOp }]}>
            <RankBanner rank="sniper" locked />
          </Animated.View>

          <Animated.View style={[styles.bannerGap, { opacity: insideOp }]}>
            <RankBanner rank="inside_trader" locked />
          </Animated.View>

          <Animated.View style={[styles.bannerGap, { opacity: marketOp }]}>
            <RankBanner rank="market_maker" locked />
          </Animated.View>
        </View>
      </ScrollView>

      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 16), opacity: ctaOp },
        ]}
      >
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
  },

  headline: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,    // ~1.5×
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  stack: {
    marginTop: 28,
    gap: BANNER_GAP,
  },
  bannerGap: {
    // gap on `stack` handles the vertical rhythm; this wrapper just
    // gives Animated.View something to drive opacity against.
  },

  // Progress block sits between Gambler and Paper Hands.
  progressBlock: {
    paddingVertical: 4,
    alignItems: 'stretch',
  },
  progressTrack: {
    height: 5,
    backgroundColor: TRACK,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: GOLD,
    borderRadius: 4,
  },
  progressLabel: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: BG,
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
