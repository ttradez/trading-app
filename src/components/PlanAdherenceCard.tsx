import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import NumericText from './NumericText';
import { useJournalStore, JournalEntry } from '../store/journalStore';
import {
  getPlanAdherence, AdherenceBucket,
} from '../lib/disciplineStats';
import { colors, borders, surface } from '../theme';

/**
 * "PLAN ADHERENCE" Stats card — how the user's trades played out
 * versus the plan they set. Stacked horizontal bar with 4
 * buckets, color-coded by intent rather than outcome:
 *
 *   • Hit target  — full plan executed (green)
 *   • Partial     — out before target but with profit (gold)
 *   • Early exit  — out before stop, at a loss (muted white)
 *   • Stopped out — full stop hit as planned (red)
 *
 * Trades without a captured plan (no rrAchieved or intendedRR ≤ 0)
 * are excluded — this card reflects only trades the user actually
 * planned.
 */

const GREEN = colors.green;
const GOLD  = colors.gold;
const RED   = colors.red;
const WHITE = colors.textPrimary;

// 80% opacity over L1 — bars read distinct without dominating.
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

export default function PlanAdherenceCard({ trades: tradesProp }: Props) {
  const storeTrades = useJournalStore((s) => s.entries);
  const trades = tradesProp ?? storeTrades;

  const adherence = useMemo(() => getPlanAdherence(trades), [trades]);
  const { counts, totalScored } = adherence;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PLAN ADHERENCE</Text>
      {totalScored === 0 ? (
        <Text style={styles.emptyCaption}>
          Set stop and target on your trades to track plan adherence
        </Text>
      ) : (
        <>
          <Text style={styles.caption}>
            How your trades played out vs your plan
          </Text>

          {/* Stacked bar — full width, 16pt tall, 4pt radius,
              1px hairline overlay. Segments width = count/total. */}
          <View style={styles.barWrap}>
            <View style={styles.bar}>
              {BUCKET_ORDER.map((b) => {
                if (counts[b] === 0) return null;
                const flex = counts[b] / totalScored;
                return (
                  <View
                    key={b}
                    style={{
                      flex,
                      backgroundColor: SEG_COLOR[b],
                    }}
                  />
                );
              })}
            </View>
            {/* Hairline overlay so the bar's edges read crisply
                against the L1 card surface — covers the segment
                join lines from underneath too. */}
            <View style={styles.barBorder} pointerEvents="none" />
          </View>

          {/* Legend — 4 columns, hide zero-count buckets. Visible
              bucket count drives the column flex so the row fills
              the card width regardless of how many are non-zero. */}
          <View style={styles.legendRow}>
            {BUCKET_ORDER.map((b) => {
              if (counts[b] === 0) return null;
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
                    {counts[b]}
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
    marginBottom: 8,
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
