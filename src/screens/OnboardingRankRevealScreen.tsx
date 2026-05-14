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
 * Entrance sequence (per ONBOARDING_AUDIT.md upgrade) — cause-and-
 * effect choreography under ~2.5 s total:
 *
 *   a. Headline + subheadline fade in
 *   b. Gambler banner fades + scales in (settle pop)
 *   c. "← YOU" drops in from above with a spring overshoot — a
 *      weighted "thunk" — and a Medium haptic fires at first land
 *   d. Progress bar fills 0 % → 10 % only after YOU has landed
 *   e. "10 % toward Paper Hands" label fades in
 *   f. Paper Hands → Sniper → Inside Trader → Market Maker
 *      cascade in
 *   g. Continue button fades in last
 *
 * No new dependency — uses React Native's built-in `Animated` lib
 * (spring physics for the YOU drop, native-driven for everything
 * else, JS driver only for the progress fill since width can't run
 * on the native thread).
 */

const BG    = '#000000';
const GOLD  = '#FFB800';
const TRACK = '#1F1F1F';

const PROGRESS_PCT = 10;        // hardcoded for v1
const BANNER_GAP   = 10;        // vertical gap between adjacent banners

// ── Animation timing schedule (ms from mount) ─────────────────────
const T_HEAD          = 0;
const D_HEAD          = 280;
const T_GAMBLER       = 320;
const D_GAMBLER       = 280;
const T_YOU           = 640;     // ~80 ms beat after Gambler settles
const YOU_LAND_DELAY  = 150;     // empirical: first zero-crossing of the spring
const HAPTIC_AT       = T_YOU + YOU_LAND_DELAY;
const T_PROGRESS      = HAPTIC_AT; // fill starts the moment YOU lands
const D_PROGRESS_FILL = 500;
const T_PROG_LABEL    = T_PROGRESS + D_PROGRESS_FILL + 40;
const D_PROG_LABEL    = 220;
const T_PAPER         = T_PROG_LABEL + D_PROG_LABEL;
const D_RANK_CASCADE  = 220;
const RANK_STEP       = 100;
const T_SNIPER        = T_PAPER  + RANK_STEP;
const T_INSIDE        = T_SNIPER + RANK_STEP;
const T_MARKET        = T_INSIDE + RANK_STEP;
const T_CTA           = T_MARKET + D_RANK_CASCADE;
const D_CTA           = 240;
// total = T_CTA + D_CTA ≈ 2.45 s

// ── YOU-indicator spring config — tune for "weighted thunk", not
// "bouncy wobble". Low friction + moderate tension = sharp drop with
// one small overshoot, settles fast. ──
const YOU_SPRING = {
  tension: 120,
  friction: 7,
  useNativeDriver: true,
};
/** Pixels above its resting position the YOU label starts at. The
 *  spring drops it down to 0. */
const YOU_START_Y = -18;

interface Props {
  navigation: any;
}

