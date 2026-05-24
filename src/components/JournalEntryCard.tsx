import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import NumericText from './NumericText';
import { colors, borders, surface, radius, spacing } from '../theme';

/**
 * JournalEntryCard — placeholder card for the new "Trade Journal"
 * section on the Journal screen. The real post-trade flow (auto
 * popup with a chart screenshot) isn't wired yet, so this card
 * renders mock entries from a constant so the design intent is
 * visible.
 *
 * Card surface follows the existing pattern (see TradeCard /
 * SymbolPerformanceBreakdown): L2 surface, faint card border, a
 * hairline highlight on the top edge.
 *
 * The screenshot slot is a flat L3 rect with a `borders.hairline`
 * outline + faint chart glyph centered — same empty-state language
 * used by InsightsScreen / SymbolPerformanceBreakdown.
 */

export type JournalEntryOutcome = 'W' | 'L';

export interface JournalEntryCardProps {
  outcome: JournalEntryOutcome;
  symbol: string;
  entry: number;
  exit: number;
  pnl: number;
  /** ISO yyyy-mm-dd (or anything Date can parse). */
  date: string;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

export default function JournalEntryCard({
  outcome, symbol, entry, exit, pnl, date,
}: JournalEntryCardProps) {
  const isWin = outcome === 'W';
  const pnlColor =
    pnl > 0 ? colors.green :
    pnl < 0 ? colors.red   :
    colors.textPrimary;

  return (
    <View style={styles.card}>
      {/* Header row — outcome chip + symbol + date */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.outcomeChip,
              isWin ? styles.outcomeChipWin : styles.outcomeChipLoss,
            ]}
          >
            <Text
              style={[
                styles.outcomeChipText,
                isWin ? styles.outcomeChipTextWin : styles.outcomeChipTextLoss,
              ]}
            >
              {isWin ? 'WIN' : 'LOSS'}
            </Text>
          </View>
          <Text style={styles.symbol}>{symbol}</Text>
        </View>
        <NumericText style={styles.date}>{formatDate(date)}</NumericText>
      </View>

      {/* Screenshot placeholder — where the chart screenshot will
          eventually render. Matches the same empty-state pattern
          used elsewhere: L3 surface, hairline outline, faint glyph. */}
      <View style={styles.screenshotSlot}>
        <MaterialCommunityIcons
          name="chart-line"
          size={28}
          color="rgba(255,255,255,0.18)"
        />
        <Text style={styles.screenshotCaption}>Trade screenshot</Text>
      </View>

      {/* Price + P&L row */}
      <View style={styles.bodyRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>ENTRY → EXIT</Text>
          <NumericText style={styles.priceValue}>
            {formatPrice(entry)}
            {'  →  '}
            {formatPrice(exit)}
          </NumericText>
        </View>
        <View style={styles.pnlCol}>
          <Text style={styles.priceLabel}>P&L</Text>
          <NumericText
            bold
            style={[styles.pnlValue, { color: pnlColor }]}
            allowFontScaling={false}
          >
            {formatSignedUSD(pnl)}
          </NumericText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.l1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: borders.card,
    borderTopColor: borders.hairline,
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  outcomeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  outcomeChipWin: {
    backgroundColor: 'rgba(0, 211, 149, 0.12)',
    borderColor: 'rgba(0, 211, 149, 0.35)',
  },
  outcomeChipLoss: {
    backgroundColor: 'rgba(255, 71, 87, 0.12)',
    borderColor: 'rgba(255, 71, 87, 0.35)',
  },
  outcomeChipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  outcomeChipTextWin:  { color: colors.green },
  outcomeChipTextLoss: { color: colors.red },
  symbol: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  date: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
  },

  // Screenshot placeholder slot
  screenshotSlot: {
    height: 120,
    borderRadius: radius.md,
    backgroundColor: surface.l2,
    borderWidth: 1,
    borderColor: borders.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  screenshotCaption: {
    color: colors.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Body
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  pnlCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  priceValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  pnlValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
