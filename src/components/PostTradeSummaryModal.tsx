import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  XIcon, ThumbsUpIcon, ThumbsDownIcon, MinusIcon,
} from 'phosphor-react-native';

import Button from './ui/Button';
import NumericText from './NumericText';
import { JournalEntry } from '../store/journalStore';
import { getLibrarySetup, CATEGORY_LABEL } from '../data/setupLibrary';
import { colors, typography, borders, surface } from '../theme';

/**
 * Post-trade summary — the moment after a close. Replaces the
 * older grade+emotions journal popup with a richer summary card:
 * outcome pill, big P&L, trade details, stats delta, XP earned,
 * a quick rating, and an optional note.
 *
 * Mounted by TradingScreen after committing the just-closed trade
 * to the journal store. While visible, the CelebrationModal queue
 * is paused (see celebrationQueueStore.pause) so badge / rank /
 * streak unlocks queue but don't interrupt this summary.
 */

const GREEN = colors.green;
const RED   = colors.red;
const WHITE = colors.textPrimary;
const GOLD  = colors.gold;

export interface StatsSnapshot {
  /** 0–100, or null when the sample is empty. */
  winRate: number | null;
  /** PF value, "inf" when no losses, or null below the sample floor. */
  profitFactor: number | 'inf' | null;
}

interface Props {
  visible: boolean;
  /** The just-closed entry, as committed to the journal store. */
  trade: JournalEntry | null;
  /** Stats snapshot computed BEFORE the trade was committed. */
  preStats: StatsSnapshot | null;
  /** Stats snapshot computed AFTER the trade was committed. */
  postStats: StatsSnapshot | null;
  /** Total XP awarded from this single close. */
  xpEarned: number;
  /** Called when the user dismisses with Done — payload carries
   *  the in-modal selections so the caller can persist them onto
   *  the trade record. */
  onDone: (data: { rating: JournalEntry['rating']; note: string }) => void;
}

