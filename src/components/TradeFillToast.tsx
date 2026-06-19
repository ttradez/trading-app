import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * Trade-fill toast — appears at the bottom of the chart screen when a
 * position auto-closes by hitting its TP or SL level. Mirrors the
 * "Position closed" pattern from TradingView mobile but compact and
 * brand-themed. Triggered ONLY on TP/SL fills (not manual closes).
 *
 * The toast slides up + fades in on mount, auto-dismisses after 4s,
 * or tap × to dismiss early. While mounted it sits above the chart
 * area, JUST ABOVE the bottom action row (Sell/qty/Buy/Next Bar/FF)
 * so the controls stay tappable.
 */

export interface TradeFillToastData {
  /**
   * 'tp' / 'sl' — auto-close via bar high/low crossing the level.
   * 'manual'    — user tapped Close (the × on the chart pill, or the
   *               Close chip in the action row).
   * Title + icon + accent change by reason; P&L coloring inside the
   * detail row is always green/red/gray by sign.
   */
  reason: 'tp' | 'sl' | 'manual';
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  fillPrice: number;
  realizedPnl: number;
}

interface Props {
  data: TradeFillToastData | null;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;
const ANIM_IN_MS = 220;
const ANIM_OUT_MS = 180;
const SLIDE_PX = 24;

export default function TradeFillToast({ data, onDismiss }: Props) {
  // Two animated values — translateY for the slide and opacity for the
  // fade. Both run on the native driver. Reset to "hidden" each time
  // `data` changes (new fill arriving while a previous toast is still
  // on screen) so the new toast animates in fresh.
  const slideY = useRef(new Animated.Value(SLIDE_PX)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return undefined;

    slideY.setValue(SLIDE_PX);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(slideY, {
        toValue: 0,
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(() => {
      animateOutAndDismiss();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // animateOutAndDismiss reads from refs only — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function animateOutAndDismiss() {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: SLIDE_PX,
        duration: ANIM_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: ANIM_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }

  function handleClose() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    animateOutAndDismiss();
  }

  if (!data) return null;

  // Title + accent + icon per reason. For 'manual' the accent is gold
  // (brand-neutral — it's neither a "good" TP nor a "bad" SL outcome
  // categorically; the P&L's own color signals win/loss).
  let title: string;
  let accent: string;
  let iconName: 'checkmark-circle' | 'close-circle';
  if (data.reason === 'tp') {
    title = 'Take Profit hit';
    accent = colors.green;
    iconName = 'checkmark-circle';
  } else if (data.reason === 'sl') {
    title = 'Stop Loss hit';
    accent = colors.red;
    iconName = 'close-circle';
  } else {
    title = 'Position closed';
    accent = colors.gold;
    iconName = 'checkmark-circle';
  }
  const sideLabel = data.side === 'long' ? 'LONG' : 'SHORT';

  const fillStr = data.fillPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const pnl = data.realizedPnl;
  const pnlSign = pnl > 0 ? '+' : pnl < 0 ? '-' : '';
  const pnlAbs = Math.abs(pnl).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pnlStr = `${pnlSign}$${pnlAbs}`;
  const pnlColor = pnl > 0 ? colors.green : pnl < 0 ? colors.red : colors.textSecondary;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: hexWithAlpha(accent, 0.18) }]}>
          <Ionicons name={iconName} size={20} color={accent} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: accent }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.detail} numberOfLines={1}>
              {data.symbol} · {sideLabel} {data.qty} @ {fillStr}
            </Text>
            <Text style={[styles.pnl, { color: pnlColor }]} numberOfLines={1}>
              {pnlStr}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.55)" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// Compose a colored fill with alpha for the small icon halo. Accepts
// `#RRGGBB`; appends a 2-digit hex alpha so we don't depend on rgba()
// parsing of arbitrary brand colors.
function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  const aHex = a.toString(16).padStart(2, '0');
  return hex + aHex;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 84,
    left: 16,
    right: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detail: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  pnl: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
