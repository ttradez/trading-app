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
import NumericText from './NumericText';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

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
 *
 * Each numeric value count-ups from 0 → the target on mount via
 * `useAnimatedNumber`. The "—" insufficient-data state skips the
 * animation and renders the dash directly.
 */

const CARD_BG     = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const HAIRLINE    = '#1F1F1F';

export default function MetricsCard() {
  const entries = useJournalStore((s) => s.entries);

  const stats = useMemo(() => {
    const wr = winRate(entries);
    const pf = profitFactor(entries);
    const rr = avgRR(entries);
    const cn = consistency(entries);
    return { wr, pf, rr, cn };
  }, [entries]);

  return (
    <View style={styles.card}>
      <PercentCell
        glyph={<WinRateGlyph />}
        value={stats.wr}
        label="WIN RATE"
      />
      <View style={styles.divider} />
      <ProfitFactorCell
        glyph={<ProfitFactorGlyph />}
        value={stats.pf}
        label="PROFIT FACTOR"
      />
      <View style={styles.divider} />
      <DecimalCell
        glyph={<AvgRRGlyph />}
        value={stats.rr}
        label="AVG R:R"
      />
      <View style={styles.divider} />
      <PercentCell
        glyph={<ConsistencyGlyph />}
        value={stats.cn}
        label="CONSISTENCY"
      />
    </View>
  );
}

/** Percent metric. `null` → "—"; otherwise count-up to value, append %. */
function PercentCell({
  glyph, value, label,
}: { glyph: React.ReactNode; value: number | null; label: string }) {
  const animated = useAnimatedNumber(value ?? 0);
  const display = value === null ? '—' : `${Math.round(animated)}%`;
  return <Cell glyph={glyph} display={display} label={label} />;
}

/** Avg R:R metric. `null` → "—"; otherwise count-up with 2 decimals,
 *  preserving the sign (negative uses U+2212 minus to match the old UI). */
function DecimalCell({
  glyph, value, label,
}: { glyph: React.ReactNode; value: number | null; label: string }) {
  const animated = useAnimatedNumber(value ?? 0);
  let display: string;
  if (value === null) {
    display = '—';
  } else {
    const sign = animated < 0 ? '−' : '';
    display = `${sign}${Math.abs(animated).toFixed(2)}`;
  }
  return <Cell glyph={glyph} display={display} label={label} />;
}

/** Profit factor metric. Tri-state — `null` ("—"), `'inf'` ("∞"), or
 *  number (count-up with 2 decimals). The infinity branch skips the
 *  animation since there's no numeric target to interpolate. */
function ProfitFactorCell({
  glyph, value, label,
}: {
  glyph: React.ReactNode;
  value: number | 'inf' | null;
  label: string;
}) {
  const numericTarget = typeof value === 'number' ? value : 0;
  const animated = useAnimatedNumber(numericTarget);
  let display: string;
  if (value === null) display = '—';
  else if (value === 'inf') display = '∞';
  else display = animated.toFixed(2);
  return <Cell glyph={glyph} display={display} label={label} />;
}

function Cell({
  glyph, display, label,
}: { glyph: React.ReactNode; display: string; label: string }) {
  return (
    <View style={styles.cell}>
      <View style={styles.glyphWrap}>{glyph}</View>
      <NumericText bold style={styles.value} allowFontScaling={false} numberOfLines={1}>
        {display}
      </NumericText>
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
  value: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
