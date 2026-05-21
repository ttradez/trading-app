import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, LayoutChangeEvent, Animated, Easing,
} from 'react-native';

import NumericText from './NumericText';
import Button from './ui/Button';
import { useJournalStore } from '../store/journalStore';
import { getPnLDistribution } from '../lib/pnlDistribution';
import { colors } from '../theme';

/**
 * Bar histogram of trade P&L outcomes, symmetric around $0. Green
 * bars for positive bins, red for negative — "drawn not filled":
 * 70% fill plus a 1px solid top edge at 100% so the bar reads as
 * sketched, not as a solid block.
 *
 * Empty state (< 5 trades): hides the histogram and shows a
 * caption + tertiary "Start session" CTA inside the card.
 */

const WHITE = colors.textPrimary;

const MIN_TRADES   = 5;
const BARS_HEIGHT  = 110;
const BAR_GAP      = 2;
const ANIM_MS      = 600;
const STAGGER_MS   = 30;

const GAIN_FILL   = 'rgba(0, 211, 149, 0.70)';
const GAIN_STROKE = '#00D395';
const LOSS_FILL   = 'rgba(255, 71, 87, 0.70)';
const LOSS_STROKE = '#FF4757';

interface Props {
  onStartSession?: () => void;
}

export default function PnLDistributionHistogram({ onStartSession }: Props) {
  const trades = useJournalStore((s) => s.entries);

  const distribution = useMemo(
    () => getPnLDistribution(trades),
    [trades],
  );

  const enoughSample = trades.length >= MIN_TRADES;

  // ── Empty state (< 5 trades) ────────────────────────────────
  if (!enoughSample) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyCaption}>
          Place at least {MIN_TRADES} trades to see how your P&amp;L
          spreads out
        </Text>
        {onStartSession && (
          <Button
            label="Start session"
            variant="tertiary"
            onPress={onStartSession}
          />
        )}
      </View>
    );
  }

  return <Histogram distribution={distribution} />;
}

// ── Histogram body ─────────────────────────────────────────────────

function Histogram({
  distribution,
}: { distribution: ReturnType<typeof getPnLDistribution> }) {
  const { bins, totalTrades } = distribution;
  const tallest = useMemo(
    () => bins.reduce((m, b) => (b.count > m ? b.count : m), 0),
    [bins],
  );

  // Reserve width on layout so bars know how wide to draw.
  const [region, setRegion] = React.useState({ w: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setRegion({ w: e.nativeEvent.layout.width });

  // Per-bar grow animation, staggered left to right.
  const anims = useRef(bins.map(() => new Animated.Value(0))).current;
  // If the bin count changes (e.g. data set grows past a width
  // threshold), resize the anim array to match.
  if (anims.length !== bins.length) {
    anims.length = 0;
    bins.forEach(() => anims.push(new Animated.Value(0)));
  }
  useEffect(() => {
    Animated.stagger(
      STAGGER_MS,
      anims.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: ANIM_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // animating height
        }),
      ),
    ).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barWidth = region.w > 0
    ? Math.max(2, Math.floor((region.w - BAR_GAP * (bins.length - 1)) / bins.length))
    : 0;

  const leftLabel  = bins.length > 0 ? bins[0].rangeLow : 0;
  const rightLabel = bins.length > 0 ? bins[bins.length - 1].rangeHigh : 0;

  return (
    <View>
      <View style={styles.captionRow}>
        <View style={{ flex: 1 }} />
        <NumericText style={styles.tradeCount}>{totalTrades}</NumericText>
        <Text style={styles.tradeCountSuffix}>
          {' '}{totalTrades === 1 ? 'trade' : 'trades'}
        </Text>
      </View>

      <View style={styles.barsRegion} onLayout={onLayout}>
        {bins.map((b, i) => {
          const ratio = tallest > 0 ? b.count / tallest : 0;
          // Animated height = ratio × region × progress
          const height = anims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, ratio * BARS_HEIGHT],
          });
          const fill   = b.sign === 'loss' ? LOSS_FILL   : GAIN_FILL;
          const stroke = b.sign === 'loss' ? LOSS_STROKE : GAIN_STROKE;
          return (
            <View
              key={`${b.rangeLow}-${b.rangeHigh}`}
              style={{
                width: barWidth,
                marginLeft: i === 0 ? 0 : BAR_GAP,
                height: BARS_HEIGHT,
                justifyContent: 'flex-end',
              }}
            >
              {b.count > 0 && (
                <Animated.View
                  style={{
                    height,
                    backgroundColor: fill,
                    borderTopWidth: 1,
                    borderTopColor: stroke,
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.axisRow}>
        <NumericText style={styles.axisLabel}>
          {formatAxisLabel(leftLabel)}
        </NumericText>
        <NumericText style={styles.axisLabel}>$0</NumericText>
        <NumericText style={styles.axisLabel}>
          {formatAxisLabel(rightLabel)}
        </NumericText>
      </View>
    </View>
  );
}

function formatAxisLabel(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US')}`;
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  captionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  tradeCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tradeCountSuffix: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },

  barsRegion: {
    height: BARS_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  axisRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  emptyCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 280,
  },
});
