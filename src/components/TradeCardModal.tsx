import React from 'react';
import MoneyText from './MoneyText';
import {
  View, Text, StyleSheet, Modal, Pressable, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, fontWeight, radius, labelStyle } from '../theme';
import { useJournalStore, JournalEntry } from '../store/journalStore';

interface ClosedTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  lots: number;
  entry_price: number;
  exit_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  opened_at: number;
  closed_at: number;
  pnl: number;
  pips: number;
  r_multiple?: number | null;
}

interface Props {
  trade: ClosedTrade | null;
  onClose: () => void;
}

/**
 * Slides up after a trade closes. Shows P&L, R-multiple, duration, and a
 * "JOURNAL TRADE" button that snapshots the trade into the journal store.
 */
export default function TradeCardModal({ trade, onClose }: Props) {
  const addEntry = useJournalStore((s) => s.addEntry);
  if (!trade) return null;

  // Defensive defaults — auto-closed trades from the backend may omit pips /
  // r_multiple / etc, and rendering those as `.toFixed()` would crash.
  const pnl        = typeof trade.pnl === 'number' ? trade.pnl : 0;
  const pips       = typeof trade.pips === 'number' ? trade.pips : 0;
  const entryPx    = typeof trade.entry_price === 'number' ? trade.entry_price : 0;
  const exitPx     = typeof trade.exit_price  === 'number' ? trade.exit_price  : 0;
  const openedAt   = typeof trade.opened_at === 'number' ? trade.opened_at : Date.now();
  const closedAt   = typeof trade.closed_at === 'number' ? trade.closed_at : Date.now();
  const symbol     = trade.symbol ?? '';
  const side       = trade.side ?? 'buy';
  const lots       = typeof trade.lots === 'number' ? trade.lots : 1;
  const rMultiple  = typeof trade.r_multiple === 'number' ? trade.r_multiple : null;

  const win = pnl >= 0;
  const fmt = (n: number) => (typeof n === 'number' ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const durationSec = Math.max(0, (closedAt - openedAt) / 1000);
  const durationStr = formatDuration(durationSec);
  const dateStr = new Date(closedAt).toLocaleString();

  const journal = () => {
    // Carry forward any pre-trade plan already captured for this
    // trade (the auto-journal at close stored it) so re-journaling
    // here doesn't wipe the recorded intent.
    const prev = useJournalStore
      .getState()
      .entries.find((e) => e.tradeId === trade.id);
    const entry: JournalEntry = {
      id: trade.id,
      tradeId: trade.id,
      symbol,
      side,
      lots,
      entryPrice: entryPx,
      exitPrice: exitPx,
      stopLoss: trade.stop_loss ?? null,
      takeProfit: trade.take_profit ?? null,
      pnl,
      rMultiple,
      openedAt,
      closedAt,
      planSetupType:   prev?.planSetupType ?? null,
      planStopPrice:   prev?.planStopPrice ?? null,
      planTargetPrice: prev?.planTargetPrice ?? null,
      planSkipped:     prev?.planSkipped ?? false,
      // Carry forward metric fields if previously populated by the
      // auto-journal at close (TradingScreen). See §3.1 metrics TODO.
      rrAchieved:      prev?.rrAchieved ?? rMultiple ?? null,
      riskAmount:      prev?.riskAmount ?? null,
      // TODO(setup-attribution): same as TradingScreen — populate
      // from the launching Setup Library context once that flows
      // through. Carry-forward preserves any setupId the
      // auto-journal stored at close.
      setupId:         prev?.setupId ?? null,
      // Carry forward the post-trade rating if one already exists.
      rating:          prev?.rating ?? null,
      // Pre-trade discipline checklist flags — carried from the
      // earlier journal write so re-journaling doesn't reset them.
      checklistPassed:  prev?.checklistPassed ?? false,
      checklistSkipped: prev?.checklistSkipped ?? false,
      notes: '',
      mistakes: '',
      wentWell: '',
      emotion: null,
      confidence: null,
      strategy: '',
      tags: [],
      savedAt: Date.now(),
    };
    addEntry(entry);
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.header, { backgroundColor: win ? colors.greenDim : colors.redDim }]}>
            <Ionicons
              name={win ? 'trophy-outline' : 'close-circle-outline'}
              size={24}
              color={win ? colors.green : colors.red}
            />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={styles.headerTitle}>{win ? 'WIN' : 'LOSS'}</Text>
              <Text style={styles.headerSub}>{symbol}  ·  {side.toUpperCase()}  ·  {lots}x</Text>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Big P&L */}
          <View style={styles.pnlRow}>
            <MoneyText
              value={pnl}
              size={fontSize.display}
              style={[styles.pnlBig, win ? styles.green : styles.red]}
            />
            <Text style={[styles.rMultiple, win ? styles.green : styles.red]}>
              {rMultiple != null ? `${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R` : '—'}
            </Text>
          </View>

          {/* Stats grid */}
          <View style={styles.grid}>
            <Stat label="ENTRY"    value={fmt(entryPx)} />
            <Stat label="EXIT"     value={fmt(exitPx)}  />
            <Stat label="PIPS"     value={`${pips >= 0 ? '+' : ''}${pips.toFixed(1)}`} good={pips >= 0} />
            <Stat label="DURATION" value={durationStr} />
            <Stat label="STOP"     value={trade.stop_loss   ? fmt(trade.stop_loss)   : '—'} />
            <Stat label="TARGET"   value={trade.take_profit ? fmt(trade.take_profit) : '—'} />
          </View>

          <Text style={styles.dateLine}>Closed {dateStr}</Text>

          {/* Journal button */}
          <TouchableOpacity style={styles.journalBtn} onPress={journal} activeOpacity={0.85}>
            <Ionicons name="journal-outline" size={18} color={colors.bg} />
            <Text style={styles.journalBtnText}>JOURNAL TRADE</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[labelStyle, styles.statLabel]}>{label}</Text>
      <Text style={[styles.statValue, good === true && styles.green, good === false && styles.red]}>{value}</Text>
    </View>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  if (h < 24) return mr ? `${h}h ${mr}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '90%',
    // Modal surface — L3 in the layered system.
    backgroundColor: '#141414',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 18, elevation: 10,
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.black, letterSpacing: 1 },
  headerSub:   { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, opacity: 0.85 },

  pnlRow: {
    flexDirection: 'row', alignItems: 'baseline',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.md,
  },
  pnlBig:    { fontSize: fontSize.display, fontWeight: fontWeight.black, fontVariant: ['tabular-nums'] },
  rMultiple: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    gap: spacing.md,
  },
  stat:      { width: '47%' },
  statLabel: { fontSize: 9, marginBottom: 2 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  dateLine: { color: colors.textTertiary, fontSize: fontSize.xs, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  journalBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  journalBtnText: { color: colors.bg, fontWeight: fontWeight.black, letterSpacing: 1.5, fontSize: fontSize.md },

  green: { color: colors.green },
  red:   { color: colors.red },
});
