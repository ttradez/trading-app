import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, Easing, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TradeGrade } from '../store/tradeJournalStore';
import MoneyText from './MoneyText';

/**
 * TradeCard — premium presentation of a closed or open trade.
 * Used by the dashboard recent-trades section and the journal list.
 *
 * Visual language (2026-05-16 upgrade):
 *  - Vertical gradient surface (#0F0F0F→#141414), 16px radius, a
 *    4px P&L-colored left stripe + a faint same-color "energy"
 *    glow bleeding in from the left edge.
 *  - Symbol is large; the direction pill is bold and padded.
 *  - P&L is the undeniable hero (~28px) with a color-matched glow.
 *  - Prices are a clean unlabeled "a → b" support line.
 *  - Journaled trades get a circular grade badge in the corner.
 *  - Open trades pulse a gold border and show "unrealized".
 *  - Press → springs to 0.98 for tactile feedback.
 *
 * Props (and the data model) are unchanged — call sites map
 * `JournalEntry` / `ClosedTrade` fields exactly as before.
 */

const GREEN  = '#00D395';
const RED     = '#FF4757';
const GOLD    = '#FFB800';
const WHITE   = '#FFFFFF';
const TAG_BG  = '#2A2A2A';

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
   *  if the trade hasn't been journaled — no badge in that case. */
  grade?: TradeGrade;
  /** Pre-trade plan setup type (e.g. 'breakout'). Shown as a small
   *  tag in the top row; absent for plan-less trades. */
  planSetupType?: string | null;
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
  // Guard against epoch / seconds-as-ms bugs: anything before 2010
  // is a bad timestamp — show "Today" rather than "Jan 1970".
  if (d.getFullYear() < 2010) return 'Today';
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
  if (totalSec <= 0)         return '<1s';
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
/** rgba() for the known accent hexes — used for the P&L text glow
 *  and the left-edge energy bleed. */
function glow(color: string, alpha: number): string {
  const rgb =
    color === GREEN ? '0,211,149' :
    color === RED   ? '255,71,87' :
    color === GOLD  ? '255,184,0' :
                      '255,255,255';
  return `rgba(${rgb},${alpha})`;
}

/** Grade badge palette: A/A+ gold, B white, C/F red @0.7. */
function gradeColor(grade: TradeGrade): string {
  if (grade === 'A+' || grade === 'A') return GOLD;
  if (grade === 'B') return WHITE;
  return 'rgba(255,71,87,0.7)'; // C / F
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TradeCard(props: TradeCardProps) {
  const {
    symbol, direction, entryPrice, exitPrice, pnl, entryTime, exitTime,
    contracts, status, grade, planSetupType, onPress,
  } = props;

  const isOpen = status === 'open';
  const isLong = direction === 'long';
  const accent = accentColor(pnl);
  const pColor = pnlColor(pnl);
  const showGrade = !isOpen && !!grade;

  // Open-trade gold border pulse (~2s cycle, 0.3 → 0.6).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isOpen) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: 1000,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: 1000,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isOpen, pulse]);
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1], outputRange: [0.3, 0.6],
  });
  const dotPulse = pulse.interpolate({
    inputRange: [0, 1], outputRange: [0.35, 1],
  });

  // Press → spring to 0.98 and back.
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 0,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6,
    }).start();

  const card = (
    <View style={styles.cardOuter}>
      <LinearGradient
        colors={['#0F0F0F', '#141414']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Left energy glow bleeding in from the stripe. */}
      <LinearGradient
        pointerEvents="none"
        colors={[glow(accent, 0.13), 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.leftGlow}
      />
      {/* 4px P&L-colored left stripe. */}
      <View style={[styles.stripe, { backgroundColor: accent }]} />

      {/* Open-trade pulsing gold border. */}
      {isOpen && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pulseBorder, { opacity: pulseOpacity }]}
        />
      )}

      {/* Circular grade badge — top-right corner, journaled only. */}
      {showGrade && (
        <View
          style={[styles.gradeBadge, { borderColor: gradeColor(grade!) }]}
        >
          <Text style={[styles.gradeBadgeText, { color: gradeColor(grade!) }]}>
            {grade}
          </Text>
        </View>
      )}

      <View style={styles.inner}>
        {/* Top row — identity + setup tag */}
        <View
          style={[styles.topRow, showGrade && styles.topRowGraded]}
        >
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

          <View style={styles.topRight}>
            {planSetupType ? (
              <View style={styles.setupTag}>
                <Text style={styles.setupTagText}>
                  {planSetupType.charAt(0).toUpperCase()
                    + planSetupType.slice(1)}
                </Text>
              </View>
            ) : null}
            {isOpen ? (
              <View style={styles.statusChip}>
                <Animated.View
                  style={[styles.statusDotOpen, { opacity: dotPulse }]}
                />
                <Text style={styles.statusChipText}>OPEN</Text>
              </View>
            ) : !showGrade ? (
              <View style={styles.statusChip}>
                <View style={styles.statusDotClosed} />
                <Text style={styles.statusChipText}>CLOSED</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* P&L — the hero */}
        <MoneyText
          value={pnl}
          size={28}
          style={[
            styles.pnl,
            {
              color: pColor,
              textShadowColor: glow(pColor, 0.5),
            },
          ]}
        />
        {isOpen && <Text style={styles.unrealized}>unrealized</Text>}

        {/* Price support line */}
        <Text style={styles.prices} numberOfLines={1}>
          {formatPrice(entryPrice)}
          {'  →  '}
          {exitPrice == null ? '—' : formatPrice(exitPrice)}
        </Text>

        {/* Metadata */}
        <View style={styles.bottomRow}>
          <Text style={styles.metaDate} numberOfLines={1}>
            {formatEntryDate(entryTime)}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatDuration(entryTime, exitTime)} · {contracts} ct
          </Text>
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`${symbol} ${direction} ${formatUSD(pnl)}`}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          {card}
        </Animated.View>
      </Pressable>
    );
  }
  return card;
}

const styles = StyleSheet.create({
  cardOuter: {
    position: 'relative',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderTopColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    // Subtle base lift so the card sits above the black canvas.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  stripe: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 4,
  },
  leftGlow: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 64,
  },
  pulseBorder: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GOLD,
  },
  inner: {
    paddingVertical: 16,
    paddingLeft: 18,
    paddingRight: 16,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // Clear the absolute corner badge when present.
  topRowGraded: { paddingRight: 36 },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  dirPill: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dirPillLong:  { backgroundColor: GREEN },
  dirPillShort: { backgroundColor: RED },
  dirPillText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dirPillTextLong:  { color: '#000000' },
  dirPillTextShort: { color: WHITE },

  setupTag: {
    backgroundColor: TAG_BG,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  setupTagText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  openText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  closedText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Status chip — bordered pill with a leading dot.
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    backgroundColor: '#0F0F0F',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusChipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusDotOpen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GOLD,
    marginRight: 5,
  },
  statusDotClosed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginRight: 5,
  },

  // Circular grade badge
  gradeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  gradeBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  // P&L hero — fontFamily/weight handled inside MoneyText (which
  // imposes JetBrainsMono_700Bold). Keep the rest here.
  pnl: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  unrealized: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },

  // Price support line — JBM for the entry/exit prices.
  prices: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    fontFamily: 'JetBrainsMono_500Medium',
  },

  // Metadata
  bottomRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    fontFamily: 'JetBrainsMono_500Medium',
  },
  // Date is supporting-supporting info — one tier dimmer than the
  // duration/contracts so it doesn't compete with the prices.
  metaDate: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '500',
  },
});
