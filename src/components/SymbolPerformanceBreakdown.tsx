import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import NumericText from './NumericText';
import Button from './ui/Button';
import { useJournalStore } from '../store/journalStore';
import { getSymbolPerformance, SymbolStats } from '../lib/symbolPerformance';
import { borders, colors } from '../theme';

/**
 * Per-symbol performance list. Visual sibling of
 * SetupPerformanceBreakdown — same gold-opacity magnitude bar,
 * same row layout, same sorted-by-netPnl ordering. Trades are
 * grouped by `trade.symbol`; the friendly name comes from a
 * small hardcoded catalog (see src/lib/symbolPerformance.ts).
 *
 * Rows are static in this pass — symbol drill-down screen is a
 * future task that would mirror SetupStatsScreen.
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;

// Subtle background tint — the earlier 0.30 floor + 1.0 ceiling
// turned the row solid bright yellow when only one symbol existed
// (ratio == 1.0 → full opacity). Capped at 0.18 max so the bar reads
// as a soft accent rather than fighting the text + card surface.
const BAR_FLOOR_OPACITY = 0.04;
const BAR_RATIO_SCALE   = 0.14;
const VISIBLE_ROWS      = 6;

interface Props {
  onViewAll?: () => void;
}

export default function SymbolPerformanceBreakdown({ onViewAll }: Props) {
  const trades = useJournalStore((s) => s.entries);

  const rows = useMemo(() => getSymbolPerformance(trades), [trades]);
  const maxAbs = useMemo(() => {
    let m = 0;
    for (const r of rows) {
      const v = Math.abs(r.netPnl);
      if (v > m) m = v;
    }
    return m;
  }, [rows]);

  if (rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyCaption}>
          Trade across multiple symbols to see your edge by market
        </Text>
      </View>
    );
  }

  const visible = rows.slice(0, VISIBLE_ROWS);
  const hasMore = rows.length > VISIBLE_ROWS;

  return (
    <View>
      {visible.map((row, i) => (
        <Row
          key={row.symbol}
          row={row}
          maxAbs={maxAbs}
          showDivider={i < visible.length - 1}
        />
      ))}
      {hasMore && onViewAll && (
        <View style={styles.viewAllWrap}>
          <Button
            label={`View all ${rows.length}`}
            variant="tertiary"
            onPress={onViewAll}
          />
        </View>
      )}
    </View>
  );
}

// ── Row ────────────────────────────────────────────────────────────

function Row({
  row, maxAbs, showDivider,
}: { row: SymbolStats; maxAbs: number; showDivider: boolean }) {
  const ratio = maxAbs > 0 ? Math.abs(row.netPnl) / maxAbs : 0;
  const barOpacity = BAR_FLOOR_OPACITY + BAR_RATIO_SCALE * Math.min(1, ratio);

  const pnlColor =
    row.netPnl > 0 ? GREEN :
    row.netPnl < 0 ? RED   :
    WHITE;
  const sign = row.netPnl > 0 ? '+' : row.netPnl < 0 ? '-' : '';

  const pfDisplay =
    row.profitFactor === null  ? null :
    row.profitFactor === 'inf' ? 'PF ∞' :
    `PF ${row.profitFactor.toFixed(1)}`;

  return (
    <View>
      <View style={styles.row}>
        <View
          style={[
            styles.barFill,
            { backgroundColor: `rgba(255, 184, 0, ${barOpacity.toFixed(2)})` },
          ]}
          pointerEvents="none"
        />
        <View style={styles.rowContent}>
          <View style={styles.left}>
            <Text style={styles.symbol} numberOfLines={1}>{row.symbol}</Text>
            <Text style={styles.subline} numberOfLines={1}>
              <Text style={styles.name}>{row.name.toUpperCase()}</Text>
              {' · '}
              <NumericText style={styles.subline}>
                {row.tradeCount}
              </NumericText>
              {' '}{row.tradeCount === 1 ? 'trade' : 'trades'}
              {' · '}
              <NumericText style={styles.subline}>
                {Math.round(row.winRate)}%
              </NumericText>
              {' win'}
            </Text>
          </View>
          <View style={styles.right}>
            <NumericText
              bold
              style={[styles.pnl, { color: pnlColor }]}
              allowFontScaling={false}
            >
              {sign}${formatAbsShort(Math.abs(row.netPnl))}
            </NumericText>
            {pfDisplay && (
              <NumericText style={styles.pf}>{pfDisplay}</NumericText>
            )}
          </View>
        </View>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

function formatAbsShort(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
    borderRadius: 8,
    position: 'relative',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    paddingRight: 12,
  },
  right: {
    alignItems: 'flex-end',
  },
  symbol: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  subline: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  name: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '800',
    letterSpacing: 1,
  },
  pnl: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pf: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: borders.hairline,
    marginVertical: 2,
  },

  emptyWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 300,
  },

  viewAllWrap: {
    marginTop: 8,
    alignSelf: 'center',
  },
});