export default function PostTradeSummaryModal({
  visible, trade, preStats, postStats, xpEarned, onDone,
}: Props) {
  const [rating, setRating] = useState<JournalEntry['rating']>(null);
  const [note, setNote] = useState('');

  // Reset whenever a new trade is presented so selections don't
  // bleed from the previous trade.
  useEffect(() => {
    if (visible) {
      setRating(null);
      setNote('');
    }
  }, [visible, trade?.id]);

  if (!trade) return null;

  const outcome = outcomeOf(trade.pnl);
  const pnlColor = outcome === 'WIN' ? GREEN
    : outcome === 'LOSS' ? RED
    : WHITE;
  const pnlSign = trade.pnl > 0 ? '+' : trade.pnl < 0 ? '-' : '';

  const setup = trade.setupId ? getLibrarySetup(trade.setupId) : undefined;
  const categoryLabel = setup
    ? (CATEGORY_LABEL[setup.category] ?? setup.category).toUpperCase()
    : null;

  const durationMs = Math.max(0, trade.closedAt - trade.openedAt);
  const durationLabel = formatDuration(durationMs);

  const rDisplay = (() => {
    const r = trade.rrAchieved ?? trade.rMultiple;
    if (typeof r !== 'number' || !Number.isFinite(r)) return null;
    return `${r >= 0 ? '' : '−'}${Math.abs(r).toFixed(1)}R`;
  })();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => onDone({ rating, note: note.trim() })}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Close X (top-right). The Done button at the bottom is
              the primary dismissal; this is the escape hatch. */}
          <View style={styles.headerBar}>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => onDone({ rating, note: note.trim() })}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <XIcon size={22} weight="bold" color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Outcome pill */}
            <View style={styles.pillRow}>
              <OutcomePill outcome={outcome} />
            </View>

            {/* P&L hero */}
            <NumericText
              bold
              style={[styles.heroPnl, { color: pnlColor }]}
              allowFontScaling={false}
            >
              {pnlSign}${formatAbs(Math.abs(trade.pnl))}
            </NumericText>

            {/* Trade details card */}
            <View style={[styles.card, styles.sectionGap]}>
              <Text style={styles.cardEyebrow}>TRADE DETAILS</Text>
              <Text style={styles.detailsTitle} numberOfLines={2}>
                {setup ? setup.name : trade.symbol}
                {categoryLabel && (
                  <Text style={styles.detailsCategory}>
                    {'  ·  '}{categoryLabel}
                  </Text>
                )}
              </Text>
              <View style={styles.statGrid}>
                <StatCell label="ENTRY"    value={formatPrice(trade.entryPrice)} />
                <View style={styles.statDividerV} />
                <StatCell label="EXIT"     value={formatPrice(trade.exitPrice)} />
              </View>
              <View style={styles.statDividerH} />
              <View style={styles.statGrid}>
                <StatCell label="DURATION" value={durationLabel} />
                <View style={styles.statDividerV} />
                <StatCell label="R:R"      value={rDisplay ?? '—'} />
              </View>
            </View>

            {/* Stats delta caption */}
            {preStats && postStats && (
              <StatsDeltaLine pre={preStats} post={postStats} />
            )}

            {/* XP earned */}
            {xpEarned > 0 && (
              <View style={[styles.card, styles.sectionGap]}>
                <Text style={styles.cardEyebrow}>EARNED</Text>
                <View style={styles.xpPill}>
                  <NumericText bold style={styles.xpAmount}>
                    +{xpEarned}
                  </NumericText>
                  <Text style={styles.xpSuffix}>{' XP'}</Text>
                </View>
              </View>
            )}

            {/* Trade rating row */}
            <View style={styles.sectionGap}>
              <Text style={styles.cardEyebrow}>HOW WAS THIS TRADE?</Text>
              <View style={styles.ratingRow}>
                <RatingChip
                  Icon={ThumbsUpIcon}
                  label="Good"
                  selected={rating === 'good'}
                  onPress={() => setRating(rating === 'good' ? null : 'good')}
                />
                <RatingChip
                  Icon={MinusIcon}
                  label="OK"
                  selected={rating === 'ok'}
                  onPress={() => setRating(rating === 'ok' ? null : 'ok')}
                />
                <RatingChip
                  Icon={ThumbsDownIcon}
                  label="Bad"
                  selected={rating === 'bad'}
                  onPress={() => setRating(rating === 'bad' ? null : 'bad')}
                />
              </View>
            </View>

            {/* Journal note */}
            <View style={styles.sectionGap}>
              <Text style={styles.cardEyebrow}>NOTES</Text>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(t) => setNote(t.slice(0, 500))}
                placeholder="What did you notice on this trade?"
                placeholderTextColor="rgba(255,255,255,0.35)"
                multiline
                selectionColor={GOLD}
              />
            </View>
          </ScrollView>

          {/* Done — pinned bottom above safe-area inset. */}
          <View style={styles.bottomCta}>
            <Button
              label="Done"
              variant="primary"
              onPress={() => onDone({ rating, note: note.trim() })}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Outcome pill ───────────────────────────────────────────────────

