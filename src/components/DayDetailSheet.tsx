import React, { useMemo } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XIcon } from 'phosphor-react-native';

import Button from './ui/Button';
import NumericText from './NumericText';
import { JournalEntry } from '../store/journalStore';
import { getLibrarySetup } from '../data/setupLibrary';
import { colors, typography, borders, surface } from '../theme';

/**
 * Per-day drill-down sheet for the calendar heatmap. Lists every
 * trade closed on the local-tz date plus the day's net stats.
 * Triggered by tapping a heatmap cell that has trades.
 *
 * Cross-platform: uses React Native's Modal with `animationType=
 * "slide"`. On iOS `presentationStyle="pageSheet"` gives the
 * native bottom-sheet feel; on Android the modal slides up as a
 * full-screen surface (acceptable fallback; a true bottom-sheet
 * would need a new dep, which is out of scope).
 *
 * Tap on a trade row navigates to the Journal tab with the entry
 * pre-selected (`openEntryId` route param — see JournalScreen).
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;

interface Props {
  isVisible: boolean;
  date: Date | null;
  trades: ReadonlyArray<JournalEntry>;
  onClose: () => void;
  /** Called with the entry id when a row is tapped. Caller is
   *  responsible for the cross-screen navigation (so this
   *  component stays nav-library-agnostic). */
  onTradePress?: (entryId: string) => void;
}

export default function DayDetailSheet({
  isVisible, date, trades, onClose, onTradePress,
}: Props) {
  const summary = useMemo(() => {
    if (trades.length === 0) {
      return { netPnl: 0, wins: 0, losses: 0, winRate: 0 };
    }
    let netPnl = 0;
    let wins = 0;
    let losses = 0;
    for (const t of trades) {
      netPnl += t.pnl;
      if (t.pnl > 0) wins++;
      else if (t.pnl < 0) losses++;
    }
    const denom = trades.length || 1;
    return {
      netPnl,
      wins,
      losses,
      winRate: Math.round((wins / denom) * 100),
    };
  }, [trades]);

  // Render nothing when the parent hasn't picked a date yet — the
  // Modal still needs `visible={false}` to play its close animation
  // cleanly, so we render the shell but with no body content.
  const dateLabel = date ? formatDayLong(date) : '';
  const pnlColor =
    summary.netPnl > 0 ? GREEN :
    summary.netPnl < 0 ? RED   :
    WHITE;
  const pnlSign  =
    summary.netPnl > 0 ? '+' :
    summary.netPnl < 0 ? '-' : '';

  return (
    <Modal
      visible={isVisible}
      transparent={Platform.OS !== 'ios'}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={[typography.display, styles.headerTitle]} numberOfLines={2}>
            {dateLabel}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <XIcon size={22} weight="bold" color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {trades.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                No trades found for this day
              </Text>
              <Button
                label="Done"
                variant="secondary"
                onPress={onClose}
                style={styles.emptyCta}
              />
            </View>
          ) : (
            <>
              {/* Day summary card */}
              <View style={styles.summaryCard}>
                <Text style={styles.cardEyebrow}>DAY SUMMARY</Text>
                <NumericText
                  bold
                  style={[styles.summaryPnl, { color: pnlColor }]}
                  allowFontScaling={false}
                >
                  {pnlSign}${formatAbs(Math.abs(summary.netPnl))}
                </NumericText>
                <View style={styles.summaryStatsRow}>
                  <NumericText style={styles.summaryStat}>
                    {trades.length}
                  </NumericText>
                  <Text style={styles.summaryStatSuffix}>
                    {' '}{trades.length === 1 ? 'trade' : 'trades'}
                  </Text>
                  <Text style={styles.summarySep}>·</Text>
                  <NumericText style={styles.summaryStat}>
                    {summary.wins}W {summary.losses}L
                  </NumericText>
                  <Text style={styles.summarySep}>·</Text>
                  <NumericText style={styles.summaryStat}>
                    {summary.winRate}%
                  </NumericText>
                  <Text style={styles.summaryStatSuffix}> win</Text>
                </View>
              </View>

              {/* Trades list */}
              <Text style={[styles.cardEyebrow, styles.tradesEyebrow]}>
                TRADES
              </Text>
              <View style={styles.tradesList}>
                {trades.map((t, i) => (
                  <React.Fragment key={t.id}>
                    <TradeRow
                      entry={t}
                      onPress={
                        onTradePress ? () => onTradePress(t.id) : undefined
                      }
                    />
                    {i < trades.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Trade row ──────────────────────────────────────────────────────

function TradeRow({
  entry, onPress,
}: { entry: JournalEntry; onPress?: () => void }) {
  const time = formatTime(entry.closedAt);
  const setup = entry.setupId ? getLibrarySetup(entry.setupId) : undefined;
  const label = setup?.name ?? entry.symbol;

  const pnlColor =
    entry.pnl > 0 ? GREEN :
    entry.pnl < 0 ? RED   :
    WHITE;
  const sign = entry.pnl > 0 ? '+' : entry.pnl < 0 ? '-' : '';

  const r = entry.rrAchieved ?? entry.rMultiple;
  const rDisplay = typeof r === 'number' && Number.isFinite(r)
    ? `R ${r >= 0 ? '' : '−'}${Math.abs(r).toFixed(1)}`
    : null;

  const body = (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTime}>{time}</Text>
        <Text style={styles.rowName} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        <NumericText bold style={[styles.rowPnl, { color: pnlColor }]}>
          {sign}${formatAbs(Math.abs(entry.pnl))}
        </NumericText>
        {rDisplay && (
          <NumericText style={styles.rowR}>{rDisplay}</NumericText>
        )}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`Trade ${label} ${sign}${formatAbs(Math.abs(entry.pnl))}`}
    >
      {body}
    </Pressable>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDayLong(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
}

function formatAbs(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
    color: WHITE,
  },
  closeBtn: { padding: 4, marginLeft: 8, marginTop: 6 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Summary card
  summaryCard: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
  },
  cardEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  summaryPnl: {
    marginTop: 12,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  summaryStatsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  summaryStat: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryStatSuffix: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  summarySep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginHorizontal: 6,
  },

  // Trades list
  tradesEyebrow: { marginTop: 24, marginBottom: 8 },
  tradesList: {
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowRight: { alignItems: 'flex-end' },
  rowTime: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowName: {
    marginTop: 3,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowPnl: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowR: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 14,
  },

  // Empty state
  emptyWrap: {
    marginTop: 80,
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyCta: {
    minWidth: 160,
  },
});
