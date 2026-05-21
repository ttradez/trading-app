import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useJournalStore } from '../store/journalStore';
import {
  winRate, profitFactor, avgRR, consistency,
} from '../lib/tradeMetrics';
import WinRateGlyph from './icons/metrics/WinRateGlyph';
import ProfitFactorGlyph from './icons/metrics/ProfitFactorGlyph';
import AvgRRGlyph from './icons/metrics/AvgRRGlyph';
import ConsistencyGlyph from './icons/metrics/ConsistencyGlyph';

/**
 * Key metrics row (DESIGN_AUDIT §3.1). ONE card with FOUR cells
 * separated by 1px vertical hairlines — deliberately NOT four
 * separate cards, so this section reads visually distinct from
 * every other dashboard surface. Each cell: 24pt custom glyph,
 * h1 value, eyebrow label.
 *
 * "—" displayed when the underlying metric is below its documented
 * sample floor (see `tradeMetrics.ts`). Never reads as a defeatist
 * 0% on day one.
 */

const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const HAIRLINE    = '#1F1F1F';

export default function MetricsCard() {
  const entries = useJournalStore((s) => s.entries);

  const stats = useMemo(() => {
    const wr = winRate(entries);
    const pf = profitFactor(entries);
    const rr = avgRR(entries);
    const cn = consistency(entries);
    return {
      winRate:      wr === null ? '—' : `${Math.round(wr)}%`,
      profitFactor: pf === null ? '—' : pf === 'inf' ? '∞' : pf.toFixed(2),
      avgRR:        rr === null ? '—' : `${rr >= 0 ? '' : '−'}${Math.abs(rr).toFixed(2)}`,
      consistency:  cn === null ? '—' : `${Math.round(cn)}%`,
    };
  }, [entries]);

  return (
    <View style={styles.card}>
      <Cell
        glyph={<WinRateGlyph />}
        value={stats.winRate}
        label="WIN RATE"
      />
      <View style={styles.divider} />
      <Cell
        glyph={<ProfitFactorGlyph />}
        value={stats.profitFactor}
        label="PROFIT FACTOR"
      />
      <View style={styles.divider} />
      <Cell
        glyph={<AvgRRGlyph />}
        value={stats.avgRR}
        label="AVG R:R"
      />
      <View style={styles.divider} />
      <Cell
        glyph={<ConsistencyGlyph />}
        value={stats.consistency}
        label="CONSISTENCY"
      />
    </View>
  );
}

function Cell({
  glyph, value, label,
}: { glyph: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.cell}>
      <View style={styles.glyphWrap}>{glyph}</View>
      <Text style={styles.value} allowFontScaling={false} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 16,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  divider: {
    width: 1,
    backgroundColor: HAIRLINE,
    marginVertical: 8,
  },
  glyphWrap: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // h1 value — uses the locked typography scale (22pt bold).
  value: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  // Eyebrow — 11pt uppercase, white@60%.
  label: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
