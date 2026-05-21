import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, LayoutChangeEvent,
} from 'react-native';

import Button from './ui/Button';
import NumericText from './NumericText';
import EquityCurveSparkline from './EquityCurveSparkline';
import { PRIMARY_ACTION_LABEL } from '../theme/copy';
import { useJournalStore } from '../store/journalStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { computeEquitySeries } from '../lib/equitySeries';
import { colors } from '../theme';

/**
 * Stats hero — equity, delta-since-start, equity-curve sparkline.
 * The line is always gold; the gain/loss signal lives in the
 * gradient fill underneath (CRAFT_RESEARCH chart pass).
 *
 * Empty state: equity displays as `startingBalance`, no delta row,
 * the sparkline renders its own dashed placeholder, and a Secondary
 * "Start session" CTA sits below the message.
 *
 * Count-up animation plays ONCE per app session via a module-level
 * Set — re-mounts inside the same session render the final value
 * directly so revisiting the tab doesn't replay the entrance.
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const CARD_R      = 16;
const CARD_PAD_X  = 20;
const SPARK_H     = 70;
const COUNTUP_MS  = 600;

/** Module-level guard — once a screen-keyed entrance has played in
 *  this app session, subsequent mounts skip the animation. */
const ANIMATED_THIS_SESSION = new Set<string>();
const ANIM_KEY = 'stats-account-equity';

interface Props {
  onPress?: () => void;
  onStartSession?: () => void;
}

export default function AccountPerformanceCard({ onPress, onStartSession }: Props) {
  const entries = useJournalStore((s) => s.entries);
  const startBalance = useOnboardingStore((s) => s.accountSize);

  const equitySeries = React.useMemo(
    () => computeEquitySeries(entries, startBalance),
    [entries, startBalance],
  );
  const hasTrades = equitySeries.length > 0;
  const equity = hasTrades
    ? equitySeries[equitySeries.length - 1].equity
    : startBalance;
  const realizedPnl = equity - startBalance;
  const pctChange = startBalance > 0 ? (realizedPnl / startBalance) * 100 : 0;

  // ── Equity count-up — first mount per session only ──────────
  const shouldAnimate = !ANIMATED_THIS_SESSION.has(ANIM_KEY);
  const count = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const [displayedEquity, setDisplayedEquity] = useState<number>(
    shouldAnimate ? 0 : equity,
  );

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedEquity(equity);
      return;
    }
    ANIMATED_THIS_SESSION.add(ANIM_KEY);
    count.setValue(0);
    const id = count.addListener(({ value }) => {
      setDisplayedEquity(value * equity);
    });
    Animated.timing(count, {
      toValue: 1,
      duration: COUNTUP_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => count.removeListener(id);
    // mount-once; later equity changes update via separate effect
    // below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After the entrance animation has played (or been skipped),
  // keep the displayed value in lockstep with the live equity so
  // a new trade close updates the hero number immediately.
  useEffect(() => {
    if (!shouldAnimate) setDisplayedEquity(equity);
  }, [equity, shouldAnimate]);

  // ── Card width for the sparkline ────────────────────────────
  const [cardWidth, setCardWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== cardWidth) setCardWidth(w);
  };
  const chartWidth = Math.max(0, cardWidth - CARD_PAD_X * 2);

  // ── Delta row colors / signs ────────────────────────────────
  const deltaColor = realizedPnl > 0 ? GREEN : realizedPnl < 0 ? RED : WHITE;
  const deltaSign  = realizedPnl > 0 ? '+' : realizedPnl < 0 ? '-' : '';
  const pctSign    = pctChange > 0 ? '+' : pctChange < 0 ? '-' : '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress && { opacity: 0.92 },
      ]}
      onLayout={onLayout}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        hasTrades
          ? `Account equity ${formatMoney(equity)}, ${pctSign}${Math.abs(pctChange).toFixed(2)}% since you started`
          : `Account equity ${formatMoney(startBalance)}, no trades yet`
      }
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <NumericText bold style={styles.equity} allowFontScaling={false} numberOfLines={1}>
          {formatMoney(displayedEquity)}
        </NumericText>

        {hasTrades && (
          <View style={styles.deltaRow}>
            <NumericText bold style={[styles.deltaMoney, { color: deltaColor }]} allowFontScaling={false}>
              {deltaSign}${formatAbs(Math.abs(realizedPnl))}
            </NumericText>
            <Text style={styles.deltaDot}>·</Text>
            <NumericText bold style={[styles.deltaPct, { color: deltaColor }]} allowFontScaling={false}>
              {pctSign}{Math.abs(pctChange).toFixed(2)}%
            </NumericText>
            <Text style={styles.deltaSuffix}>· since you started</Text>
          </View>
        )}

        {!hasTrades && (
          <Text style={styles.emptyBody}>
            Place your first trade to start tracking your performance.
          </Text>
        )}
      </View>

      {/* Sparkline — chart palette tokens, gold stroke, direction
          fill, baseline at startingBalance. Renders a dashed
          placeholder itself when data is empty. */}
      <View style={styles.chartWrap}>
        <EquityCurveSparkline
          data={equitySeries}
          startingBalance={startBalance}
          width={chartWidth}
          height={SPARK_H}
          animateOnMount={shouldAnimate}
        />
      </View>

      {!hasTrades && onStartSession && (
        <View style={styles.emptyCtaWrap}>
          <Button
            label={PRIMARY_ACTION_LABEL}
            variant="secondary"
            onPress={onStartSession}
          />
        </View>
      )}
    </Pressable>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function formatMoney(n: number): string {
  // No decimals — equity displays as whole dollars.
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}
function formatAbs(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: CARD_R,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: CARD_PAD_X,
    paddingTop: 18,
    paddingBottom: 8,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  // Hero number — one-off 44pt exception above the locked 6-step
  // scale. Equity is the screen's headline and deserves its own
  // visual weight (§3.1).
  equity: {
    marginTop: 8,
    color: WHITE,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.0,
    fontVariant: ['tabular-nums'],
  },
  deltaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  deltaMoney: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaDot: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 16,
    fontWeight: '700',
  },
  deltaPct: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaSuffix: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    fontWeight: '500',
  },
  chartWrap: {
    paddingHorizontal: CARD_PAD_X,
    paddingTop: 10,
    paddingBottom: 10,
  },
  emptyBody: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 320,
  },
  emptyCtaWrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: CARD_PAD_X,
    paddingBottom: 16,
  },
});
