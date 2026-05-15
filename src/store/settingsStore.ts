import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

/**
 * App-wide user preferences. Persisted via `zustand/middleware` +
 * AsyncStorage so they survive restarts.
 *
 * `maybeHaptic` is the gated entry point for tactile feedback: it
 * no-ops when the user has disabled haptics. Existing
 * `Haptics.impactAsync` / `notificationAsync` call sites are NOT
 * refactored to use this yet — that's a deliberate follow-up so
 * this prompt stays scoped to building the store + screen. New
 * code should prefer `maybeHaptic`.
 */

type ImpactStyle = Haptics.ImpactFeedbackStyle;

interface SettingsState {
  hapticsEnabled: boolean;
  /** Default lot/contract size pre-filled when staging an order.
   *  Clamped 1-10 by the settings UI. */
  defaultContractSize: number;

  setHapticsEnabled: (v: boolean) => void;
  setDefaultContractSize: (n: number) => void;
  reset: () => void;
}

const DEFAULTS = {
  hapticsEnabled: true,
  defaultContractSize: 1,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setDefaultContractSize: (defaultContractSize) =>
        set({ defaultContractSize }),

      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'settings-storage-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Fire a haptic ONLY if the user hasn't disabled them. Reads the
 * store imperatively (`getState`) so non-React call sites can use
 * it too. Swallows the promise rejection the same way the raw
 * `Haptics.*` call sites already do (haptics are best-effort).
 */
export function maybeHaptic(
  style: ImpactStyle = Haptics.ImpactFeedbackStyle.Light,
): void {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  Haptics.impactAsync(style).catch(() => {});
}

/** Notification-style variant (success / warning / error) — same
 *  enabled-gate as `maybeHaptic`. */
export function maybeNotificationHaptic(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): void {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  Haptics.notificationAsync(type).catch(() => {});
}