export default function OnboardingRankRevealScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // Per-element animated values — every one of these starts off-screen
  // / invisible and the timeline below sequences them in.
  const headOp           = useRef(new Animated.Value(0)).current;
  const gamblerOp        = useRef(new Animated.Value(0)).current;
  const gamblerScale     = useRef(new Animated.Value(0.94)).current;
  const youOp            = useRef(new Animated.Value(0)).current;
  const youY             = useRef(new Animated.Value(YOU_START_Y)).current;
  const progressOp       = useRef(new Animated.Value(0)).current;
  const progressLabelOp  = useRef(new Animated.Value(0)).current;
  const paperHandsOp     = useRef(new Animated.Value(0)).current;
  const sniperOp         = useRef(new Animated.Value(0)).current;
  const insideOp         = useRef(new Animated.Value(0)).current;
  const marketOp         = useRef(new Animated.Value(0)).current;
  const ctaOp            = useRef(new Animated.Value(0)).current;
  // Progress bar fill — width interpolation, JS driver only.
  const fill             = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeAt = (val: Animated.Value, delay: number, duration: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, {
          toValue: 1,
          duration,
          useNativeDriver: true,
        }),
      ]);

    // Fire the "thunk" haptic at the perceived YOU-indicator landing
    // moment — the spring's first zero-crossing. Tracked separately
    // because Animated.spring callbacks fire at settle, not at impact.
    const hapticTimer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }, HAPTIC_AT);

    Animated.parallel([
      // a. Headline + subheadline
      fadeAt(headOp, T_HEAD, D_HEAD),

      // b. Gambler — fade + scale (slight pop-in, not a slam)
      Animated.sequence([
        Animated.delay(T_GAMBLER),
        Animated.parallel([
          Animated.timing(gamblerOp, {
            toValue: 1,
            duration: D_GAMBLER,
            useNativeDriver: true,
          }),
          Animated.timing(gamblerScale, {
            toValue: 1,
            duration: D_GAMBLER + 40,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // c. "← YOU" — quick fade-on, then spring DOWN with overshoot
      //    (the "thunk"). Haptic fires at HAPTIC_AT via the timer
      //    above, so the user feels the land at the same moment they
      //    see it.
      Animated.sequence([
        Animated.delay(T_YOU),
        Animated.parallel([
          Animated.timing(youOp, {
            toValue: 1,
            duration: 90,
            useNativeDriver: true,
          }),
          Animated.spring(youY, { toValue: 0, ...YOU_SPRING }),
        ]),
      ]),

      // d. Progress bar — fade the track in fast, then animate the
      //    fill width 0 → PROGRESS_PCT%. Width can't go on the native
      //    thread, so this is the only JS-driver animation.
      Animated.sequence([
        Animated.delay(T_PROGRESS),
        Animated.parallel([
          Animated.timing(progressOp, {
            toValue: 1,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(fill, {
            toValue: 1,
            duration: D_PROGRESS_FILL,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),
      ]),

      // e. "10% toward Paper Hands" label
      fadeAt(progressLabelOp, T_PROG_LABEL, D_PROG_LABEL),

      // f. Upper-rank cascade
      fadeAt(paperHandsOp, T_PAPER,  D_RANK_CASCADE),
      fadeAt(sniperOp,     T_SNIPER, D_RANK_CASCADE),
      fadeAt(insideOp,     T_INSIDE, D_RANK_CASCADE),
      fadeAt(marketOp,     T_MARKET, D_RANK_CASCADE),

      // g. CTA
      fadeAt(ctaOp, T_CTA, D_CTA),
    ]).start();

    return () => clearTimeout(hapticTimer);
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
          {/* Gambler row — banner + independently-animated "← YOU".
              Manually composed (rather than via RankBanner's built-in
              showYouIndicator prop) so the YOU label can spring in
              after the banner has settled. */}
          <Animated.View
            style={{
              opacity: gamblerOp,
              transform: [{ scale: gamblerScale }],
            }}
          >
            <View style={styles.gamblerRow}>
              <View style={styles.gamblerBannerWrap}>
                <RankBanner rank="gambler" />
              </View>
              <Animated.View
                style={{
                  opacity: youOp,
                  transform: [{ translateY: youY }],
                }}
              >
                <Text style={styles.youText}>← YOU</Text>
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View style={[styles.progressBlock, { opacity: progressOp }]}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
            </View>
            <Animated.Text style={[styles.progressLabel, { opacity: progressLabelOp }]}>
              {PROGRESS_PCT}% toward Paper Hands
            </Animated.Text>
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

  // Gambler row composes the banner + the YOU label as siblings so
  // each can be animated independently. Matches the visual produced
  // by RankBanner's built-in showYouIndicator path.
  gamblerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gamblerBannerWrap: {
    flex: 1,
  },
  youText: {
    marginLeft: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
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
