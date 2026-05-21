import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing, LayoutChangeEvent,
} from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Path,
} from 'react-native-svg';

import Button from './ui/Button';
import { PRIMARY_ACTION_LABEL } from '../theme/copy';
import { useJournalStore } from '../store/journalStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { buildEquityCurve, totalPnl } from '../lib/tradeMetrics';
import { colors } from '../theme';

/**
 * Dashboard hero (DESIGN_AUDIT §3.1). Account equity in a huge
 * tabular-figures display, delta row beneath, full-bleed sparkline
 * with a vertical gradient fill that bleeds to the card radius.
 *
 * On mount: equity counts up from $0 → current over ~600 ms, and
 * the sparkline draws left-to-right via strokeDashoffset over
 * ~800 ms. Empty state (0 trades): no sparkline, no count-up;
 * dotted placeholder + Secondary "Start session" CTA.
 *
 * P&L color: green positive, red negative, white zero. NEVER gold
 * — gold is reward currency, not P&L (§2.2).
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';

const COUNTUP_MS  = 600;
const SPARK_MS    = 800;
const SPARK_H     = 70;
const CARD_R      = 16;

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  onPress?: () => void;
  onStartSession?: () => void;
}

export default function AccountPerformanceCard({ onPress, onStartSession }: Props) {
  const entries = useJournalStore((s) => s.entries);
  const startBalance = useOnboardingStore((s) => s.accountSize);

  const realizedPnl = useMemo(() => totalPnl(entries), [entries]);
  const equity      = startBalance + realizedPnl;
  const pctChange   = startBalance > 0 ? (realizedPnl / startBalance) * 100 : 0;

  const hasTrades = entries.length > 0;

  // ── Mount animations ──────────────────────────────────────────
  const count = useRef(new Animated.Value(0)).current;
  const [displayedEquity, setDisplayedEquity] = useState<number>(hasTrades ? 0 : equity);

  useEffect(() => {
    if (!hasTrades) {
      setDisplayedEquity(equity);
      return;
    }
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
  }, [equity, hasTrades, count]);

  // ── Sparkline geometry ────────────────────────────────────────
  const [cardWidth, setCardWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== cardWidth) setCardWidth(w);
  };

  const sparkline = useMemo(() => {
    if (!hasTrades || cardWidth <= 0) return null;
    const series = buildEquityCurve(entries, startBalance);
    if (series.length < 2) return null;
    const ys = series.map((p) => p.equity);
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const span = max - min || 1;
    const w = cardWidth;
    const h = SPARK_H;
    // Inset stroke 2px so a peak at min/max isn't clipped.
    const PAD = 4;
    const points = series.map((p, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - PAD - ((p.equity - min) / span) * (h - PAD * 2);
      return { x, y };
    });
    const pathD = points.reduce(
      (acc, pt, i) => acc + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`),
      '',
    );
    // Area path = line path + close down the right edge + along the
    // bottom + back up to start, for the gradient fill below the line.
    const areaD =
      pathD +
      ` L ${points[points.length - 1].x} ${h}` +
      ` L ${points[0].x} ${h} Z`;
    // Approximate path length so strokeDashoffset can animate cleanly.
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y,
      );
    }
    return { pathD, areaD, len, w, h };
  }, [entries, startBalance, hasTrades, cardWidth]);

  const dashOffset = useRef(new Animated.Value(1)).current; // 1 = hidden
  useEffect(() => {
    if (!sparkline) return;
    dashOffset.setValue(sparkline.len);
    Animated.timing(dashOffset, {
      toValue: 0,
      duration: SPARK_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sparkline, dashOffset]);

  // ── Render ────────────────────────────────────────────────────
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
          ? `Account equity ${formatMoney(equity)}, ${pctSign}${Math.abs(pctChange).toFixed(2)}%`
          : 'No trades yet'
      }
    >
      <View style={styles.inner}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.equity} allowFontScaling={false} numberOfLines={1}>
          {formatMoney(displayedEquity)}
        </Text>

        {hasTrades ? (
          <View style={styles.deltaRow}>
            <Text style={[styles.deltaMoney, { color: deltaColor }]} allowFontScaling={false}>
              {deltaSign}${formatAbs(Math.abs(realizedPnl))}
            </Text>
            <Text style={styles.deltaDot}>·</Text>
            <Text style={[styles.deltaPct, { color: deltaColor }]} allowFontScaling={false}>
              {pctSign}{Math.abs(pctChange).toFixed(2)}%
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyBody}>
            Place your first trade to start tracking your performance.
          </Text>
        )}
      </View>

      {/* Full-bleed sparkline / placeholder — overflow:hidden on the
          card clips it to the rounded corners. */}
      {hasTrades && sparkline ? (
        <Svg width={sparkline.w} height={sparkline.h} style={styles.spark}>
          <Defs>
            <LinearGradient id="acpFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={deltaColor} stopOpacity="0.25" />
              <Stop offset="1" stopColor={deltaColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path d={sparkline.areaD} fill="url(#acpFill)" />
          <AnimatedPath
            d={sparkline.pathD}
            stroke={deltaColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${sparkline.len} ${sparkline.len}`}
            strokeDashoffset={dashOffset as unknown as number}
          />
        </Svg>
      ) : !hasTrades ? (
        <View style={styles.placeholderWrap}>
          <View style={[styles.dottedLine]} pointerEvents="none" />
          {onStartSession && (
            <View style={styles.emptyCtaWrap}>
              <Button
                label={PRIMARY_ACTION_LABEL}
                variant="secondary"
                onPress={onStartSession}
              />
            </View>
          )}
        </View>
      ) : null}
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
    paddingHorizontal: 20,
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
    alignItems: 'center',
    gap: 8,
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
  spark: {
    marginTop: 6,
  },
  emptyBody: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 320,
  },
  placeholderWrap: {
    height: SPARK_H,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  dottedLine: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
    marginBottom: 14,
  },
  emptyCtaWrap: {
    alignSelf: 'flex-start',
  },
});
