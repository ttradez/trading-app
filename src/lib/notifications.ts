import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { useNotificationsStore, NotificationTime } from '../store/notificationsStore';

/**
 * Local-notification scheduling for Pip.
 *
 * Two events ONLY (see `notificationsStore.ts` for the design
 * rationale on why streak notifications are deliberately excluded).
 *
 * All copy is reviewed against the "tired-user filter": would a user
 * having a hard day feel respected or pressured by this message?
 * Anything that fails that filter — urgency, loss aversion, social
 * comparison, streak FOMO — doesn't ship.
 *
 * Permission flow:
 *  - We never ask on app start.
 *  - `ensureNotificationPermission` is called the moment a toggle
 *    flips ON. It returns the post-check status so the caller can
 *    revert the toggle if denied.
 *  - On iOS, `requestPermissionsAsync` only shows the system prompt
 *    when status is `undetermined`. After `denied`, the only path is
 *    `Linking.openSettings()` — `openSystemSettings` below handles
 *    that.
 *
 * Scheduling uses expo-notifications' CALENDAR trigger types so the
 * OS handles repeat, time-zone, and quiet-hours (DND / Focus)
 * behaviour for us. iOS weekday convention: 1=Sunday … 7=Saturday.
 */

// Notification copy — review-locked. Adding a variation that fails
// the tired-user filter is a regression; don't.
const DAILY_MISSION_TITLE = "Today's mission is ready";
const DAILY_MISSION_BODY  = "Open Pip when you're ready to trade.";
const WEEKLY_RECAP_TITLE  = "Your weekly recap is ready";
const WEEKLY_RECAP_BODY   = "See how you traded this week.";

/** Tag every notification we own so we can cancel ours without
 *  touching unrelated scheduled work. */
export type PipNotificationType =
  | 'daily-mission'
  | 'weekly-recap';

// Notification data payload — typed as a Record so expo-notifications
// accepts it (the SDK requires `data: Record<string, unknown>`),
// while the `as const` narrows the literal types for our own
// listeners.
type PipData = Record<string, unknown> & {
  type: PipNotificationType;
  /** Marker so a stale notification scheduled by a previous app
   *  install can be filtered cleanly from the user's tray. */
  app: 'pip';
};

function makeData(type: PipNotificationType): PipData {
  return { type, app: 'pip' };
}

// ── Permission flow ────────────────────────────────────────────────

export type PermissionResult = 'granted' | 'denied' | 'undetermined';

function normalize(status: Notifications.NotificationPermissionsStatus): PermissionResult {
  if (status.granted) return 'granted';
  if (status.status === 'denied') return 'denied';
  return 'undetermined';
}

/** Read the current permission state without prompting. */
export async function getNotificationPermission(): Promise<PermissionResult> {
  const cur = await Notifications.getPermissionsAsync();
  return normalize(cur);
}

/**
 * Make sure we hold permission. Call ONLY in response to the user
 * actively opting in (toggle ON). Returns the post-check status so
 * the caller can revert the toggle on denial.
 *
 *  - `granted`     : permission already held, or just granted now.
 *  - `denied`      : the user has previously denied. iOS won't show
 *                    the prompt again — caller should surface the
 *                    "Enable in iOS Settings" caption.
 *  - `undetermined`: prompt was shown and dismissed without a
 *                    decision. Rare; treat as denied for safety.
 */
export async function ensureNotificationPermission(): Promise<PermissionResult> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return 'granted';
  if (cur.status === 'denied') return 'denied';
  // status === 'undetermined' (or null) — safe to ask now.
  const next = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return normalize(next);
}

/** Open the OS settings page for this app — the only way back into
 *  permissions after a previous deny. */
export function openSystemSettings(): void {
  Linking.openSettings().catch(() => {});
}

// ── Scheduling ────────────────────────────────────────────────────

