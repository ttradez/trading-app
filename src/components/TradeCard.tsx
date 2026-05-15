import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet,
} from 'react-native';
import { TradeGrade } from '../store/tradeJournalStore';

/**
 * TradeCard — single-row presentation of a closed or open trade.
 * Used by the dashboard recent-trades section and the journal list.
 * Aligns with the locked Pocket Trade brand (pure-black surface,
 * white type, gold/green/red accents) and the "TradeLocker-style"
 * professional density specified in the redesign.
 *
 * Layout (top → bottom):
 *  1. Symbol + direction pill (LONG green / SHORT red) on the left,
 *     status indicator on the right (pulsing green dot + "OPEN" or
 *     faded "CLOSED").
 *  2. Entry → Exit price line at 70% white opacity.
 *  3. Hero P&L number — the biggest, most prominent element. Green
 *     for wins, red for losses, white for breakeven. Open trades
 *     append a small "unrealized" suffix.
 *  4. Bottom row metadata — entry date/time | duration | contracts.
 *
 * Left edge of the card carries a 3-px accent stripe (green / red /
 * gold) keyed to the P&L sign, so the win/loss read is parsable at
 * a glance even when scrolling fast.
 *
 * The card reads ONLY the fields listed in `Props`. Mapping from
 * `ClosedTrade` / `JournalEntry` (which use `side: 'buy' | 'sell'`,
 * `lots`, `openedAt`, `closedAt`) is done at the call sites.
 */

const SURFACE       = '#0F0F0F';
const BORDER        = '#1F1F1F';
const GREEN         = '#00D395';
const RED           = '#FF4757';
const GOLD          = '#FFB800';
const WHITE         = '#FFFFFF';
const TEXT_FADED_70 = 'rgba(255,255,255,0.7)';
const TEXT_FADED_50 = 'rgba(255,255,255,0.5)';

export type TradeDirection = 'long' | 'short';
export type TradeStatus    = 'open' | 'closed';

export interface TradeCardProps {
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  /** null when the trade is still open. */
  exitPrice: number | null;
  /** Realized P&L for closed trades; unrealized P&L for open trades. */
  pnl: number;
  /** Unix ms. */
  entryTime: number;
  /** Unix ms; null when open. */
  exitTime: number | null;
  contracts: number;
  status: TradeStatus;
  /** Optional execution grade (from tradeJournalStore). Undefined
   *  if the trade hasn't been journaled — no shame marker is shown
   *  in that case, just no pill at all. */
  grade?: TradeGrade;
  /** Optional tap handler. Used by JournalScreen to open the edit
   *  modal; Dashboard passes nothing. */
  onPress?: () => void;
}

// ── Formatting helpers ─────────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs  = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatEntryDate(unixMs: number): string {
  const d = new Date(unixMs);
  if (isNaN(d.getTime())) return '—';
  const month = MONTHS_SHORT[d.getMonth()];
  const day   = d.getDate();
  const year  = d.getFullYear();
  let hours   = d.getHours();
  const mins  = d.getMinutes().toString().padStart(2, '0');
  const ampm  = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${month} ${day}, ${year} · ${hours}:${mins} ${ampm}`;
}

/** Open trade → "Running". Closed → e.g. "12m 30s" / "1h 04m". */
function formatDuration(entryMs: number, exitMs: number | null): string {
  if (exitMs == null) return 'Running';
  const totalSec = Math.max(0, Math.floor((exitMs - entryMs) / 1000));
  if (totalSec < 60)         return `${totalSec}s`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  if (totalSec < 86_400) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return m > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${h}h`;
  }
  const d = Math.floor(totalSec / 86_400);
  const h = Math.floor((totalSec % 86_400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return GREEN;
  if (pnl < 0) return RED;
  return WHITE;
}

function accentColor(pnl: number): string {
  if (pnl > 0) return GREEN;
  if (pnl < 0) return RED;
  return GOLD;
}

// ── Open-state pulsing dot ─────────────────────────────────────────────────

function OpenDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  return <Animated.View style={[styles.openDot, { opacity }]} />;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeCard(props: TradeCardProps) {
  const {
    symbol, direction, entryPrice, exitPrice, pnl, entryTime, exitTime,
    contracts, status, grade, onPress,
  } = props;

  const isOpen = status === 'open';
  const isLong = direction === 'long';
  const accent = accentColor(pnl);

  const body = (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.inner}>
        {/* Top row — symbol + direction pill + status */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Text style={styles.symbol}>{symbol}</Text>
            <View
              style={[
                styles.dirPill,
                isLong ? styles.dirPillLong : styles.dirPillShort,
              ]}
            >
              <Text
                style={[
                  styles.dirPillText,
                  isLong ? styles.dirPillTextLong : styles.dirPillTextShort,
                ]}
              >
                {isLong ? 'LONG' : 'SHORT'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            {!isOpen && grade && (
              <View style={styles.gradePill}>
                <Text style={styles.gradePillText}>{grade}</Text>
              </View>
            )}
            {isOpen ? (
              <>
                <OpenDot />
                <Text style={styles.statusOpenText}>OPEN</Text>
              </>
            ) : (
              <Text style={styles.statusClosedText}>CLOSED</Text>
            )}
          </View>
        </View>

        {/* Middle — prices + hero P&L */}
        <Text style={styles.prices} numberOfLines={1}>
          Entry: {formatPrice(entryPrice)}  →  Exit:{' '}
          {exitPrice == null ? '—' : formatPrice(exitPrice)}
        </Text>
        <View style={styles.pnlRow}>
          <Text style={[styles.pnl, { color: pnlColor(pnl) }]} allowFontScaling={false}>
            {formatUSD(pnl)}
          </Text>
          {isOpen && (
            <Text style={styles.unrealized}>unrealized</Text>
          )}
        </View>

        {/* Bottom — metadata */}
        <View style={styles.bottomRow}>
          <Text style={styles.metaText} numberOfLines={1}>
            {formatEntryDate(entryTime)}
          </Text>
          <Text style={styles.metaText}>·</Text>
          <Text style={styles.metaText}>{formatDuration(entryTime, exitTime)}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.metaText}>
            {contracts} {contracts === 1 ? 'contract' : 'contracts'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${symbol} ${direction} ${formatUSD(pnl)}`}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.85 },

  accent: {
    width: 3,
    // Pulled by parent flex: stretches full card height.
  },
  inner: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dirPill: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dirPillLong:  { backgroundColor: GREEN },
  dirPillShort: { backgroundColor: RED },
  dirPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dirPillTextLong:  { color: '#000000' },
  dirPillTextShort: { color: WHITE },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginRight: 6,
  },
  statusOpenText: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusClosedText: {
    color: TEXT_FADED_50,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Journaled-trade grade pill — gold border + gold text, sits to
  // the left of the "CLOSED" label. Only renders when `grade` is
  // set; unjournaled trades show nothing here (no shame marker).
  gradePill: {
    marginRight: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: GOLD,
    backgroundColor: 'rgba(255,184,0,0.12)',
  },
  gradePillText: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Middle
  prices: {
    marginTop: 10,
    color: TEXT_FADED_70,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  pnlRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  pnl: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unrealized: {
    marginLeft: 8,
    color: TEXT_FADED_50,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },

  // Bottom
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: TEXT_FADED_50,
    fontSize: 12,
    fontWeight: '500',
    marginRight: 6,
  },
});
