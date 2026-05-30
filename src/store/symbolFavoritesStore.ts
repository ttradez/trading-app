import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-user favorite markets for the watchlist picker. Lets users
 * pin the handful of contracts they actually trade to the top of
 * the SymbolPickerSheet so they don't scroll past the full 14-row
 * catalog every time.
 *
 * Deliberately a SEPARATE store from `watchlistStore` (which holds
 * "saved setups" — symbol + date + timeframe study artifacts).
 * Symbol favorites are a different concept: just a set of symbol
 * keys, no per-entry metadata.
 *
 * Persisted via zustand/middleware + AsyncStorage. The Set is
 * round-tripped through an array because the persist middleware
 * can't serialise Set natively — same pattern as
 * `learnProgressStore`.
 */
interface SymbolFavoritesState {
  favorites: Set<string>;

  /** Toggle a symbol's favorite state. Idempotent per call. */
  toggle: (symbol: string) => void;

  /** Convenience read for callers that just need a boolean. */
  isFavorite: (symbol: string) => boolean;

  /** Full reset — wired into the existing "Reset Everything" flow. */
  reset: () => void;
}

export const useSymbolFavoritesStore = create<SymbolFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(),

      toggle: (symbol) => {
        const cur = get().favorites;
        const next = new Set(cur);
        if (next.has(symbol)) next.delete(symbol);
        else next.add(symbol);
        set({ favorites: next });
      },

      isFavorite: (symbol) => get().favorites.has(symbol),

      reset: () => set({ favorites: new Set<string>() }),
    }),
    {
      name: 'symbol-favorites-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Set isn't JSON-serialisable — round-trip via an array.
      partialize: (s) => ({
        favorites: Array.from(s.favorites),
      }) as unknown as SymbolFavoritesState,
      merge: (persisted, current) => {
        const arr = (persisted as { favorites?: unknown })?.favorites;
        return {
          ...current,
          favorites: Array.isArray(arr)
            ? new Set(arr as string[])
            : new Set<string>(),
        };
      },
    },
  ),
);
