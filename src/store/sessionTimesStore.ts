import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sessions Phase B: user-configurable session-open wall-clock times and
 * timezone for the Chart screen's Sessions dropdown jump targets.
 *
 * The Phase A handler shipped with hardcoded NY=09:30, London=03:00,
 * Asia=20:00 — all interpreted as America/New_York. Phase B lets the user
 * choose the IANA timezone the targets are interpreted in (e.g. show
 * London open at 09:30 LONDON wall-clock, not 03:00 ET) and tweak the
 * HH:MM per session.
 *
 * Persisted via zustand/middleware + AsyncStorage. Same persist shape as
 * `symbolFavoritesStore` — JSON-serialisable plain fields, no Sets, so
 * default partialize works without a custom merge.
 *
 * NOTE: this store ONLY affects the seek_session targets. The backend's
 * SYSTEM session-start anchoring (used by `_snap_to_1800_et` and the
 * random-period pick) stays on ET — that's a dataset concept, not a user
 * preference.
 */
export interface SessionTime {
  hh: number;
  mm: number;
}

export type SessionKey = 'newyork' | 'london' | 'asia';

interface SessionTimesState {
  tz: string;
  newyork: SessionTime;
  london: SessionTime;
  asia: SessionTime;

  /** Update the IANA tz id all three session targets are interpreted in. */
  setTz: (tz: string) => void;

  /** Update one session's wall-clock HH:MM. */
  setSessionTime: (key: SessionKey, hh: number, mm: number) => void;

  /** Restore Phase A defaults (NY 09:30 ET / London 03:00 ET / Asia 20:00 ET). */
  reset: () => void;
}

const DEFAULTS = {
  tz: 'America/New_York',
  newyork: { hh: 9, mm: 30 },
  london: { hh: 3, mm: 0 },
  asia: { hh: 20, mm: 0 },
} as const;

export const useSessionTimesStore = create<SessionTimesState>()(
  persist(
    (set) => ({
      tz: DEFAULTS.tz,
      newyork: { ...DEFAULTS.newyork },
      london: { ...DEFAULTS.london },
      asia: { ...DEFAULTS.asia },

      setTz: (tz) => set({ tz }),

      setSessionTime: (key, hh, mm) =>
        set((s) => ({
          ...s,
          [key]: { hh, mm },
        })),

      reset: () =>
        set({
          tz: DEFAULTS.tz,
          newyork: { ...DEFAULTS.newyork },
          london: { ...DEFAULTS.london },
          asia: { ...DEFAULTS.asia },
        }),
    }),
    {
      name: 'pt:sessionTimes',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        tz: s.tz,
        newyork: s.newyork,
        london: s.london,
        asia: s.asia,
      }) as unknown as SessionTimesState,
    },
  ),
);
