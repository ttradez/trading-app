import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useOnboardingStore, DailyCommitment,
} from '../store/onboardingStore';

/**
 * MOCK permission ask — simulates the iOS/Android system prompt with
 * a 300 ms delay and always resolves to `granted = true`. The real
 * permission flow lives in the deferred Firebase wire-up follow-up
 * (along with actual daily-notification scheduling against the
 * stored `preferredReminderTime`). Keeping a function shape that
 * matches `Notifications.requestPermissionsAsync()` so the call site
 * doesn't have to change when the real call replaces this one.
 */
const mockRequestNotificationPermission = (): Promise<boolean> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(true), 300);
  });

/**
 * Onboarding screen 12 — Welcome + notifications opt-in.
 *
 * Final onboarding screen and the hand-off to the main app. Per
 * docs/ONBOARDING_RETENTION_RESEARCH.md the notification opt-in goes
 * HERE (not earlier) — user has experienced value (first trade +
 * badge + rank reveal), is motivated, and hasn't left the app.
 * Optimal moment.
 *
 * Frames the ask in terms of the user's own commitment from screen 8
 * ("You said you'd train every day. We'll help you keep your word.")
 * rather than as a generic permission prompt.
 *
 * Either button (Enable reminders / Skip) marks onboarding complete
 * and resets the navigation stack to `Main` so the user lands on the
 * home screen and can't navigate back into onboarding.
 */

const BG    = '#000000';
const GOLD  = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';

// Quick-list of reminder times. Avoids the heavyweight native
// date/time picker (which would need @react-native-community/datetimepicker
// and a dev-client rebuild — not Expo Go compatible by default). Covers
// the realistic spread of when traders might want a daily reminder.
const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: '06:00', label: '6:00 AM'  },
  { value: '07:00', label: '7:00 AM'  },
  { value: '08:00', label: '8:00 AM'  },
  { value: '09:00', label: '9:00 AM'  },
  { value: '10:00', label: '10:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '17:00', label: '5:00 PM'  },
  { value: '19:00', label: '7:00 PM'  },
  { value: '21:00', label: '9:00 PM'  },
];

const COMMITMENT_PHRASE: Record<DailyCommitment, string> = {
  light:  'three days a week',
  steady: 'every day',
  pro:    'every day, sometimes twice',
};

function formatTime(value: string): string {
  const opt = TIME_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

interface Props {
  navigation: any;
}

export default function OnboardingWelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const dailyCommitment        = useOnboardingStore((s) => s.dailyCommitment);
  const preferredReminderTime  = useOnboardingStore((s) => s.preferredReminderTime);
  const setNotifications       = useOnboardingStore((s) => s.setNotifications);
  const setOnboardingComplete  = useOnboardingStore((s) => s.setOnboardingComplete);

  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Staggered fade-ins.
  const headOp    = useRef(new Animated.Value(0)).current;
  const subOp     = useRef(new Animated.Value(0)).current;
  const cardOp    = useRef(new Animated.Value(0)).current;
  const buttonsOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]);
    Animated.parallel([
      fadeIn(headOp,    0),
      fadeIn(subOp,     200),
      fadeIn(cardOp,    400),
      fadeIn(buttonsOp, 600),
    ]).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToMain = () => {
    setOnboardingComplete(true);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Mock for v1 — real permission ask lands with the Firebase
    // follow-up. Always resolves granted=true so the user perceives
    // notifications as enabled; actual OS permission gets re-asked
    // when the real notification module wires in.
    const granted = await mockRequestNotificationPermission();
    setNotifications(granted, preferredReminderTime);
    goToMain();
  };

  const handleSkip = () => {
    if (busy) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNotifications(false, preferredReminderTime);
    goToMain();
  };

  const handlePickTime = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Update the displayed time immediately — actual `notificationsEnabled`
    // flips on the Enable tap (which uses this updated time).
    setNotifications(false, value);
    setTimeModalOpen(false);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text style={[styles.headline, { opacity: headOp }]}>
          You're in.
        </Animated.Text>

        <Animated.Text style={[styles.subheadline, { opacity: subOp }]}>
          You said you'd train {COMMITMENT_PHRASE[dailyCommitment]}. We'll help you keep your word.
        </Animated.Text>

        <Animated.View style={[styles.card, { opacity: cardOp }]}>
          <Text style={styles.cardLabel}>DAILY TRAINING REMINDER</Text>
          <Text style={styles.cardTime}>{formatTime(preferredReminderTime)}</Text>
          <Pressable
            onPress={() => setTimeModalOpen(true)}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
            style={styles.changeTimeWrap}
            accessibilityRole="button"
            accessibilityLabel="Change reminder time"
          >
            <Text style={styles.changeTimeText}>Change time</Text>
          </Pressable>
          <Text style={styles.cardBody}>
            We'll send one notification a day at your chosen time. You can change it anytime in settings.
          </Text>
        </Animated.View>
      </ScrollView>

      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 16), opacity: buttonsOp },
        ]}
      >
        <Pressable
          onPress={handleEnable}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            busy && styles.ctaDisabled,
            !busy && pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enable reminders and enter"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.ctaText}>Enable reminders and enter</Text>
        </Pressable>

        <Pressable
          onPress={handleSkip}
          disabled={busy}
          hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}
          style={styles.skipWrap}
          accessibilityRole="button"
          accessibilityLabel="Skip reminders for now"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.skipText}>Skip reminders for now</Text>
        </Pressable>
      </Animated.View>

      {/* Time-picker modal */}
      <Modal
        visible={timeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setTimeModalOpen(false)}
        >
          <Pressable style={styles.modalCard} onPress={() => { /* swallow inner taps */ }}>
            <Text style={styles.modalTitle}>Reminder time</Text>
            <View style={styles.modalList}>
              {TIME_OPTIONS.map((opt) => {
                const selected = opt.value === preferredReminderTime;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handlePickTime(opt.value)}
                    style={({ pressed }) => [
                      styles.modalOption,
                      selected && styles.modalOptionActive,
                      pressed && !selected && styles.modalOptionPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      selected && styles.modalOptionTextActive,
                    ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'stretch',
  },

  headline: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  subheadline: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,    // ~1.5×
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Notification card
  card: {
    marginTop: 32,
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  cardTime: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  changeTimeWrap: { alignSelf: 'flex-start', marginTop: 4 },
  changeTimeText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  cardBody: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },

  // CTA + skip
  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: BG,
  },
  cta: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.55 },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  skipWrap: { alignSelf: 'center', marginTop: 16 },
  skipText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },

  // Time modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#0F0F0F',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: '85%',
    maxWidth: 360,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
    paddingVertical: 6,
    marginBottom: 6,
  },
  modalList: {
    gap: 4,
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalOptionActive: {
    backgroundColor: '#1A1A1A',
    borderColor: GOLD,
    borderWidth: 1,
  },
  modalOptionPressed: { opacity: 0.7 },
  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  modalOptionTextActive: {
    color: GOLD,
    fontWeight: '800',
  },
});
