import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import NumericText from './NumericText';
import { useJournalStore } from '../store/journalStore';
import { getDailyPnL, getTier } from '../lib/dailyPnL';
import { chart, colors, surface } from '../theme';

/**
 * Month-view trading-day heatmap. Each cell carries the day's net
 * P&L tinted by magnitude (4 tiers ramping the brand green / red
 * at 10–40% opacity). Empty days stay L1; today gets a 1px gold
 * outline so it's locatable at a glance.
 *
 * Pure View / Text / Pressable — no SVG. Tap-to-detail per day is
 * deferred to a follow-up; cells are static.
 */

const WHITE   = colors.textPrimary;
const GREEN   = colors.green;
const RED     = colors.red;
const GOLD    = chart.equityStroke;

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CELL_GAP = 4;

interface Props {
  /** Optional override — accepts a snapshot for tests / Storybook.
   *  Real callers read from useJournalStore. */
  trades?: ReadonlyArray<{ closedAt: number; pnl: number }>;
}

export default function CalendarHeatmap({ trades: tradesProp }: Props) {
  const storeTrades = useJournalStore((s) => s.entries);
  const trades = tradesProp ?? storeTrades;

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => ({
    year:  today.getFullYear(),
    month: today.getMonth(),
  }));

  const dailyPnL = useMemo(
    () => getDailyPnL(trades, view.year, view.month),
    [trades, view.year, view.month],
  );

  // ── Build the 7×6 cell grid for the displayed month ─────────
  const grid = useMemo(() => {
    // Day-of-week of the 1st (0 = Sun … 6 = Sat).
    const firstDow = new Date(view.year, view.month, 1).getDay();
    const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

    // Always render 6 weeks (42 cells) so the card height doesn't
    // jump month-to-month — months that don't need the 6th row get
    // an extra empty trailing row.
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length < 42) cells.push({ day: null });
    return cells;
  }, [view.year, view.month]);

  const isCurrentMonth =
    view.year === today.getFullYear() && view.month === today.getMonth();
  const todayDay = isCurrentMonth ? today.getDate() : null;

  // ── Cell sizing: flex the row, square via aspectRatio. ──────
  // We capture the row width on layout so we can switch between
  // an even flex layout and a fixed-width fallback if needed.
  const [rowWidth, setRowWidth] = useState(0);
  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== rowWidth) setRowWidth(w);
  };
  const cellSize = rowWidth > 0
    ? Math.floor((rowWidth - CELL_GAP * 6) / 7)
    : 0;

  // ── Has-any-trades check (drives the empty caption) ─────────
  const hasAnyTrades = trades.length > 0;

  const prevMonth = () =>
    setView((v) => v.month === 0
      ? { year: v.year - 1, month: 11 }
      : { year: v.year,     month: v.month - 1 });
  const nextMonth = () =>
    setView((v) => v.month === 11
      ? { year: v.year + 1, month: 0 }
      : { year: v.year,     month: v.month + 1 });
  const goToday = () =>
    setView({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <View>
      {/* Header — prev / month-year / next + Today link. */}
      <View style={styles.header}>
        <Pressable
          onPress={prevMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.chevron, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[view.month]} <NumericText style={styles.monthLabel}>{view.year}</NumericText>
        </Text>
        <Pressable
          onPress={nextMonth}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.chevron, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <View style={{ flex: 1 }} />
        {!isCurrentMonth && (
          <Pressable
            onPress={goToday}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Jump to current month"
            style={({ pressed }) => [styles.todayLink, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.todayLinkText}>Today</Text>
          </Pressable>
        )}
      </View>

      {/* Day-of-week row. */}
      <View style={styles.dowRow}>
        {DOW.map((d, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.dowText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Grid — 6 weeks × 7 days. */}
      <View onLayout={onRowLayout}>
        {Array.from({ length: 6 }).map((_, weekIdx) => (
          <View key={weekIdx} style={styles.weekRow}>
            {grid.slice(weekIdx * 7, weekIdx * 7 + 7).map((c, i) => (
              <DayCell
                key={`${weekIdx}-${i}`}
                day={c.day}
                pnl={c.day != null ? dailyPnL[c.day] : undefined}
                size={cellSize}
                isToday={c.day != null && c.day === todayDay}
              />
            ))}
          </View>
        ))}
      </View>

      {/* Empty caption when there's no data anywhere yet. */}
      {!hasAnyTrades && (
        <Text style={styles.emptyCaption}>
          Trade a session to see your daily P&amp;L
        </Text>
      )}
    </View>
  );
}

// ── DayCell ────────────────────────────────────────────────────────

function DayCell({
  day, pnl, size, isToday,
}: {
  day: number | null;
  pnl: number | undefined;
  size: number;
  isToday: boolean;
}) {
  // Outside the displayed month — pure spacing placeholder.
  if (day == null) {
    return <View style={{ width: size, height: size }} />;
  }

  const tier = pnl != null ? getTier(pnl) : null;
  const bg = (() => {
    if (!tier || tier.side === 'flat') return surface.l1;
    const ramp = tier.side === 'gain'
      ? [chart.gainTier1, chart.gainTier2, chart.gainTier3, chart.gainTier4]
      : [chart.lossTier1, chart.lossTier2, chart.lossTier3, chart.lossTier4];
    return ramp[tier.tier - 1];
  })();

  const hasTrade = pnl != null && Math.abs(pnl) >= 1;
  const dayNumColor = hasTrade
    ? WHITE
    : 'rgba(255,255,255,0.5)';
  const pnlColor = pnl != null && pnl > 0
    ? GREEN
    : pnl != null && pnl < 0 ? RED : undefined;

  return (
    <View
      style={[
        styles.cell,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          borderColor: isToday ? GOLD : 'transparent',
        },
      ]}
    >
      <NumericText
        style={[styles.dayNum, { color: dayNumColor }]}
        allowFontScaling={false}
      >
        {day}
      </NumericText>
      {hasTrade && pnl != null && (
        <NumericText
          style={[styles.dayPnl, { color: pnlColor }]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {pnl > 0 ? '+' : '-'}${formatAbsShort(Math.abs(pnl))}
        </NumericText>
      )}
    </View>
  );
}

/** "1234" — no cents, no thousands separator if it would overflow.
 *  Calendar cells are narrow; prefer compact integers. */
function formatAbsShort(n: number): string {
  return String(Math.round(n));
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 4,
  },
  chevron: { padding: 2 },
  monthLabel: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  todayLink: { paddingVertical: 2, paddingHorizontal: 6 },
  todayLinkText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  dowRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dowText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  weekRow: {
    flexDirection: 'row',
    gap: CELL_GAP,
    marginBottom: CELL_GAP,
  },
  cell: {
    borderRadius: 6,
    paddingTop: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '600',
  },
  dayPnl: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },

  emptyCaption: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