function OutcomePill({ outcome }: { outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' }) {
  const cfg = outcome === 'WIN'
    ? { bg: 'rgba(0, 211, 149, 0.16)', border: 'rgba(0, 211, 149, 0.60)', text: GREEN }
    : outcome === 'LOSS'
    ? { bg: 'rgba(255, 71, 87, 0.16)', border: 'rgba(255, 71, 87, 0.60)', text: RED }
    : { bg: 'rgba(255, 255, 255, 0.08)', border: 'rgba(255, 255, 255, 0.30)', text: 'rgba(255,255,255,0.8)' };
  return (
    <View
      style={[
        styles.outcomePill,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
    >
      <Text style={[styles.outcomeText, { color: cfg.text }]}>
        {outcome}
      </Text>
    </View>
  );
}

// ── Stat cell ──────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <NumericText style={styles.statValue} allowFontScaling={false}>
        {value}
      </NumericText>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Stats delta caption ──────────────────────────────────────────

function StatsDeltaLine({
  pre, post,
}: { pre: StatsSnapshot; post: StatsSnapshot }) {
  // Format the WR pair "62% (+3%)" and PF "1.4 (+0.1)".
  const wrCur = post.winRate;
  const wrDelta = (post.winRate ?? 0) - (pre.winRate ?? 0);
  const pfCur = post.profitFactor;
  const pfDelta =
    typeof post.profitFactor === 'number' && typeof pre.profitFactor === 'number'
      ? post.profitFactor - pre.profitFactor
      : null;

  return (
    <View style={[styles.deltaRow, styles.sectionGap]}>
      <Text style={styles.deltaSegment}>
        <Text style={styles.deltaLabel}>Win rate:</Text>{' '}
        <NumericText style={styles.deltaValue}>
          {wrCur != null ? `${Math.round(wrCur)}%` : '—'}
        </NumericText>
        {Math.abs(wrDelta) >= 0.5 && (
          <NumericText
            style={[
              styles.deltaTick,
              { color: wrDelta > 0 ? GREEN : RED },
            ]}
          >
            {' '}({wrDelta > 0 ? '+' : '-'}{Math.abs(Math.round(wrDelta))}%)
          </NumericText>
        )}
      </Text>
      <Text style={styles.deltaSep}>{'  ·  '}</Text>
      <Text style={styles.deltaSegment}>
        <Text style={styles.deltaLabel}>Profit factor:</Text>{' '}
        <NumericText style={styles.deltaValue}>
          {pfCur === null ? '—'
            : pfCur === 'inf' ? '∞'
            : pfCur.toFixed(1)}
        </NumericText>
        {pfDelta !== null && Math.abs(pfDelta) >= 0.05 && (
          <NumericText
            style={[
              styles.deltaTick,
              { color: pfDelta > 0 ? GREEN : RED },
            ]}
          >
            {' '}({pfDelta > 0 ? '+' : '-'}{Math.abs(pfDelta).toFixed(1)})
          </NumericText>
        )}
      </Text>
    </View>
  );
}

// ── Rating chip ──────────────────────────────────────────────────

function RatingChip({
  Icon, label, selected, onPress,
}: {
  Icon: typeof ThumbsUpIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.ratingChip,
        selected && styles.ratingChipSelected,
        pressed && !selected && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label} rating`}
      accessibilityState={{ selected }}
    >
      <Icon
        size={16}
        weight="regular"
        color={selected ? GOLD : 'rgba(255,255,255,0.6)'}
      />
      <Text style={[styles.ratingLabel, selected && { color: GOLD }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function outcomeOf(pnl: number): 'WIN' | 'LOSS' | 'BREAKEVEN' {
  if (pnl > 0) return 'WIN';
  if (pnl < 0) return 'LOSS';
  return 'BREAKEVEN';
}

function formatAbs(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.l0 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  closeBtn: { padding: 4 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Outcome pill
  pillRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  outcomePill: {
    minWidth: 140,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // P&L hero
  heroPnl: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },

  // Section spacing.
  sectionGap: { marginTop: 22 },

  // Generic L1 card shell — used by trade details + XP earned.
  card: {
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
    marginBottom: 10,
  },

  // Trade details
  detailsTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailsCategory: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  statGrid: {
    marginTop: 12,
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  statValue: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  statDividerV: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 6,
  },
  statDividerH: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 6,
  },

  // Stats delta caption
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  deltaSegment: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  deltaLabel: {
    color: 'rgba(255,255,255,0.6)',
  },
  deltaValue: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
  },
  deltaTick: {
    fontWeight: '700',
  },
  deltaSep: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },

  // XP pill
  xpPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    borderColor: 'rgba(255, 184, 0, 0.40)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  xpAmount: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  xpSuffix: {
    marginLeft: 2,
    color: GOLD,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Rating row
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ratingChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: borders.card,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ratingChipSelected: {
    backgroundColor: 'rgba(255, 184, 0, 0.16)',
    borderColor: 'rgba(255, 184, 0, 0.60)',
  },
  ratingLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Notes input
  noteInput: {
    minHeight: 100,
    backgroundColor: surface.l1,
    borderColor: borders.card,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: WHITE,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlignVertical: 'top',
  },

  bottomCta: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
});
