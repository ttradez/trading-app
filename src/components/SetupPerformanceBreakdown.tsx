import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import NumericText from './NumericText';
import Button from './ui/Button';
import PressableCard from './PressableCard';
import { useJournalStore } from '../store/journalStore';
import { getSetupPerformance, SetupStats } from '../lib/setupPerformance';
import { borders, colors, surface } from '../theme';

/**
 * Per-setup performance list. Each row carries a gold-at-opacity
 * background bar sized by |netPnl|/max so the most-impactful row
 * reads at full intensity and the smallest at the 30% floor. The
 * P&L number on the right is the GAIN/LOSS signal — the bar itself
 * is magnitude-only.
 *
 * Empty state (no setup-attributed trades): a centered caption +
 * tertiary "Browse Setup Library" button routing into Learn.
 *
 * Row tap-to-detail is deferred — rows are static here.
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;

const BAR_FLOOR_OPACITY = 0.30;
const VISIBLE_ROWS      = 6;

interface Props {
  /** Stub callback for the future "view all" detail screen. */
  onViewAll?: () => void;
  /** Empty-state CTA — routes to the Learn tab. */
  onBrowseLibrary?: () => void;
  /** Per-row drill-down into the SetupStats screen. Passed by
   *  StatsScreen; absent when the breakdown is rendered in a
   *  read-only context. */
  onRowPress?: (setupId: string) => void;
}

export default function SetupPerformanceBreakdown({
  onViewAll,
  onBrowseLibrary,
  onRowPress,
}: Props) {
  const trades = useJournalStore((s) => s.entries);

  const rows = useMemo(() => getSetupPerformance(trades), [trades]);
  const maxAbs = useMemo(() => {
    let m = 0;
    for (const r of rows) {
      const v = Math.abs(r.netPnl);
      if (v > m) m = v;
    }
    return m;
  }, [rows]);

  // ── Empty state ─────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyCaption}>
          Trade a few setups to see which patterns work for you
        </Text>
        {onBrowseLibrary && (
          <Button
            label="Browse Setup Library"
            variant="tertiary"
            onPress={onBrowseLibrary}
          />
        )}
      </View>
    );
  }

  const visible = rows.slice(0, VISIBLE_ROWS);
  const hasMore = rows.length > VISIBLE_ROWS;

  return (
    <View>
      {visible.map((row, i) => (
        <Row
          key={row.setupId}
          row={row}
          maxAbs={maxAbs}
          showDivider={i < visible.length - 1}
          onPress={onRowPress ? () => onRowPress(row.setupId) : undefined}
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
  row, maxAbs, showDivider, onPress,
}: {
  row: SetupStats;
  maxAbs: number;
  showDivider: boolean;
  onPress?: () => void;
}) {
  const ratio = maxAbs > 0 ? Math.abs(row.netPnl) / maxAbs : 0;
  const barOpacity = BAR_FLOOR_OPACITY + 0.70 * Math.min(1, ratio);

  const pnlColor =
    row.netPnl > 0 ? GREEN :
    row.netPnl < 0 ? RED   :
    WHITE;
  const sign = row.netPnl > 0 ? '+' : row.netPnl < 0 ? '-' : '';

  const pfDisplay =
    row.profitFactor === null  ? null :
    row.profitFactor === 'inf' ? 'PF ∞' :
    `PF ${row.profitFactor.toFixed(1)}`;

  // Inner row content — extracted so we can wrap it in PressableCard
  // when a drill-down handler is supplied without changing the layout.
  const rowBody = (
    <>
      {/* Background magnitude bar — sized 100% width with opacity
          modulating the perceived "fill." We deliberately don't
          scale width so column-aligned rows still left-anchor at
          the same x; opacity does the magnitude work alone. */}
      <View
        style={[
          styles.barFill,
          { backgroundColor: `rgba(255, 184, 0, ${barOpacity.toFixed(2)})` },
        ]}
        pointerEvents="none"
      />
      <View style={styles.rowContent}>
        <View style={styles.left}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={styles.subline} numberOfLines={1}>
            <Text style={styles.category}>{row.category.toUpperCase()}</Text>
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
    </>
  );

  return (
    <View>
      {onPress ? (
        <PressableCard
          onPress={onPress}
          baseBg={surface.l1}
          pressedBg={surface.l3}
          style={styles.row}
          accessibilityLabel={`${row.name} stats — ${row.tradeCount} trades`}
        >
          {rowBody}
        </PressableCard>
      ) : (
        <View style={styles.row}>{rowBody}</View>
      )}
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

function formatAbsShort(n: number): string {
  // No cents — column reads cleaner. Thousands separators OK; rows
  // are wide enough.
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
  name: {
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
  category: {
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

  // Empty state
  emptyWrap: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
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
