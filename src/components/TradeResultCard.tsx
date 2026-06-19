import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Image, Share, Alert,
  TouchableOpacity, Platform, NativeModules,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Trade-result card — appears centered over the chart after every position
 * close (manual Close, TP hit, or SL hit) and shows a shareable summary.
 *
 * Replaces the smaller TradeFillToast for closes; the toast caller in
 * ChartScreen is suppressed when this card mounts so the two popups can't
 * stack.
 *
 * Share:
 *   - Tries `react-native-view-shot` + `expo-sharing` to share an IMAGE
 *     of the card (the dream feature).
 *   - If view-shot can't run in this build (Expo Go has historically had
 *     "Unimplemented component" issues with native modules), falls back to
 *     RN's `Share.share({ message })` with a clean text summary so the
 *     button still does something useful. A toast tells the user a dev
 *     build is needed for the image flow.
 *
 * Journal Trade:
 *   - Calls onJournal so ChartScreen can navigate to the Journal tab. The
 *     full "prefill this trade into the journal" flow is the next step.
 */

export type CloseReason = 'manual' | 'tp' | 'sl';

export interface TradeResultData {
  side: 'long' | 'short';
  symbol: string;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsd: number;
  /** Points = side-signed price move (long: exit - entry, short: entry - exit). */
  pointsMove: number;
  /** Return % vs the starting balance, or 0 if not provided. */
  returnPct: number;
  reason: CloseReason;
  /** Unix ms of close (display only). */
  closedAtMs: number;
  /** file:// URI of the CLEAN chart screenshot — no entry / TP / SL /
   *  exit overlay lines drawn on top. Attached to the journal entry
   *  so the user sees an unannotated picture of what they were
   *  looking at right before the trade-result card popped up. */
  cleanChartUri: string | null;
  /** file:// URI of the polished 4:5 trade-card composite the
   *  chart-host renders (chart embedded + P&L hero + symbol/side/
   *  qty + entry→exit + branding). Preferred share image. Falls
   *  back to `chartImageUri` if the card capture failed. */
  shareCardImageUri: string | null;
}

interface Props {
  data: TradeResultData | null;
  onDismiss: () => void;
  onJournal: () => void;
}

// Brand palette — kept raw so the card is self-contained for screenshotting.
const CARD_BG       = '#0E0E0E';
const CARD_BORDER   = 'rgba(255,184,0,0.22)';
const SURFACE_RAISE = 'rgba(255,255,255,0.04)';
const TEXT_PRIMARY  = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.72)';
const TEXT_TERTIARY = 'rgba(255,255,255,0.50)';
const GOLD          = '#FFB800';
const GREEN         = '#00D395';
const RED           = '#FF4757';
const NEUTRAL       = '#9CA3AF';

