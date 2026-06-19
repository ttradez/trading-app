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
 * can't serialise Set natively.
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

/** Pip ships with intraday data for ES and NQ only — these
 *  are the two contracts every user can actually trade in this build.
 *  Seed them as favorites on first run so the Watchlist sheet opens
 *  with both pinned in the Favorites section instead of an empty pin
 *  list. The user can still un-star either one. */
const DEFAULT_FAVORITES = ['NQ', 'ES'];

export const useSymbolFavoritesStore = create<SymbolFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: new Set<string>(DEFAULT_FAVORITES),

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
        // Pip ships intraday data for ES, NQ, YM (Dow), and GC (Gold).
        // Older AsyncStorage payloads (from when the catalog was 14 symbols
        // wide) can hold stale entries for removed contracts (SPX, CL, etc.) —
        // filter those out on rehydration so the UI never resurfaces them.
        // Note: ALLOWED is a SUPERSET of DEFAULT_FAVORITES — the defaults
        // are what new installs see, but any currently-shipped contract is
        // allowed to be favorited by an existing user.
        const ALLOWED = new Set([...DEFAULT_FAVORITES, 'YM', 'GC']);
        const arr = (persisted as { favorites?: unknown })?.favorites;
        // First-run users have no persisted payload — fall through to the
        // store's default state (NQ + ES seeded). Existing users keep their
        // chosen set (which may be a strict subset of {NQ, ES} if they
        // unfavorited one).
        return {
          ...current,
          favorites: Array.isArray(arr)
            ? new Set((arr as string[]).filter((s) => ALLOWED.has(s)))
            : current.favorites,
        };
      },
    },
  ),
);
