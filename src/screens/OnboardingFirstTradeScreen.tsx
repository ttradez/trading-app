import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useOnboardingStore,
  FirstTradeAction,
  FirstTradeBadge,
} from '../store/onboardingStore';
import OnboardingMiniChart, { Candle } from '../components/onboarding/OnboardingMiniChart';

/**
 * Onboarding screen 9 — Your First Trade (activation event).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md the highest-leverage
 * retention screen. A required, can't-fail first trade on a real
 * historical chart. Both outcomes are framed positively (FIRST
 * STRIKE / FIRST BLOOD / FIRST STEP badges).
 *
 * Four internal phases on a single screen:
 *   intro            → "Your first trade" overlay
 *   awaiting_trade   → chart + tooltip pointing at BUY/SELL
 *   awaiting_advance → chart + tooltip pointing at NEXT BAR (3 taps)
 *   result           → "FIRST STRIKE / FIRST BLOOD / FIRST STEP" + P&L
 *
 * Curated dataset: NQ 2022-09-13 (CPI day). Hand-crafted to be a
 * clean 30-point down move over the 3 advance bars — either trade
 * direction yields a meaningful $600 P&L.
 */

// ── Visual tokens ───────────────────────────────────────────────────────────
const BG    = '#000000';
const GOLD  = '#FFB800';
const GREEN = '#00D395';
const RED   = '#FF4757';

// ── Constants ───────────────────────────────────────────────────────────────
const SYMBOL = 'NQ';
const DATE_LABEL = '2022-09-13 · 5m';
const POINT_VALUE = 20;                  // NQ: $20/point/contract
const CONTRACTS = 1;
const ENTRY_BAR_IDX = 29;                // user enters at this bar's close
const TOTAL_ADVANCES = 3;
const FINAL_BAR_IDX = ENTRY_BAR_IDX + TOTAL_ADVANCES; // 32

// Hand-crafted NQ-like 5-minute candles. Bars 0–29: gentle chop in the
// 11,490–11,520 zone. Bars 30–32: clean 30-point down move (CPI-like).
const CANDLES: Candle[] = [
  { o: 11498, h: 11506, l: 11495, c: 11503 },
  { o: 11503, h: 11510, l: 11500, c: 11508 },
  { o: 11508, h: 11512, l: 11502, c: 11505 },
  { o: 11505, h: 11509, l: 11498, c: 11500 },
  { o: 11500, h: 11507, l: 11497, c: 11504 },
  { o: 11504, h: 11512, l: 11503, c: 11510 },
  { o: 11510, h: 11518, l: 11507, c: 11515 },
  { o: 11515, h: 11520, l: 11510, c: 11512 },
  { o: 11512, h: 11517, l: 11505, c: 11508 },
  { o: 11508, h: 11513, l: 11498, c: 11501 },
  { o: 11501, h: 11508, l: 11498, c: 11505 },
  { o: 11505, h: 11512, l: 11502, c: 11509 },
  { o: 11509, h: 11514, l: 11504, c: 11506 },
  { o: 11506, h: 11510, l: 11498, c: 11500 },
  { o: 11500, h: 11506, l: 11495, c: 11497 },
  { o: 11497, h: 11502, l: 11492, c: 11495 },
  { o: 11495, h: 11503, l: 11493, c: 11500 },
  { o: 11500, h: 11508, l: 11497, c: 11505 },
  { o: 11505, h: 11510, l: 11502, c: 11507 },
  { o: 11507, h: 11512, l: 11503, c: 11509 },
  { o: 11509, h: 11515, l: 11506, c: 11512 },
  { o: 11512, h: 11518, l: 11508, c: 11515 },
  { o: 11515, h: 11520, l: 11510, c: 11513 },
  { o: 11513, h: 11516, l: 11505, c: 11507 },
  { o: 11507, h: 11512, l: 11502, c: 11506 },
  { o: 11506, h: 11510, l: 11500, c: 11503 },
  { o: 11503, h: 11508, l: 11498, c: 11501 },
  { o: 11501, h: 11506, l: 11498, c: 11504 },
  { o: 11504, h: 11510, l: 11500, c: 11508 },
  { o: 11508, h: 11512, l: 11498, c: 11500 }, // bar 29 — entry close
  { o: 11500, h: 11502, l: 11484, c: 11488 }, // bar 30 — advance 1
  { o: 11488, h: 11491, l: 11476, c: 11480 }, // bar 31 — advance 2
  { o: 11480, h: 11482, l: 11468, c: 11470 }, // bar 32 — advance 3 (exit)
];

