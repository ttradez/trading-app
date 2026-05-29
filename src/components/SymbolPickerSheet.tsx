import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';

/**
 * SymbolPickerSheet — bottom-sheet symbol picker for the Chart tab.
 *
 * Mirrors the `SelectModal` pattern from SettingsScreen (backdrop +
 * handle + title + scrollable option rows with a gold-tint highlight
 * + checkmark on the current selection), built as a focused component
 * so Settings is left untouched.
 *
 * Symbols are fetched from `${CHART_BACKEND_URL}/markets` when the
 * sheet opens. On failure we fall back to a hardcoded symbol list
 * (symbols only, no friendly names — the name line is omitted).
 */
export interface MarketSymbol {
  symbol: string;
  /** Friendly name. Empty string for fallback entries (no name known). */
  name: string;
  pip?: number;
  contractSize?: number;
}

/** Fallback when the /markets fetch fails — symbols only, no names. */
const FALLBACK_SYMBOLS: MarketSymbol[] = [
  'SPX', 'NDX', 'DJI', 'DAX', 'FTSE', 'N225', 'ES',
  'NQ', 'YM', 'CL', 'GC', 'SI', 'NG', 'ZB',
].map((symbol) => ({ symbol, name: '' }));

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
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
            >
              {symbols.map((item) => {
                const selected = item.symbol === selectedSymbol;
                return (
                  <Pressable
                    key={item.symbol}
                    onPress={() => onSelect(item.symbol)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && !selected && styles.optionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={item.symbol}
                  >
                    <View style={styles.optionTextWrap}>
                      <Text
                        style={[
                          styles.optionSymbol,
                          selected && styles.optionSymbolSelected,
                        ]}
                      >
                        {item.symbol}
                      </Text>
                      {item.name ? (
                        <Text style={styles.optionName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      ) : null}
                    </View>
                    {selected && (
                      <Ionicons name="checkmark" size={20} color={colors.gold} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '70%',
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
    marginBottom: 8,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionSelected: {
    backgroundColor: 'rgba(255,184,0,0.10)',
  },
  optionPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionSymbol: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSymbolSelected: {
    color: colors.gold,
  },
  optionName: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '400',
  },
});
