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
import OnboardingChart from '../components/onboarding/OnboardingChart';
import {
  FIRST_TRADE_BARS,
  FIRST_TRADE_ENTRY_INDEX,
  FIRST_TRADE_MAX_REVEALED,
  FIRST_TRADE_POINT_VALUE,
  FIRST_TRADE_CONTRACTS,
  FIRST_TRADE_SYMBOL,
  FIRST_TRADE_DATE_LABEL,
} from '../data/firstTradeScenario';

/**
 * Onboarding screen 9 — Your First Trade (activation event).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md the highest-leverage
 * retention screen. A required, can't-fail first trade on a real-
 * looking historical chart. Both outcomes are framed positively
 * (FIRST STRIKE / FIRST BLOOD).
 *
 * Architecture (post-stabilization):
 *  - Chart data lives in `data/firstTradeScenario.ts` (hardcoded).
 *  - Render uses `components/onboarding/OnboardingChart` — a pure
 *    SVG renderer with no `sessionStore` / backend coupling. The
 *    main app's TradingChart is deliberately NOT used here; it's
 *    a WebView host wired to live session state and was the source
 *    of the earlier "Cannot read property 'c' of undefined" crash
 *    on this screen.
 *  - State tracks `revealedCount` (1-based count of visible bars)
 *    not `barIndex`. The chart clamps to `bars.length` so any
 *    runaway increment is a structural no-op instead of an OOB
 *    read.
 *
 * Four internal phases on a single screen:
 *   intro            → "Your first trade" overlay
 *   awaiting_trade   → chart + tooltip pointing at BUY/SELL
 *   awaiting_advance → chart + tooltip pointing at NEXT BAR (3 taps)
 *   result           → "FIRST STRIKE / FIRST BLOOD" + P&L
 *
 * Scenario shape: 30 chop bars + 3 trending-UP bars (+30 pts).
 *  BUY  → wins → FIRST STRIKE (+$600)
 *  SELL → loses → FIRST BLOOD (-$600)
 */

const BG    = '#000000';
const GOLD  = '#FFB800';
const GREEN = '#00D395';
const RED   = '#FF4757';

/** Initial revealed count: bars 0..ENTRY_BAR_IDX inclusive are visible
 *  before the user takes any action. `revealedCount` is a 1-based
 *  count, so the initial value is index + 1. */
const INITIAL_REVEALED = FIRST_TRADE_ENTRY_INDEX + 1; // 30

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

export default function OnboardingFirstTradeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setFirstTrade = useOnboardingStore((s) => s.setFirstTrade);

  const [phase, setPhase] = useState<Phase>('intro');
  const [revealedCount, setRevealedCount] = useState(INITIAL_REVEALED);
  const [tradeAction, setTradeAction] = useState<FirstTradeAction | null>(null);
  const [entryPrice, setEntryPrice] = useState<number | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeIn.setValue(0);
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [phase, fadeIn]);

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

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPhase('awaiting_trade');
  };

  const handleTrade = (action: FirstTradeAction) => {
    if (phase !== 'awaiting_trade') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const entry = FIRST_TRADE_BARS[FIRST_TRADE_ENTRY_INDEX].c;
    setEntryPrice(entry);
    setTradeAction(action);
    setPhase('awaiting_advance');
  };

  const handleNextBar = () => {
    if (phase !== 'awaiting_advance') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Clamp defensively — a stray 4th tap is a no-op, not a crash.
    const nextRevealed = Math.min(revealedCount + 1, FIRST_TRADE_MAX_REVEALED);
    if (nextRevealed === revealedCount) return;
    setRevealedCount(nextRevealed);

    if (nextRevealed >= FIRST_TRADE_MAX_REVEALED) {
      const exitIdx = nextRevealed - 1;
      const exit = FIRST_TRADE_BARS[exitIdx].c;
      const dir = tradeAction === 'buy' ? 1 : -1;
      const pnl = (exit - entryPrice!) * dir * FIRST_TRADE_POINT_VALUE * FIRST_TRADE_CONTRACTS;
      const badge: FirstTradeBadge =
        pnl > 0 ? 'first_strike' : pnl < 0 ? 'first_blood' : 'first_step';
      setFirstTrade({
        action: tradeAction!,
        entryPrice: entryPrice!,
        exitPrice: exit,
        pnl,
        badge,
      });
      setTimeout(() => setPhase('result'), 650);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingRankReveal');
  };

  if (phase === 'intro') {
    return <IntroOverlay onStart={handleStart} insets={insets} fadeIn={fadeIn} />;
  }

  if (phase === 'result') {
    return <ResultOverlay onContinue={handleContinue} insets={insets} />;
  }

  const advancesRemaining = FIRST_TRADE_MAX_REVEALED - revealedCount;
  const entryColor = tradeAction === 'sell' ? RED : GREEN;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerSymbol}>{FIRST_TRADE_SYMBOL}</Text>
        <Text style={styles.headerDate}>{FIRST_TRADE_DATE_LABEL}</Text>
      </View>

      <Animated.View style={[styles.chartArea, { opacity: fadeIn }]}>
        <OnboardingChart
          bars={FIRST_TRADE_BARS}
          revealedCount={revealedCount}
          entryPrice={entryPrice}
          entryColor={entryColor}
          height={320}
        />
        {entryPrice != null && tradeAction && (
          <View style={styles.entryBadge}>
            <Text style={[styles.entryBadgeText, { color: entryColor }]}>
              {tradeAction.toUpperCase()} @ {entryPrice.toLocaleString('en-US')}
            </Text>
          </View>
        )}
      </Animated.View>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

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
