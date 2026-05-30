import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, SectionList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme';
import { CHART_BACKEND_URL } from '../config/chartBackend';
import { useSymbolFavoritesStore } from '../store/symbolFavoritesStore';

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
 *
 * Grouping: rows are bucketed by `category` (sent by /markets) into
 * a SectionList. A "★ Favorites" section is pinned above the
 * categories whenever the user has at least one favorite — and
 * favorites also appear in their own category section so the user
 * can find every contract in its canonical place. Star tap toggles
 * favorite; row body tap selects the symbol.
 */
export interface MarketSymbol {
  symbol: string;
  /** Friendly name. Empty string for fallback entries (no name known). */
  name: string;
  pip?: number;
  contractSize?: number;
  /** Section label. Optional for back-compat with the fallback list. */
  category?: string;
}

/** Fallback when the /markets fetch fails — symbols only, no names. */
const FALLBACK_SYMBOLS: MarketSymbol[] = [
  'SPX', 'NDX', 'DJI', 'DAX', 'FTSE', 'N225', 'ES',
  'NQ', 'YM', 'CL', 'GC', 'SI', 'NG', 'ZB',
].map((symbol) => ({ symbol, name: '' }));

/** Category display order. Anything unmapped falls through to the end
 *  (sorted alphabetically) so a newly-added category still renders. */
const CATEGORY_ORDER = [
  'Indexes',
  'Index Futures',
  'Metals',
  'Energy',
  'Bonds',
  'Other',
];

const FAVORITES_SECTION_KEY = '__favorites__';

interface Section {
  /** Internal key — `FAVORITES_SECTION_KEY` for the pinned section, otherwise the category name. */
  key: string;
  /** Title shown in the eyebrow header. */
  title: string;
  /** Whether this is the pinned favorites section (icon prefix). */
  isFavorites: boolean;
  data: MarketSymbol[];
}

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

  const favorites = useSymbolFavoritesStore((s) => s.favorites);
  const toggleFavorite = useSymbolFavoritesStore((s) => s.toggle);

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

  // Build the sectioned data. Favorites pinned on top (when ≥1
  // favorite) AND retained in their category — standard pattern, the
  // user shouldn't have to remember "I favorited that, it moved".
  const sections: Section[] = useMemo(() => {
    if (symbols.length === 0) return [];

    // Bucket by category. Fallback entries lack `category` → "Other".
    const byCategory = new Map<string, MarketSymbol[]>();
    for (const sym of symbols) {
      const cat = sym.category || 'Other';
      const arr = byCategory.get(cat);
      if (arr) arr.push(sym);
      else byCategory.set(cat, [sym]);
    }

    // Order categories per CATEGORY_ORDER, then any unknown ones alphabetically.
    const ordered: Section[] = [];
    const seen = new Set<string>();
    for (const cat of CATEGORY_ORDER) {
      const arr = byCategory.get(cat);
      if (arr && arr.length > 0) {
        ordered.push({ key: cat, title: cat, isFavorites: false, data: arr });
        seen.add(cat);
      }
    }
    for (const cat of [...byCategory.keys()].sort()) {
      if (seen.has(cat)) continue;
      ordered.push({
        key: cat,
        title: cat,
        isFavorites: false,
        data: byCategory.get(cat)!,
      });
    }

    // Pin a Favorites section above everything when any favorite resolves
    // to a known symbol. Preserve the user-display order: walk the
    // catalog (already in CATEGORY_ORDER) and keep only favorited rows.
    const favRows: MarketSymbol[] = [];
    for (const sec of ordered) {
      for (const row of sec.data) {
        if (favorites.has(row.symbol)) favRows.push(row);
      }
    }
    if (favRows.length > 0) {
      ordered.unshift({
        key: FAVORITES_SECTION_KEY,
        title: 'Favorites',
        isFavorites: true,
        data: favRows,
      });
    }

    return ordered;
  }, [symbols, favorites]);

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
            <SectionList
              style={styles.list}
              sections={sections}
              keyExtractor={(item, idx) => `${item.symbol}-${idx}`}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  {section.isFavorites && (
                    <Ionicons
                      name="star"
                      size={11}
                      color={colors.gold}
                      style={styles.sectionHeaderIcon}
                    />
                  )}
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item }) => {
                const selected = item.symbol === selectedSymbol;
                const fav = favorites.has(item.symbol);
                return (
                  <View
                    style={[
                      styles.optionRow,
                      selected && styles.optionSelected,
                    ]}
                  >
                    <Pressable
                      onPress={() => onSelect(item.symbol)}
                      style={({ pressed }) => [
                        styles.optionBody,
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
                    {/* Star sits as a SIBLING of the body Pressable so its
                        tap can't bubble through to row selection. hitSlop
                        widens the tap area to a comfortable target without
                        widening the visual icon. */}
                    <Pressable
                      onPress={() => toggleFavorite(item.symbol)}
                      style={styles.starButton}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={fav ? `Unfavorite ${item.symbol}` : `Favorite ${item.symbol}`}
                    >
                      <Ionicons
                        name={fav ? 'star' : 'star-outline'}
                        size={18}
                        color={fav ? colors.gold : 'rgba(255,255,255,0.4)'}
                      />
                    </Pressable>
                  </View>
                );
              }}
            />
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
    backgroundColor: colors.bg,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderIcon: {
    marginRight: 6,
  },
  sectionHeaderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
  },
  optionBody: {
    flex: 1,
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
  starButton: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