function fmtMoney(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPrice(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPoints(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toFixed(2)} pt`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}${Math.abs(n).toFixed(2)}%`;
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function reasonLabel(r: CloseReason): { label: string; bg: string; fg: string } {
  if (r === 'tp') return { label: 'TP HIT',     bg: 'rgba(0,211,149,0.16)',  fg: GREEN };
  if (r === 'sl') return { label: 'SL HIT',     bg: 'rgba(255,71,87,0.16)',  fg: RED };
  return            { label: 'MANUAL CLOSE', bg: 'rgba(255,184,0,0.16)', fg: GOLD };
}

function buildShareText(d: TradeResultData): string {
  const side  = d.side === 'long' ? 'LONG' : 'SHORT';
  const sign  = d.pnlUsd > 0 ? '+' : d.pnlUsd < 0 ? '-' : '';
  const win   = d.pnlUsd > 0 ? 'WIN' : d.pnlUsd < 0 ? 'LOSS' : 'FLAT';
  const reason = d.reason === 'tp'
    ? 'TP hit'
    : d.reason === 'sl'
      ? 'SL hit'
      : 'Manual close';
  return [
    `${win} on ${d.symbol} via Pip`,
    `${side} ${d.qty} @ ${fmtPrice(d.entryPrice)} → ${fmtPrice(d.exitPrice)}`,
    `P&L ${sign}$${fmtMoney(d.pnlUsd)}   ${fmtPoints(d.pointsMove)}`,
    `Closed: ${reason} · ${fmtDate(d.closedAtMs)}`,
  ].join('\n');
}

export default function TradeResultCard({ data, onDismiss, onJournal }: Props) {
  const enabled = useSettingsStore((s) => s.tradeResultCardEnabled);
  const setEnabled = useSettingsStore((s) => s.setTradeResultCardEnabled);
  // Tapping OFF on the live card both hides this instance AND
  // persists the preference so future closes don't render the card.
  // Tapping ON when already on is a no-op. The Settings screen is
  // the way back to ON once it's been turned off, since with the
  // card hidden the user can't reach the in-card toggle.
  const handleToggle = () => {
    if (enabled) {
      setEnabled(false);
      onDismiss();
    } else {
      setEnabled(true);
    }
  };

  const cardRef = useRef<View>(null);

  if (!data) return null;

  const isWin  = data.pnlUsd > 0;
  const isLoss = data.pnlUsd < 0;
  const pnlColor = isWin ? GREEN : isLoss ? RED : NEUTRAL;
  const pnlSign  = isWin ? '+' : isLoss ? '-' : '';
  const sideColor = data.side === 'long' ? '#2962FF' : RED;
  const sideLabel = data.side === 'long' ? 'LONG' : 'SHORT';
  const rtag = reasonLabel(data.reason);

  async function handleShare() {
    // Narrow `data` locally — TS can't infer through the closure that
    // the early-return-on-null at render time guarantees non-null here.
    const d = data;
    if (!d) return;

    let imageSucceeded = false;

    // Prefer the polished trade-card composite (4:5 with branding +
    // P&L + symbol/side/qty + entry→exit + chart embed). Fall back
    // to the chart-only screenshot if the card capture failed at
    // close time (host timeout, taint, etc.).
    const shareUri = d.shareCardImageUri ?? d.chartImageUri;

    // ── Preferred: share the trade-card file via expo-sharing.
    //   CRITICAL: `require('expo-sharing')` calls requireNativeModule
    //   at module-eval time, which throws UN-CATCHABLY through RN's
    //   global error reporter if the native module isn't registered
    //   (Expo Go, missing pod, etc.). Gate the require with
    //   `NativeModules.ExpoSharing` — undefined ⇒ never touch the
    //   wrapper, never trigger the throw. Same pattern as the
    //   view-shot fix below.
    if (shareUri && NativeModules.ExpoSharing) {
      try {
        const Sharing = require('expo-sharing');
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(shareUri, {
            mimeType: 'image/jpeg',
            dialogTitle: 'Share trade result',
          });
          imageSucceeded = true;
        }
      } catch {
        /* fall through to RN Share or text */
      }
    }

    // ── iOS fallback: RN's Share.share accepts a `url` parameter
    //   that handles `file://` paths via UIActivityViewController.
    //   Works in Expo Go without a native module, which is exactly
    //   the case the user is hitting today.
    if (!imageSucceeded && shareUri && Platform.OS === 'ios') {
      try {
        await Share.share({ url: shareUri });
        imageSucceeded = true;
      } catch {
        /* fall through to view-shot or text */
      }
    }

    // ── Dev-build legacy: capture the card view via
    //   react-native-view-shot. Skipped in Expo Go where
    //   NativeModules.RNViewShot is undefined. Also gated against
    //   ExpoSharing for the second `require('expo-sharing')` call.
    if (!imageSucceeded && NativeModules.RNViewShot && NativeModules.ExpoSharing) {
      try {
        const viewShot = require('react-native-view-shot');
        const captureRef = viewShot.captureRef || viewShot.default?.captureRef;
        const Sharing = require('expo-sharing');
        if (!captureRef || !cardRef.current) throw new Error('view-shot not ready');
        const uri = await captureRef(cardRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const available = await Sharing.isAvailableAsync();
        if (!available) throw new Error('expo-sharing not available');
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share trade result',
        });
        imageSucceeded = true;
      } catch {
        // Fall through to text share.
      }
    }
    if (imageSucceeded) return;

    try {
      await Share.share({ message: buildShareText(d) });
    } catch (e: any) {
      Alert.alert(
        'Couldn’t share',
        e?.message ?? 'Sharing failed. Image capture needs a dev build (Expo Go can’t run react-native-view-shot).',
      );
    }
  }

  return (
    <Modal
      visible={!!data}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.cardWrap} onPress={() => { /* swallow */ }}>
          <View ref={cardRef} collapsable={false} style={styles.card}>
            {/* ── Top row: logo + reason chip + dismiss ── */}
            <View style={styles.topRow}>
              <View style={styles.logoRow}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="Pip"
                />
                <Text style={styles.brand}>PIP</Text>
              </View>
              <View style={{ flex: 1 }} />
              <View style={[styles.reasonChip, { backgroundColor: rtag.bg }]}>
                <Text style={[styles.reasonChipText, { color: rtag.fg }]}>
                  {rtag.label}
                </Text>
              </View>
            </View>

            {/* ── P&L hero ── */}
            <View style={styles.heroBlock}>
              <Text style={styles.heroLabel}>{isWin ? 'PROFIT' : isLoss ? 'LOSS' : 'BREAKEVEN'}</Text>
              <View style={styles.heroPnlRow}>
                <Text style={[styles.heroPnl, { color: pnlColor }]} numberOfLines={1}>
                  {pnlSign}${fmtMoney(data.pnlUsd)}
                </Text>
              </View>
            </View>

            {/* ── Stats row (replaces the old chart preview tile) ──
                Two tiles: PIPS and RETURN. RETURN collapses when
                returnPct is 0 (it currently always is, because the
                close path passes 0 — fix that and the second tile
                appears automatically). */}
            <View style={styles.statsRow}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>PIPS</Text>
                <Text
                  style={[styles.statValue, { color: pnlColor }]}
                  numberOfLines={1}
                >
                  {fmtPoints(data.pointsMove)}
                </Text>
              </View>
              {data.returnPct !== 0 && (
                <View style={styles.statTile}>
                  <Text style={styles.statLabel}>RETURN</Text>
                  <Text
                    style={[styles.statValue, { color: pnlColor }]}
                    numberOfLines={1}
                  >
                    {fmtPct(data.returnPct)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── Trade details ── */}
            <View style={styles.detailsBlock}>
              <View style={styles.detailHeader}>
                <Text style={[styles.symbolText]}>{data.symbol}</Text>
                <View style={[styles.sideChip, { backgroundColor: sideColor }]}>
                  <Text style={styles.sideChipText}>{sideLabel}</Text>
                </View>
                <Text style={styles.qtyText}>×{data.qty}</Text>
              </View>

              <View style={styles.priceRow}>
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>ENTRY</Text>
                  <Text style={styles.priceVal}>{fmtPrice(data.entryPrice)}</Text>
                </View>
                <View style={styles.arrowWrap}>
                  <Ionicons name="arrow-forward" size={16} color={TEXT_TERTIARY} />
                </View>
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>EXIT</Text>
                  <Text style={styles.priceVal}>{fmtPrice(data.exitPrice)}</Text>
                </View>
              </View>

              <Text style={styles.dateText}>{fmtDate(data.closedAtMs)}</Text>
            </View>

            {/* ── Actions ── */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={handleShare}
                style={styles.shareBtn}
                accessibilityRole="button"
                accessibilityLabel="Share result"
              >
                <Ionicons name="share-outline" size={18} color={TEXT_PRIMARY} />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onJournal}
                style={styles.journalBtn}
                accessibilityRole="button"
                accessibilityLabel="Journal this trade"
              >
                <Ionicons name="book-outline" size={18} color="#000" />
                <Text style={styles.journalBtnText}>Journal Trade</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ON/OFF toggle — outside the card so it doesn't show in
              the share screenshot. Pill with two segments; tapping
              OFF persists the setting AND dismisses this instance,
              tapping ON re-enables (only reachable if the user
              flipped it from Settings). */}
          <View style={styles.toggleWrap} pointerEvents="box-none">
            <View style={styles.toggleLabel}>
              <Text style={styles.toggleLabelText}>RESULT CARD</Text>
            </View>
            <Pressable
              onPress={handleToggle}
              style={styles.togglePill}
              hitSlop={8}
              accessibilityRole="switch"
              accessibilityState={{ checked: enabled }}
              accessibilityLabel={enabled ? 'Turn off trade-result card' : 'Turn on trade-result card'}
            >
              <View
                style={[
                  styles.toggleSegment,
                  styles.toggleSegmentLeft,
                  !enabled && styles.toggleSegmentActiveOff,
                ]}
              >
                <Text
                  style={[
                    styles.toggleSegmentText,
                    !enabled && styles.toggleSegmentTextActiveOff,
                  ]}
                >
                  OFF
                </Text>
              </View>
              <View
                style={[
                  styles.toggleSegment,
                  styles.toggleSegmentRight,
                  enabled && styles.toggleSegmentActiveOn,
                ]}
              >
                <Text
                  style={[
                    styles.toggleSegmentText,
                    enabled && styles.toggleSegmentTextActiveOn,
                  ]}
                >
                  ON
                </Text>
              </View>
            </Pressable>
          </View>

          {/* Floating close — outside the card so it doesn't show in the
              screenshot, while keeping a clear dismiss affordance. */}
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissBtn}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          >
            <Ionicons name="close" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  dismissBtn: {
    position: 'absolute',
    top: -10,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ON/OFF toggle, top-left, sibling of the dismiss button so it
  // floats above the card (not part of the share screenshot).
  toggleWrap: {
    position: 'absolute',
    top: -38,
    left: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  toggleLabelText: {
    color: TEXT_TERTIARY,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  toggleSegment: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSegmentLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  toggleSegmentRight: {},
  toggleSegmentActiveOn: {
    backgroundColor: GOLD,
  },
  toggleSegmentActiveOff: {
    backgroundColor: 'rgba(255,71,87,0.20)',
  },
  toggleSegmentText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
    color: TEXT_TERTIARY,
  },
  toggleSegmentTextActiveOn: {
    color: '#000000',
  },
  toggleSegmentTextActiveOff: {
    color: RED,
  },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: GOLD,
        shadowOpacity: 0.25,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 12 },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  brand: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reasonChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  heroBlock: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 14,
  },
  heroLabel: {
    color: TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  heroPnlRow: {
    marginTop: 6,
    alignItems: 'center',
  },
  heroPnl: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    lineHeight: 50,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statTile: {
    flex: 1,
    backgroundColor: SURFACE_RAISE,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    color: TEXT_TERTIARY,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  detailsBlock: {
    backgroundColor: SURFACE_RAISE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  symbolText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sideChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sideChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  qtyText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceCol: {
    flex: 1,
  },
  priceLabel: {
    color: TEXT_TERTIARY,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 3,
  },
  priceVal: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  arrowWrap: {
    width: 28,
    alignItems: 'center',
  },
  dateText: {
    marginTop: 10,
    color: TEXT_TERTIARY,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  shareBtnText: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  journalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GOLD,
  },
  journalBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

// `colors` is imported up top to keep the file's brand source consistent
// with other components — referenced via JS scope below for future use.
void colors;
