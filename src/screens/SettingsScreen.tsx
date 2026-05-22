import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Switch, TextInput,
  Modal, Alert, Share, Linking, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import DSSectionHeader from '../components/SectionHeader';
import NumericText from '../components/NumericText';
import { colors as ST } from '../theme/tokens';
import { typography, spacing } from '../theme';
import { useOnboardingStore, Archetype, DailyCommitment } from '../store/onboardingStore';
import { useStreakStore } from '../store/streakStore';
import { useSettingsStore } from '../store/settingsStore';
import { useJournalStore } from '../store/journalStore';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useDailySetupStore } from '../store/dailySetupStore';
import { useWatchlistStore } from '../store/watchlistStore';
import { useBadgeStore } from '../store/badgeStore';
import { useXpStore } from '../store/xpStore';
import { useChallengeStore } from '../store/challengeStore';
import { useRecapList } from '../store/recapStore';
import WeeklyRecapModal from '../components/WeeklyRecapModal';
import { WeeklyRecap } from '../utils/weeklyRecap';
import { useNotificationsStore, NotificationTime } from '../store/notificationsStore';
import {
  ensureNotificationPermission, formatNotificationTime,
  scheduleDailyMissionReminder, scheduleWeeklyRecapReminder,
  cancelNotification, openSystemSettings,
  cancelAllPocketTradeNotifications,
} from '../lib/notifications';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

/**
 * SettingsScreen — pushed onto the stack from the dashboard gear
 * icon. Five sections: Profile, Training, Preferences, Data,
 * About. All reads/writes go to the local Zustand stores; no
 * backend.
 *
 * Out of scope (documented): handle editing (needs a Firebase
 * uniqueness check), sound toggle, notification prefs, and
 * refactoring existing haptic call sites onto `maybeHaptic`.
 */

const BG          = '#000000';
const CARD_BORDER = '#1F1F1F';
const GOLD        = '#FFB800';
const RED         = '#FF4757';
const WHITE       = '#FFFFFF';
const SWITCH_OFF  = '#333333';

const APP = require('../../app.json');
const APP_VERSION: string = APP?.expo?.version ?? '1.0.0';
const APP_NAME: string = APP?.expo?.name ?? 'Pocket Trade';
const SUPPORT_EMAIL = 'ben@sitesbyben.ca';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** 4th inline copy of the archetype name+icon mapping. Convergence
 *  into a shared module remains deferred (would touch onboarding
 *  screens — out of scope). */
const ARCHETYPE_META: Record<Archetype, { name: string; icon: MCIName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

const TIME_GOAL_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
  { label: '120 min', value: 120 },
];

const COMMITMENT_OPTIONS: { label: string; value: DailyCommitment }[] = [
  { label: 'Light · 3 sessions a week', value: 'light' },
  { label: 'Steady · 1 session a day', value: 'steady' },
  { label: 'Pro · multiple sessions a day', value: 'pro' },
];

const COMMITMENT_SHORT: Record<DailyCommitment, string> = {
  light: 'Light', steady: 'Steady', pro: 'Pro',
};

const CONTRACT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
  label: String(i + 1), value: i + 1,
}));

