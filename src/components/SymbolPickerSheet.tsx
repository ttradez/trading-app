import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ActivityIndicator,
} from 'react-native';

import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';

/**
 * SymbolPickerSheet — bottom-sheet symbol picker for the Chart tab.
 *
 * Layout mirrors the symbol-toggle pills in CreateSessionSheet: each
 * symbol is a pill with a colored circle badge (NQ/ES/YM/GC distinct
 * accents) + the symbol code, gold-bordered, selected = filled gold.
 * The wrap row scales when more symbols are added — pills hold their
 * intrinsic width and overflow onto a new line.
 *
 * Symbols are fetched from `${CHART_BACKEND_URL}/markets` when the
 * sheet opens. On failure we fall back to a hardcoded list (NQ/ES/
 * YM/GC) so the picker still works offline.
 */
export interface MarketSymbol {
  symbol: string;
  /** Friendly name. Not surfaced in the pill layout but kept in the
   *  contract so the /markets payload doesn't need a shim. */
  name: string;
  pip?: number;
  contractSize?: number;
  category?: string;
}

/** Fallback when the /markets fetch fails — same four contracts the
 *  CreateSessionSheet hardcodes for its starting toggle. */
const FALLBACK_SYMBOLS: MarketSymbol[] = [
  { symbol: 'NQ', name: 'Nasdaq 100 E-mini',  category: 'Futures' },
  { symbol: 'ES', name: 'S&P 500 E-mini',     category: 'Futures' },
  { symbol: 'YM', name: 'Dow Jones E-mini',   category: 'Futures' },
  { symbol: 'GC', name: 'Gold Futures',       category: 'Futures' },
];

/** Badge label per known symbol — mirrors the CreateSessionSheet
 *  BADGE_LABEL map. New symbols added to /markets without a known
 *  label fall back to the symbol code itself. */
const BADGE_LABEL: Record<string, string> = {
  NQ: '100',
  ES: '500',
  YM: '30',
  GC: 'OZ',
};

/** Badge background color per known symbol. New symbols default to
 *  neutral white-on-transparent so they still render. */
const BADGE_COLOR: Record<string, string> = {
  NQ: '#2962FF',
  ES: '#F23645',
  YM: '#0EA968',
  GC: '#C9742F',
};

interface Props {
  visible: boolean;
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  onClose: () => void;
}

export default function SymbolPickerSheet({
  visible, selectedSymbol, onSelect, onClose,
}: Props) {
  const [symbols, setSymbols] = useState<MarketSymbol[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch when the sheet opens. Cancel-on-unmount / re-open guard via
  // the `let cancelled = false` pattern used elsewhere in the repo.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(`${CHART_BACKEND_URL}/markets`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MarketSymbol[] = await res.json();
        if (cancelled) return;
        setSymbols(Array.isArray(data) && data.length > 0 ? data : FALLBACK_SYMBOLS);
      } catch {
        if (cancelled) return;
        setSymbols(FALLBACK_SYMBOLS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Order the pills so the four well-known contracts always appear
  // first in this canonical order (NQ, ES, YM, GC). Anything beyond
  // that follows whatever order /markets returned.
  const orderedSymbols = useMemo(() => {
    const known = ['NQ', 'ES', 'YM', 'GC'];
    const order = new Map(known.map((s, i) => [s, i]));
    return [...symbols].sort((a, b) => {
      const ai = order.has(a.symbol) ? order.get(a.symbol)! : 99;
      const bi = order.has(b.symbol) ? order.get(b.symbol)! : 99;
      return ai - bi;
    });
  }, [symbols]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Watchlist</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <View style={styles.symbolRow}>
              {orderedSymbols.map((item) => {
                const selected = item.symbol === selectedSymbol;
                const badgeColor = BADGE_COLOR[item.symbol] ?? 'rgba(255,255,255,0.16)';
                const badgeText  = BADGE_LABEL[item.symbol] ?? item.symbol;
                return (
                  <Pressable
                    key={item.symbol}
                    onPress={() => onSelect(item.symbol)}
                    style={({ pressed }) => [
                      styles.symbolPill,
                      selected && styles.symbolPillSelected,
                      pressed && !selected && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Symbol ${item.symbol}`}
                  >
                    <View
                      style={[
                        styles.symbolBadge,
                        { backgroundColor: badgeColor },
                      ]}
                    >
                      <Text style={styles.symbolBadgeText}>{badgeText}</Text>
                    </View>
                    <Text
                      style={[
                        styles.symbolPillText,
                        selected && styles.symbolPillTextSelected,
                      ]}
                    >
                      {item.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Transparent so the chart behind the sheet stays fully visible
    // while the watchlist slides up. The Pressable still captures
    // taps in the empty area for tap-to-dismiss.
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 14,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Pill row — matches CreateSessionSheet's symbolRow + symbolPill ─
  symbolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  symbolPill: {
    flex: 1,
    minWidth: 80,
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    gap: 10,
  },
  symbolPillSelected: {
    backgroundColor: colors.gold,
  },
  pressed: {
    opacity: 0.7,
  },
  symbolPillText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  symbolPillTextSelected: {
    color: colors.textInverse,
  },
  symbolBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
