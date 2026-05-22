import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local-notification preferences.
 *
 * Two opt-in events only:
 *   - Daily mission reminder — user-chosen time, repeats daily
 *   - Weekly recap reminder  — user-chosen time on Sunday, repeats weekly
 *
 * Deliberately NO streak notifications. The streak freeze + the
 * in-app at-risk chip already protect the user; pushing streak
 * notifications crosses into dark-pattern territory (urgency / loss
 * aversion). If that pattern is ever requested, the answer is the
 * existing in-app surface, not a new push.
 *
 * Both prefs default to `false` so we never request the OS
 * permission prompt on app start — that itself is a dark pattern.
 * Permission is requested only at the moment the user toggles a
 * preference ON (see `src/lib/notifications.ts`).
 *
 * Times are stored as a `{ hour, minute }` pair so the picker can
 * round-trip cleanly without time-zone gotchas. Identifiers
 * (returned by `Notifications.scheduleNotificationAsync`) are
 * stashed alongside so we can cancel + reschedule when the user
 * adjusts the time, or rebuild the schedule on app start.
 */

export interface NotificationTime {
  hour: number;   // 0..23
  minute: number; // 0..59
}

interface NotificationsState {
  // Daily mission reminder
  dailyMissionEnabled: boolean;
  dailyMissionTime: NotificationTime;
  dailyMissionIdentifier: string | null;

  // Weekly recap reminder — day fixed to Sunday
  weeklyRecapEnabled: boolean;
  weeklyRecapTime: NotificationTime;
  weeklyRecapIdentifier: string | null;

  setDailyMission: (
    update: Partial<Pick<NotificationsState,
      'dailyMissionEnabled' | 'dailyMissionTime' | 'dailyMissionIdentifier'
    >>,
  ) => void;
  setWeeklyRecap: (
    update: Partial<Pick<NotificationsState,
      'weeklyRecapEnabled' | 'weeklyRecapTime' | 'weeklyRecapIdentifier'
    >>,
  ) => void;

  reset: () => void;
}

const DEFAULTS = {
  dailyMissionEnabled: false,
  dailyMissionTime:    { hour: 9,  minute: 0  } satisfies NotificationTime,
  dailyMissionIdentifier: null as string | null,

  weeklyRecapEnabled: false,
  weeklyRecapTime:    { hour: 18, minute: 0  } satisfies NotificationTime,
  weeklyRecapIdentifier: null as string | null,
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setDailyMission: (update) => set((s) => ({ ...s, ...update })),
      setWeeklyRecap:  (update) => set((s) => ({ ...s, ...update })),

      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'notifications-prefs-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
