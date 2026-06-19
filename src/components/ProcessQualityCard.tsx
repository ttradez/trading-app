import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import NumericText from './NumericText';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import {
  getDisciplineRate, getPlanAdherence, AdherenceBucket,
} from '../lib/disciplineStats';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { colors, borders, surface } from '../theme';

/**
 * Process Quality — single card that merges the old DisciplineRateCard
 * (checklist completion ring) and PlanAdherenceCard (stacked bar of
 * how trades played vs their plan). Both metrics answer "HOW are you
 * trading" (process, not P&L), so they belong on one surface.
 *
 *   ┌─ PROCESS QUALITY ─────────────────────────────┐
 *   │  Discipline             [animated ring + %]   │
 *   │  ──────────────────────────────────────────   │
 *   │  How trades played vs plan                    │
 *   │  [animated stacked bar]                       │
 *   │  • Hit target   • Partial   …                 │
 *   └────────────────────────────────────────────────┘
 *
 * Animations:
 *  - Ring stroke-dashoffset animates 0→ratio on mount (SVG arc fill).
 *  - Discipline % counts up via useAnimatedNumber.
 *  - Adherence bar segments grow from flex:0 → flex:share via
 *    Animated.Value (a single shared progress 0→1 driving each width).
 */

const GOLD  = colors.gold;
const TRACK = 'rgba(255,255,255,0.08)';

const RING_SIZE   = 80;
const RING_STROKE = 8;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SEG_COLOR: Record<AdherenceBucket, string> = {
  hitTarget:  'rgba(0, 211, 149, 0.80)',
  partial:    'rgba(255, 184, 0, 0.80)',
  earlyExit:  'rgba(255, 255, 255, 0.40)',
  stoppedOut: 'rgba(255, 71, 87, 0.80)',
};

const SEG_LABEL: Record<AdherenceBucket, string> = {
  hitTarget:  'Hit target',
  partial:    'Partial',
  earlyExit:  'Early exit',
  stoppedOut: 'Stopped',
};

const BUCKET_ORDER: ReadonlyArray<AdherenceBucket> = [
  'hitTarget', 'partial', 'earlyExit', 'stoppedOut',
];

interface Props {
  trades?: ReadonlyArray<JournalEntry>;
}

export default function ProcessQualityCard({ trades: tradesProp }: Props) {
  const storeTrades = useJournalStore((s) => s.entries);
  const trades = tradesProp ?? storeTrades;

  const discipline = useMemo(() => getDisciplineRate(trades), [trades]);
  const adherence  = useMemo(() => getPlanAdherence(trades),  [trades]);

  const animatedRate = useAnimatedNumber(discipline.rate);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PROCESS QUALITY</Text>

      {/* ── Discipline row ─────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Discipline</Text>
      {discipline.totalCount === 0 ? (
        <Text style={styles.emptyCaption}>
          Complete the pre-trade checklist on your trades to track
          your discipline
        </Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.left}>
            <NumericText bold style={styles.rate} allowFontScaling={false}>
              {Math.round(animatedRate)}%
            </NumericText>
            <Text style={styles.subline}>
              <NumericText style={styles.sublineNum}>
                {discipline.passedCount}
              </NumericText>
              {' of '}
              <NumericText style={styles.sublineNum}>
                {discipline.totalCount}
              </NumericText>
              {' '}
              {discipline.totalCount === 1 ? 'trade' : 'trades'}
              {' with full checklist'}
            </Text>
          </View>
          <DisciplineRing ratio={discipline.rate / 100} />
        </View>
      )}

      {/* ── Hairline divider ───────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Plan Adherence row ─────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Plan adherence</Text>
      {adherence.totalScored === 0 ? (
        <Text style={styles.emptyCaption}>
          Set stop and target on your trades to track plan adherence
        </Text>
      ) : (
        <>
          <Text style={styles.caption}>
            How your trades played out vs your plan
          </Text>
          <AnimatedStackedBar
            counts={adherence.counts}
            totalScored={adherence.totalScored}
          />
          <View style={styles.legendRow}>
            {BUCKET_ORDER.map((b) => {
              if (adherence.counts[b] === 0) return null;
              return (
                <View key={b} style={styles.legendCell}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: SEG_COLOR[b] },
                    ]}
                  />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {SEG_LABEL[b]}
                  </Text>
                  <NumericText style={styles.legendCount} allowFontScaling={false}>
                    {adherence.counts[b]}
                  </NumericText>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ── Ring ─────────────────────────────────────────────────────────────

function DisciplineRing({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * radius;

  // SVG-driven stroke-dashoffset animation. We animate a single
  // value 0→1 and interpolate to (circ → circ * (1 - clamped)) so
  // the gold arc draws itself in 800 ms on mount + on ratio change.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, clamped]);

  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, circ * (1 - clamped)],
  });

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={TRACK} strokeWidth={RING_STROKE} fill="none"
        />
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={GOLD} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset as unknown as number}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
    </View>
  );
}

// ── Animated stacked bar ─────────────────────────────────────────────

function AnimatedStackedBar({
  counts, totalScored,
}: {
  counts: Record<AdherenceBucket, number>;
  totalScored: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, totalScored]);

  return (
    <View style={styles.barWrap}>
      <View style={styles.bar}>
        {BUCKET_ORDER.map((b) => {
          if (counts[b] === 0) return null;
          const finalShare = counts[b] / totalScored;
          // Interpolate width 0% → finalShare * 100% so the bar
          // segments grow from the left edge in lockstep.
          const widthInterp = progress.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', `${finalShare * 100}%`],
          });
          return (
            <Animated.View
              key={b}
              style={{
                width: widthInterp,
                backgroundColor: SEG_COLOR[b],
                height: '100%',
              }}
            />
          );
        })}
      </View>
      <View style={styles.barBorder} pointerEvents="none" />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    paddingRight: 16,
  },
  rate: {
    color: GOLD,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  subline: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  sublineNum: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: borders.card,
    marginVertical: 18,
  },
  caption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  barWrap: {
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: borders.card,
  },
  legendRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  legendCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginLeft: 2,
  },
  emptyCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