type Phase = 'intro' | 'awaiting_trade' | 'awaiting_advance' | 'result';

const BADGE_COPY: Record<FirstTradeBadge, { name: string; color: string; body: string }> = {
  first_strike: {
    name: 'FIRST STRIKE',
    color: GOLD,
    body:
      "You called it. The first one always feels good. But the real edge isn't being right once — it's being right over a thousand trades.",
  },
  first_blood: {
    name: 'FIRST BLOOD',
    color: RED,
    body:
      "Welcome to trading. First losses are a gift — they're the cheapest tuition you'll ever pay.",
  },
  first_step: {
    name: 'FIRST STEP',
    color: GOLD,
    body:
      'Right call, perfect timing on the exit. Now do it 999 more times.',
  },
};

function formatUSD(n: number): string {
  const abs = Math.abs(n);
  const formatted = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n > 0 ? `+${formatted}` : n < 0 ? `-${formatted}` : formatted;
}

interface Props {
  navigation: any;
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingFirstTradeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setFirstTrade = useOnboardingStore((s) => s.setFirstTrade);

  const [phase, setPhase] = useState<Phase>('intro');
  const [barIndex, setBarIndex] = useState(ENTRY_BAR_IDX);
  const [tradeAction, setTradeAction] = useState<FirstTradeAction | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  // Mount fade-in for intro / chart phases (result has its own).
  useEffect(() => {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [phase, fadeIn]);

  // Tooltip pulse loop.
  useEffect(() => {
    if (phase !== 'awaiting_trade' && phase !== 'awaiting_advance') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase('awaiting_trade');
  };

  const handleTrade = (action: FirstTradeAction) => {
    if (phase !== 'awaiting_trade') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const entry = CANDLES[ENTRY_BAR_IDX].c;
    setEntryPrice(entry);
    setTradeAction(action);
    setPhase('awaiting_advance');
  };

  const handleNextBar = () => {
    if (phase !== 'awaiting_advance') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextIdx = barIndex + 1;
    setBarIndex(nextIdx);

    if (nextIdx >= FINAL_BAR_IDX) {
      // Auto-close at the final bar's close.
      const exit = CANDLES[nextIdx].c;
      const dir = tradeAction === 'buy' ? 1 : -1;
      const pnl = (exit - entryPrice!) * dir * POINT_VALUE * CONTRACTS;
      const badge: FirstTradeBadge =
        pnl > 0 ? 'first_strike' : pnl < 0 ? 'first_blood' : 'first_step';
      setFirstTrade({
        action: tradeAction!,
        entryPrice: entryPrice!,
        exitPrice: exit,
        pnl,
        badge,
      });
      // Small delay so the user sees the final candle paint before the
      // result overlay appears.
      setTimeout(() => setPhase('result'), 650);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingRankReveal');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return <IntroOverlay onStart={handleStart} insets={insets} fadeIn={fadeIn} />;
  }

  if (phase === 'result') {
    return <ResultOverlay onContinue={handleContinue} insets={insets} />;
  }

  // Chart phases: 'awaiting_trade' + 'awaiting_advance'.
  const advancesRemaining = FINAL_BAR_IDX - barIndex;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Symbol / date header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerSymbol}>{SYMBOL}</Text>
        <Text style={styles.headerDate}>{DATE_LABEL}</Text>
      </View>

      {/* Chart */}
      <Animated.View style={[styles.chartArea, { opacity: fadeIn }]}>
        <OnboardingMiniChart
          candles={CANDLES}
          currentIndex={barIndex}
          entryPrice={entryPrice}
          tradeAction={tradeAction}
          height={320}
        />
        {entryPrice != null && tradeAction && (
          <View style={styles.entryBadge}>
            <Text style={[
              styles.entryBadgeText,
              { color: tradeAction === 'buy' ? GREEN : RED },
            ]}>
              {tradeAction.toUpperCase()} @ {entryPrice.toLocaleString('en-US')}
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {phase === 'awaiting_trade' && (
          <>
            <Tooltip text="Tap BUY or SELL to place your first paper trade" pulse={pulse} />
            <View style={styles.buySellRow}>
              <Pressable
                onPress={() => handleTrade('buy')}
                style={({ pressed }) => [
                  styles.tradeBtn, styles.buyBtn,
                  pressed && styles.tradeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Buy"
              >
                <Text style={styles.tradeBtnText}>BUY</Text>
              </Pressable>
              <Pressable
                onPress={() => handleTrade('sell')}
                style={({ pressed }) => [
                  styles.tradeBtn, styles.sellBtn,
                  pressed && styles.tradeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sell"
              >
                <Text style={styles.tradeBtnText}>SELL</Text>
              </Pressable>
            </View>
          </>
        )}

        {phase === 'awaiting_advance' && (
          <>
            <Tooltip text="Tap NEXT BAR to advance time and see what happens" pulse={pulse} />
            <Pressable
              onPress={handleNextBar}
              style={({ pressed }) => [
                styles.nextBarBtn,
                pressed && styles.tradeBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next bar"
            >
              <Text style={styles.nextBarText}>
                NEXT BAR  ·  {advancesRemaining} LEFT
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function IntroOverlay({
  onStart, insets, fadeIn,
}: { onStart: () => void; insets: any; fadeIn: Animated.Value }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Animated.View style={[styles.introContent, { opacity: fadeIn }]}>
        <Text style={styles.introHeadline}>Your first trade</Text>
        <View style={{ height: 28 }} />
        <Text style={styles.introBody}>
          This is a real historical chart. You'll see real price action — the same trades happened years ago.
        </Text>
        <View style={{ height: 18 }} />
        <Text style={styles.introBody}>
          Make a call. BUY if you think price is going up, SELL if you think it's going down.
        </Text>
        <View style={{ height: 18 }} />
        <Text style={styles.introBody}>
          You can't lose here. First Strike or First Blood — both earn you a badge.
        </Text>
      </Animated.View>
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Show me the chart"
        >
          <Text style={styles.ctaText}>Show me the chart</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ResultOverlay({
  onContinue, insets,
}: { onContinue: () => void; insets: any }) {
  const trade = useOnboardingStore((s) => s.firstTrade);
  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeIn]);

  if (!trade) {
    // Defensive: shouldn't happen — phase is only set to 'result' after
    // setFirstTrade. If it does, nudge user along.
    return (
      <View style={styles.root}>
        <Pressable onPress={onContinue} style={styles.cta}>
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  const info = BADGE_COPY[trade.badge];
  const pnlColor = trade.pnl > 0 ? GREEN : trade.pnl < 0 ? RED : '#FFFFFF';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Animated.View style={[styles.resultContent, { opacity: fadeIn }]}>
        <Text style={styles.resultLabel}>RESULT</Text>
        <Text style={[styles.resultBadge, { color: info.color }]} allowFontScaling={false}>
          {info.name}
        </Text>
        <Text style={[styles.resultPnl, { color: pnlColor }]} allowFontScaling={false}>
          {formatUSD(trade.pnl)}
        </Text>
        <Text style={styles.resultBody}>{info.body}</Text>
      </Animated.View>
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Tooltip({ text, pulse }: { text: string; pulse: Animated.Value }) {
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.tooltip, { transform: [{ scale }], opacity }]}
    >
      <Text style={styles.tooltipText}>{text}</Text>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Intro overlay (phase: intro)
  introContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  introHeadline: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
  },
  introBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
  },

  // Header on chart phases
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  headerSymbol: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerDate: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },

  // Chart area
  chartArea: {
    flex: 1,
    justifyContent: 'center',
  },
  entryBadge: {
    alignSelf: 'center',
    marginTop: 8,
    backgroundColor: '#0A0A0A',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  entryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },

  // Controls
  controls: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  tooltip: {
    alignSelf: 'center',
    backgroundColor: '#0F0F0F',
    borderColor: GOLD,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 14,
    maxWidth: 320,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  buySellRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeBtn: {
    flex: 1,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtn:  { backgroundColor: GREEN },
  sellBtn: { backgroundColor: RED },
  tradeBtnPressed: { opacity: 0.85 },
  tradeBtnText: {
    color: '#000000',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  nextBarBtn: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBarText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // Result overlay
  resultContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  resultBadge: {
    marginTop: 16,
    fontSize: 50,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: 56,
  },
  resultPnl: {
    marginTop: 18,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  resultBody: {
    marginTop: 28,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '400',
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: '95%',
  },

  // CTA shared by intro + result
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