// ── CSV export ─────────────────────────────────────────────────────────────

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  // Quote if the cell contains comma, quote, or newline; double
  // internal quotes per RFC 4180.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDuration(openedMs: number, closedMs: number): string {
  const sec = Math.max(0, Math.floor((closedMs - openedMs) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }: any) {
  const displayName    = useOnboardingStore((s) => s.displayName);
  const handle         = useOnboardingStore((s) => s.handle);
  const archetype      = useOnboardingStore((s) => s.archetype);
  const dailyGoal      = useOnboardingStore((s) => s.dailyTimeGoalMinutes);
  const dailyCommit    = useOnboardingStore((s) => s.dailyCommitment);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const setDailyGoal   = useOnboardingStore((s) => s.setDailyTimeGoal);
  const setDailyCommit = useOnboardingStore((s) => s.setDailyCommitment);

  const hapticsEnabled    = useSettingsStore((s) => s.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const contractSize      = useSettingsStore((s) => s.defaultContractSize);
  const setContractSize   = useSettingsStore((s) => s.setDefaultContractSize);
  const preTradeChecklist    = useSettingsStore((s) => s.preTradeChecklistEnabled);
  const setPreTradeChecklist = useSettingsStore((s) => s.setPreTradeChecklistEnabled);

  const journalEntries = useJournalStore((s) => s.entries);

  // Recap list — sorted newest-first by `useRecapList`. The
  // "Weekly recap" row opens the most-recent saved week.
  const recapList = useRecapList();
  const latestRecap = recapList[0]?.recap ?? null;
  const [openRecap, setOpenRecap] = useState<WeeklyRecap | null>(null);

  // Notification prefs — opt-in toggles + native time pickers.
  const dailyMissionEnabled = useNotificationsStore((s) => s.dailyMissionEnabled);
  const dailyMissionTime    = useNotificationsStore((s) => s.dailyMissionTime);
  const dailyMissionId      = useNotificationsStore((s) => s.dailyMissionIdentifier);
  const setDailyMission     = useNotificationsStore((s) => s.setDailyMission);
  const weeklyRecapEnabled  = useNotificationsStore((s) => s.weeklyRecapEnabled);
  const weeklyRecapTime     = useNotificationsStore((s) => s.weeklyRecapTime);
  const weeklyRecapId       = useNotificationsStore((s) => s.weeklyRecapIdentifier);
  const setWeeklyRecap      = useNotificationsStore((s) => s.setWeeklyRecap);

  /** Caption shown beneath a toggle the user tried to turn on while
   *  permission is denied. `null` = no caption. Keyed per-toggle so
   *  one denial doesn't blank both rows. */
  const [permissionDenied, setPermissionDenied] = useState<
    null | 'daily' | 'weekly'
  >(null);

  /** Which time picker is open (null = none). The day-of-week for
   *  weekly is implicit — Sunday only. */
  const [timePicker, setTimePicker] = useState<null | 'daily' | 'weekly'>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameBuffer, setNameBuffer]   = useState(displayName);

  // Which select modal is open (null = none).
  const [picker, setPicker] = useState<null | 'goal' | 'commit' | 'contract'>(null);

  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  const saveName = () => {
    const trimmed = nameBuffer.trim();
    if (trimmed.length > 0) setDisplayName(trimmed);
    setEditingName(false);
  };

  // ── Notification toggles ────────────────────────────────────────
  //
  // Both handlers follow the same flow: request permission ONLY at
  // the moment the user opts in, revert the toggle on denial, and
  // surface a one-line caption with an "Open Settings" link so the
  // user can recover from a prior deny without us re-prompting.

  const toggleDailyMission = async (next: boolean) => {
    if (!next) {
      // Opt-out — cancel any scheduled instance, clear the caption.
      if (dailyMissionId) await cancelNotification(dailyMissionId);
      setDailyMission({
        dailyMissionEnabled: false,
        dailyMissionIdentifier: null,
      });
      setPermissionDenied((p) => (p === 'daily' ? null : p));
      return;
    }
    const result = await ensureNotificationPermission();
    if (result !== 'granted') {
      setPermissionDenied('daily');
      return;
    }
    setPermissionDenied((p) => (p === 'daily' ? null : p));
    if (dailyMissionId) await cancelNotification(dailyMissionId);
    const id = await scheduleDailyMissionReminder(
      dailyMissionTime.hour,
      dailyMissionTime.minute,
    );
    setDailyMission({
      dailyMissionEnabled: true,
      dailyMissionIdentifier: id,
    });
  };

  const toggleWeeklyRecap = async (next: boolean) => {
    if (!next) {
      if (weeklyRecapId) await cancelNotification(weeklyRecapId);
      setWeeklyRecap({
        weeklyRecapEnabled: false,
        weeklyRecapIdentifier: null,
      });
      setPermissionDenied((p) => (p === 'weekly' ? null : p));
      return;
    }
    const result = await ensureNotificationPermission();
    if (result !== 'granted') {
      setPermissionDenied('weekly');
      return;
    }
    setPermissionDenied((p) => (p === 'weekly' ? null : p));
    if (weeklyRecapId) await cancelNotification(weeklyRecapId);
    const id = await scheduleWeeklyRecapReminder(
      weeklyRecapTime.hour,
      weeklyRecapTime.minute,
    );
    setWeeklyRecap({
      weeklyRecapEnabled: true,
      weeklyRecapIdentifier: id,
    });
  };

  /** Adjust the time on either pref. Cancels + reschedules so the OS
   *  schedule is always in sync with the stored prefs. */
  const onTimePicked = async (
    which: 'daily' | 'weekly',
    time: NotificationTime,
  ) => {
    if (which === 'daily') {
      setDailyMission({ dailyMissionTime: time });
      if (dailyMissionEnabled) {
        if (dailyMissionId) await cancelNotification(dailyMissionId);
        const id = await scheduleDailyMissionReminder(time.hour, time.minute);
        setDailyMission({ dailyMissionIdentifier: id });
      }
    } else {
      setWeeklyRecap({ weeklyRecapTime: time });
      if (weeklyRecapEnabled) {
        if (weeklyRecapId) await cancelNotification(weeklyRecapId);
        const id = await scheduleWeeklyRecapReminder(time.hour, time.minute);
        setWeeklyRecap({ weeklyRecapIdentifier: id });
      }
    }
  };

  const onTimePickerEvent = (
    which: 'daily' | 'weekly',
    _event: DateTimePickerEvent,
    selected?: Date,
  ) => {
    // Android dispatches a `set` event with the chosen date; iOS
    // fires inline as the picker scrolls. Either way we update on
    // any concrete date; user can dismiss by tapping outside the
    // sheet (we close it manually).
    setTimePicker(null);
    if (!selected) return;
    onTimePicked(which, {
      hour:   selected.getHours(),
      minute: selected.getMinutes(),
    });
  };

  const deniedCaption = (
    <View style={styles.deniedCaptionWrap}>
      <Text style={styles.deniedCaption}>
        Notification permission denied. Enable in iOS Settings to use this.
      </Text>
      <Pressable
        onPress={openSystemSettings}
        hitSlop={6}
        accessibilityRole="link"
        accessibilityLabel="Open iOS Settings"
      >
        <Text style={styles.deniedCaptionLink}>Open Settings</Text>
      </Pressable>
    </View>
  );

  function timeToDate(t: NotificationTime): Date {
    const d = new Date();
    d.setHours(t.hour, t.minute, 0, 0);
    return d;
  }

  const exportCsv = async () => {
    if (journalEntries.length === 0) {
      Alert.alert('No trades to export yet.');
      return;
    }
    const tjEntries = useTradeJournalStore.getState().entries;
    const header = [
      'Date', 'Symbol', 'Direction', 'Entry Price', 'Exit Price',
      'P&L', 'Duration', 'Grade', 'Emotions', 'Note',
    ].join(',');

    const rows = journalEntries.map((e) => {
      const tj = tjEntries[e.id];
      const dir = e.side === 'buy' ? 'LONG' : 'SHORT';
      const date = new Date(e.closedAt).toISOString();
      return [
        csvCell(date),
        csvCell(e.symbol),
        csvCell(dir),
        csvCell(e.entryPrice),
        csvCell(e.exitPrice),
        csvCell(e.pnl.toFixed(2)),
        csvCell(formatDuration(e.openedAt, e.closedAt)),
        csvCell(tj?.grade ?? ''),
        csvCell(tj?.emotions?.join('; ') ?? ''),
        csvCell(tj?.note ?? ''),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    try {
      await Share.share({
        title: 'Pocket Trade — trade history',
        message: csv,
      });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  };

  // "Reset Streak" was removed from the main Settings list — bad
  // quick-access UX (CRAFT_RESEARCH Topic 6 audit). The streak
  // store's `reset()` action still exists for QA / "Reset
  // Everything"; just no first-class shortcut.

  const redoOnboarding = () => {
    Alert.alert(
      'Redo onboarding?',
      "You'll go through onboarding again. Your trades, streak, and badges are kept.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redo',
          onPress: () => {
            useOnboardingStore.getState().setOnboardingComplete(false);
            navigation.reset({
              index: 0,
              routes: [{ name: 'OnboardingSplash' }],
            });
          },
        },
      ],
    );
  };

  const signOutUser = () => {
    Alert.alert(
      'Sign out of Pocket Trade?',
      'You can sign back in any time. Your account data is saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch {
              // Local state is cleared regardless; the auth-state
              // listener will still route to the auth screen.
            }
            // Clear local user + onboarding profile so no previous
            // user's data persists. Keep onboardingComplete = true
            // (a device-lifecycle fact, not user data) so the
            // routing guard lands on the AUTH screen, not the full
            // onboarding flow. The App onAuthStateChanged guard does
            // the navigation (no nav hack here).
            useAuthStore.getState().clearUser();
            const ob = useOnboardingStore.getState();
            ob.reset();
            ob.setOnboardingComplete(true);
          },
        },
      ],
    );
  };

  const resetEverything = () => {
    Alert.alert(
      'Reset everything?',
      'This will delete ALL your data — trades, streak, settings — and restart onboarding. This cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'Last chance — everything will be wiped.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete everything',
                  style: 'destructive',
                  onPress: () => {
                    useOnboardingStore.getState().reset();
                    useStreakStore.getState().reset();
                    useSettingsStore.getState().reset();
                    useJournalStore.getState().reset();
                    useTradeJournalStore.getState().reset();
                    useDailySetupStore.getState().reset();
                    useWatchlistStore.getState().reset();
                    useBadgeStore.getState().reset();
                    useXpStore.getState().reset();
                    useChallengeStore.getState().reset();
                    useNotificationsStore.getState().reset();
                    // Cancel any OS-side scheduled notifications too —
                    // resetting the store alone wouldn't clear what's
                    // already queued with iOS.
                    void cancelAllPocketTradeNotifications();
                    navigation.reset({
                      index: 0,
                      routes: [{ name: 'OnboardingSplash' }],
                    });
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* Header — back button only; the title now sits left-aligned
          at the top of the scroll content so it matches every other
          screen (Setup Library, Insights, Journal etc.) per §3.8. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={WHITE} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[typography.display, { color: WHITE, marginBottom: spacing.lg }]}>
          Settings
        </Text>
        {/* PROFILE */}
        <SectionHeader title="Profile" />
        <View style={styles.group}>
          {editingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={nameBuffer}
                onChangeText={setNameBuffer}
                placeholder="Display name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoFocus
                maxLength={24}
                selectionColor={GOLD}
                returnKeyType="done"
                onSubmitEditing={saveName}
              />
              <Pressable onPress={saveName} hitSlop={8}>
                <Text style={styles.editSave}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Row
              label="Display Name"
              value={displayName || 'Trader'}
              onPress={() => { setNameBuffer(displayName); setEditingName(true); }}
            />
          )}
          <Separator />
          <Row
            label="Handle"
            value={`@${handle || 'unknown'}`}
            rightAccessory={
              <View style={styles.lockRow}>
                <Ionicons name="lock-closed" size={13} color="rgba(255,255,255,0.4)" />
                <Text style={styles.lockText}>Change requires sign-in</Text>
              </View>
            }
          />
          <Separator />
          <Row
            label="Archetype"
            value={archetypeMeta?.name ?? '—'}
            rightAccessory={
              archetypeMeta ? (
                <MaterialCommunityIcons
                  name={archetypeMeta.icon}
                  size={20}
                  color={GOLD}
                />
              ) : undefined
            }
          />
          <Separator />
          <Row label="Rank" value="Gambler" />
        </View>

        {/* TRAINING */}
        <SectionHeader title="Training" />
        <View style={styles.group}>
          <Row
            label="Daily Time Goal"
            value={<NumericText style={styles.rowValue}>{`${dailyGoal} min`}</NumericText>}
            onPress={() => setPicker('goal')}
          />
          <Separator />
          <Row
            label="Daily Commitment"
            value={COMMITMENT_SHORT[dailyCommit]}
            onPress={() => setPicker('commit')}
          />
          <Separator />
          <Row
            label="Default Contract Size"
            value={<NumericText style={styles.rowValue}>{String(contractSize)}</NumericText>}
            onPress={() => setPicker('contract')}
          />
        </View>

        {/* TRADING */}
        <SectionHeader title="Trading" />
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Pre-trade checklist</Text>
              <Text style={styles.rowSublabel}>
                Show the planning card before each trade
              </Text>
            </View>
            <Switch
              value={preTradeChecklist}
              onValueChange={setPreTradeChecklist}
              trackColor={{ false: SWITCH_OFF, true: GOLD }}
              thumbColor={WHITE}
              ios_backgroundColor={SWITCH_OFF}
            />
          </View>
        </View>

        {/* NOTIFICATIONS — opt-in only, no streak notifications,
            no urgency framing. See src/lib/notifications.ts for the
            copy-review rules. */}
        <SectionHeader title="Notifications" />
        <View style={styles.group}>
          {/* Daily mission reminder */}
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Daily mission reminder</Text>
              <Text style={styles.notifSublabel}>
                We'll remind you when today's mission is ready.
              </Text>
              {dailyMissionEnabled && (
                <Pressable
                  onPress={() => setTimePicker('daily')}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Adjust daily reminder time"
                >
                  <NumericText style={styles.notifTime}>
                    {formatNotificationTime(dailyMissionTime)}
                  </NumericText>
                </Pressable>
              )}
            </View>
            <Switch
              value={dailyMissionEnabled}
              onValueChange={toggleDailyMission}
              trackColor={{ false: SWITCH_OFF, true: GOLD }}
              thumbColor={WHITE}
              ios_backgroundColor={SWITCH_OFF}
            />
          </View>
          {permissionDenied === 'daily' && deniedCaption}

          <Separator />

          {/* Weekly recap reminder */}
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Weekly recap</Text>
              <Text style={styles.notifSublabel}>
                We'll let you know when your weekly recap is ready.
              </Text>
              {weeklyRecapEnabled && (
                <Pressable
                  onPress={() => setTimePicker('weekly')}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Adjust weekly recap time"
                >
                  <NumericText style={styles.notifTime}>
                    {'Sunday '}{formatNotificationTime(weeklyRecapTime)}
                  </NumericText>
                </Pressable>
              )}
            </View>
            <Switch
              value={weeklyRecapEnabled}
              onValueChange={toggleWeeklyRecap}
              trackColor={{ false: SWITCH_OFF, true: GOLD }}
              thumbColor={WHITE}
              ios_backgroundColor={SWITCH_OFF}
            />
          </View>
          {permissionDenied === 'weekly' && deniedCaption}
        </View>

        {/* Native iOS time picker — opened by tapping a time label
            above. The day for the weekly recap is fixed to Sunday;
            only hour + minute are user-adjustable. */}
        {timePicker !== null && (
          <DateTimePicker
            value={timeToDate(
              timePicker === 'daily' ? dailyMissionTime : weeklyRecapTime,
            )}
            mode="time"
            display="spinner"
            onChange={(event, selected) =>
              onTimePickerEvent(timePicker, event, selected)
            }
          />
        )}

        {/* PREFERENCES */}
        <SectionHeader title="Preferences" />
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Haptic feedback</Text>
              <Text style={styles.rowSublabel}>
                Vibrations on trades, badges, and interactions
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={setHapticsEnabled}
              trackColor={{ false: SWITCH_OFF, true: GOLD }}
              thumbColor={WHITE}
              ios_backgroundColor={SWITCH_OFF}
            />
          </View>
        </View>

        {/* DATA */}
        <SectionHeader title="Data" />
        <View style={styles.group}>
          {/* Re-entry to the most-recent Sunday Wrap. Disabled when
              no recap has been generated yet — a faint caption
              explains why instead of just dimming the row. */}
          <Row
            label="Weekly recap"
            leftIcon="calendar-outline"
            leftIconColor="rgba(255,255,255,0.6)"
            onPress={
              latestRecap
                ? () => setOpenRecap(latestRecap)
                : undefined
            }
            value={
              latestRecap
                ? latestRecap.dateRange
                : 'No recap yet'
            }
          />
          <Separator />
          <Row
            label="Export Trades (CSV)"
            onPress={exportCsv}
            leftIcon="download-outline"
          />
          <Separator />
          <Row
            label="Redo Onboarding"
            onPress={redoOnboarding}
            leftIcon="refresh-outline"
            // Non-action list row — demote from gold to white@60%
            // per §2.2 so it doesn't compete with primary CTAs.
            leftIconColor="rgba(255,255,255,0.6)"
          />
          <Separator />
          <Row
            label="Sign Out"
            onPress={signOutUser}
            leftIcon="log-out-outline"
          />
          <Separator />
          <Row
            label="Reset Everything"
            onPress={resetEverything}
            leftIcon="trash-outline"
            leftIconColor={RED}
            destructive
          />
        </View>

        {/* ABOUT */}
        <SectionHeader title="About" />
        <View style={styles.group}>
          <Row
            label="Version"
            value={
              <Text style={styles.rowValue}>
                {APP_NAME}{' '}
                <NumericText style={styles.rowValue}>v{APP_VERSION}</NumericText>
              </Text>
            }
          />
          <Separator />
          <Row
            label="Support"
            value={SUPPORT_EMAIL}
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=Pocket%20Trade%20Support`,
              ).catch(() => {})
            }
          />
          <Separator />
          <Row
            label="Terms of Service"
            onPress={() => console.log('[settings] Tap: Terms of Service (TODO: wire link)')}
          />
          <Separator />
          <Row
            label="Privacy Policy"
            onPress={() => console.log('[settings] Tap: Privacy Policy (TODO: wire link)')}
          />
        </View>
      </ScrollView>

      {/* Weekly recap re-entry modal — opened from the "Weekly
          recap" row above. Wired identically to the Home banner
          modal so deep-link CTAs (best/worst trade, open lesson,
          start session) route back through this navigator. */}
      <WeeklyRecapModal
        visible={openRecap !== null}
        recap={openRecap}
        onClose={() => setOpenRecap(null)}
        onOpenTrade={(tradeId) => {
          setOpenRecap(null);
          navigation.navigate('Main', {
            screen: 'Journal',
            params: { openEntryId: tradeId },
          });
        }}
        onOpenLesson={(setupId) => {
          setOpenRecap(null);
          navigation.navigate('SetupDetail', { setupId });
        }}
        onStartSession={() => {
          setOpenRecap(null);
          navigation.navigate('Chart');
        }}
      />

      {/* Select modals */}
      <SelectModal
        visible={picker === 'goal'}
        title="Daily Time Goal"
        options={TIME_GOAL_OPTIONS}
        current={dailyGoal}
        onSelect={(v) => { setDailyGoal(v as number); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <SelectModal
        visible={picker === 'commit'}
        title="Daily Commitment"
        options={COMMITMENT_OPTIONS}
        current={dailyCommit}
        onSelect={(v) => { setDailyCommit(v as DailyCommitment); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <SelectModal
        visible={picker === 'contract'}
        title="Default Contract Size"
        options={CONTRACT_OPTIONS}
        current={contractSize}
        onSelect={(v) => { setContractSize(v as number); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

/** lucide isn't installed — map each section to an @expo glyph. */
const SETTINGS_ICON: Record<string, React.ReactNode> = {
  Profile:     <Ionicons name="person-outline" size={13} color={ST.textTertiary} />,
  Training:    <Ionicons name="barbell-outline" size={13} color={ST.textTertiary} />,
  Trading:     <Ionicons name="trending-up" size={13} color={ST.textTertiary} />,
  Preferences: <Ionicons name="options-outline" size={13} color={ST.textTertiary} />,
  Data:        <MaterialCommunityIcons name="database" size={13} color={ST.textTertiary} />,
  About:       <Ionicons name="information-circle-outline" size={13} color={ST.textTertiary} />,
};

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <DSSectionHeader
        title={title}
        variant="eyebrow"
        icon={SETTINGS_ICON[title]}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

interface RowProps {
  label: string;
  /** Either a plain string (default Text rendering) or a ReactNode
   *  for callers that want JBM-mono numerals via <NumericText>. */
  value?: string | React.ReactNode;
  onPress?: () => void;
  leftIcon?: React.ComponentProps<typeof Ionicons>['name'];
  leftIconColor?: string;
  rightAccessory?: React.ReactNode;
  destructive?: boolean;
}

function Row({
  label, value, onPress, leftIcon, leftIconColor, rightAccessory, destructive,
}: RowProps) {
  const content = (
    <View style={styles.row}>
      {leftIcon && (
        <Ionicons
          name={leftIcon}
          size={18}
          color={leftIconColor ?? (destructive ? RED : WHITE)}
          style={styles.rowLeftIcon}
        />
      )}
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {rightAccessory}
      {value != null && (
        typeof value === 'string'
          ? <Text style={styles.rowValue}>{value}</Text>
          : <View style={styles.rowValueWrap}>{value}</View>
      )}
      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color="rgba(255,255,255,0.3)"
          style={styles.rowChevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

interface SelectOption { label: string; value: string | number; }

function SelectModal({
  visible, title, options, current, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: SelectOption[];
  current: string | number;
  onSelect: (v: string | number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          {options.map((opt) => {
            const selected = opt.value === current;
            return (
              <Pressable
                key={String(opt.value)}
                onPress={() => onSelect(opt.value)}
                style={({ pressed }) => [
                  styles.modalOption,
                  selected && styles.modalOptionSelected,
                  pressed && !selected && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selected && styles.modalOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={20} color={GOLD} />
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  sectionHeader: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 24,
    marginBottom: 10,
  },
  group: {
    backgroundColor: '#0F0F0F',
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  separator: {
    height: 1,
    // Hairline divider — borders.hairline in the layered surface
    // system. Lighter than the old card-border value so list rows
    // feel grouped rather than fenced.
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 16,
  },

  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  // Notification rows are taller than the basic Row because they
  // stack a sublabel + optional time line under the main label.
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  notifSublabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    lineHeight: 16,
  },
  // User-chosen time — tappable to re-open the picker. White@70%
  // per the spec.
  notifTime: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.70)',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  deniedCaptionWrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  deniedCaption: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  deniedCaptionLink: {
    marginTop: 4,
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  rowLeftIcon: { marginRight: 12 },
  rowLabel: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '500',
  },
  rowLabelDestructive: { color: RED },
  rowSublabel: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '400',
  },
  rowValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
  rowValueWrap: {},
  rowChevron: { marginLeft: 8 },

  lockRow: { flexDirection: 'row', alignItems: 'center' },
  lockText: {
    marginLeft: 5,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '500',
  },

  // Inline display-name edit
  editRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  editInput: {
    flex: 1,
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  editSave: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 12,
  },

  // Select modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  modalTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(255,184,0,0.10)',
  },
  modalOptionText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
  },
  modalOptionTextSelected: { color: GOLD },
});