export async function scheduleDailyMissionReminder(
  hour: number,
  minute: number,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: DAILY_MISSION_TITLE,
      body:  DAILY_MISSION_BODY,
      data:  makeData('daily-mission'),
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleWeeklyRecapReminder(
  hour: number,
  minute: number,
): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: WEEKLY_RECAP_TITLE,
      body:  WEEKLY_RECAP_BODY,
      data:  makeData('weekly-recap'),
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      // expo-notifications weekday convention: 1=Sunday … 7=Saturday.
      // Sunday is fixed for the weekly recap — the time picker only
      // adjusts hour + minute.
      weekday: 1,
      hour,
      minute,
    },
  });
}

export async function cancelNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {
    // Identifier already cancelled or never existed — non-fatal.
  }
}

/** Cancel ONLY the notifications we own (tagged with `app:
 *  'pip'` in their data payload). Leaves other scheduled
 *  work — none today, future-proofing for plugins — alone.
 *
 *  Includes a backwards-compat sweep for legacy `app: 'pocket-trade'`
 *  payloads scheduled before the Pip rename — without it, stale
 *  notifications from older installs would linger in the user's tray. */
export async function cancelAllPipNotifications(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of all) {
    const data = item.content.data as Partial<PipData> | undefined;
    if (data?.app === 'pip' || data?.app === 'pocket-trade') {
      await cancelNotification(item.identifier);
    }
  }
}

// ── Foreground handler ────────────────────────────────────────────

/**
 * Show banners + play sound when a notification fires while the
 * app is foregrounded. Without this, foreground notifications would
 * silently dispatch the response listener (the user wouldn't see
 * anything). Called once from App.tsx.
 */
export function configureForegroundNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList:   true,
      shouldPlaySound:  true,
      shouldSetBadge:   false,
    }),
  });
}

// ── Reschedule on app start ────────────────────────────────────────

/**
 * Re-sync the OS schedule with the user's stored preferences. Run
 * once on app start — guards against drift from time-zone changes,
 * device-clock edits, or an OS that dropped our schedule across an
 * update.
 *
 * Strategy: cancel everything we own, then re-schedule only the
 * prefs that are currently enabled. Cheap on a 2-notification list,
 * and idempotent.
 *
 * No-ops on web (expo-notifications scheduling isn't supported in
 * the browser).
 */
export async function rescheduleFromStoredPrefs(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await cancelAllPipNotifications();
  } catch {
    // Bail silently — the per-pref schedule below is the source of
    // truth, and we don't want to block app start on this.
  }

  const store = useNotificationsStore.getState();

  if (store.dailyMissionEnabled) {
    try {
      const id = await scheduleDailyMissionReminder(
        store.dailyMissionTime.hour,
        store.dailyMissionTime.minute,
      );
      store.setDailyMission({ dailyMissionIdentifier: id });
    } catch {
      // Permission may have been revoked mid-session — flip the
      // toggle off so the UI stays honest.
      store.setDailyMission({
        dailyMissionEnabled: false,
        dailyMissionIdentifier: null,
      });
    }
  }

  if (store.weeklyRecapEnabled) {
    try {
      const id = await scheduleWeeklyRecapReminder(
        store.weeklyRecapTime.hour,
        store.weeklyRecapTime.minute,
      );
      store.setWeeklyRecap({ weeklyRecapIdentifier: id });
    } catch {
      store.setWeeklyRecap({
        weeklyRecapEnabled: false,
        weeklyRecapIdentifier: null,
      });
    }
  }
}

// ── Helpers used by the Settings UI ────────────────────────────────

/** Format a stored time as the user-facing label
 *  (e.g. "9:00 AM" / "6:30 PM"). 12-hour clock with AM/PM matches
 *  the iOS time picker the user sees when adjusting it. */
export function formatNotificationTime(t: NotificationTime): string {
  let h = t.hour % 12;
  if (h === 0) h = 12;
  const ampm = t.hour >= 12 ? 'PM' : 'AM';
  const m = t.minute.toString().padStart(2, '0');
  return `${h}:${m} ${ampm}`;
}
