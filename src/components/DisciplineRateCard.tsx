import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import NumericText from './NumericText';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import { getDisciplineRate } from '../lib/disciplineStats';
import { colors, borders, surface } from '../theme';

/**
 * "DISCIPLINE RATE" Stats card — % of trades where every item in
 * the pre-trade checklist was completed. Big mono number on the
 * left + a circular progress ring on the right mirroring the
 * Home header time-goal ring (Apple-Activity arc + indicator dot).
 *
 * Process-not-outcome. The ring is gold regardless of net P&L —
 * this card scores HOW the user trades, not whether they won.
 */

const GOLD  = colors.gold;
const WHITE = colors.textPrimary;
const TRACK = 'rgba(255,255,255,0.08)';

const RING_SIZE   = 80;
const RING_STROKE = 8;

interface Props {
  /** Optional override for testing / Storybook. Defaults to the
   *  full journal store. */
  trades?: ReadonlyArray<JournalEntry>;
}

export default function DisciplineRateCard({ trades: tradesProp }: Props) {
  const storeTrades = useJournalStore((s) => s.entries);
  const trades = tradesProp ?? storeTrades;

  const stats = useMemo(() => getDisciplineRate(trades), [trades]);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>DISCIPLINE RATE</Text>
      {stats.totalCount === 0 ? (
        <Text style={styles.emptyCaption}>
          Complete the pre-trade checklist on your trades to track
          your discipline
        </Text>
      ) : (
        <View style={styles.body}>
          <View style={styles.left}>
            <NumericText bold style={styles.rate} allowFontScaling={false}>
              {Math.round(stats.rate)}%
            </NumericText>
            <Text style={styles.subline}>
              <NumericText style={styles.sublineNum}>
                {stats.passedCount}
              </NumericText>
              {' of '}
              <NumericText style={styles.sublineNum}>
                {stats.totalCount}
              </NumericText>
              {' '}
              {stats.totalCount === 1 ? 'trade' : 'trades'}
              {' with full checklist'}
            </Text>
          </View>
          <DisciplineRing ratio={stats.rate / 100} />
        </View>
      )}
    </View>
  );
}

// ── Ring ───────────────────────────────────────────────────────────

function DisciplineRing({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - clamped);

  // Indicator dot at arc end — Apple-Activity treatment. Arc
  // starts at -90° (top) and sweeps clockwise; the dot rides the
  // gold stroke's leading edge.
  const angle = -Math.PI / 2 + clamped * 2 * Math.PI;
  const dotX = cx + radius * Math.cos(angle);
  const dotY = cy + radius * Math.sin(angle);

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={TRACK} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke={GOLD} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {clamped > 0 && clamped < 1 && (
          <Circle cx={dotX} cy={dotY} r={RING_STROKE / 2 - 1} fill={GOLD} />
        )}
      </Svg>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────

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
    marginBottom: 12,
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
  emptyCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
