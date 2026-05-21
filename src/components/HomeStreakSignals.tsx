import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SnowflakeIcon } from 'phosphor-react-native';

import { useStreakStore } from '../store/streakStore';
import { colors } from '../theme';

/**
 * Home-only streak loss-aversion signals (CRAFT_RESEARCH Topic 6).
 * Two distinct pieces, kept in one file because they share the
 * "quiet positive framing" treatment:
 *
 *  • FreezeConsumedToast — small bottom snackbar that appears on
 *    Home mount when a freeze was used yesterday to save the
 *    streak. Auto-dismisses; tap-acknowledges immediately.
 *  • AtRiskChip — minimal one-line chip rendered below the header
 *    when the user hasn't logged a session today, local time is
 *    past 18:00, and the streak is > 0. Tap dismisses for the
 *    current app session.
 *
 * Both use brand tokens only — no red / orange / warning colors,
 * no urgency-coercion language, no "lost / broken / dying" copy.
 */

const WHITE = colors.textPrimary;

// ── At-risk chip — session-level dismissal flag ────────────────────

let CHIP_DISMISSED_THIS_SESSION = false;

export function AtRiskChip() {
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const lastCompletedDate = useStreakStore((s) => s.lastCompletedDate);
  const [dismissed, setDismissed] = useState(CHIP_DISMISSED_THIS_SESSION);
  const [now, setNow] = useState(() => new Date());

  // Tick once a minute so the chip can disappear right as the user
  // logs their session, and appear right at 18:00.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (dismissed) return null;
  if (currentStreak <= 0) return null;
  if (now.getHours() < 18) return null;

  const today = ymd(now);
  if (lastCompletedDate === today) return null; // already done today

  const onDismiss = () => {
    CHIP_DISMISSED_THIS_SESSION = true;
    setDismissed(true);
  };

  return (
    <Pressable
      onPress={onDismiss}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={`Continue your ${currentStreak}-day streak today`}
    >
      <Ionicons
        name="time-outline"
        size={14}
        color="rgba(255,255,255,0.7)"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.chipText} numberOfLines={1}>
        Continue your {currentStreak}-day streak today
      </Text>
    </Pressable>
  );
}

// ── Freeze-consumed toast ──────────────────────────────────────────

const TOAST_HOLD_MS  = 4000;
const TOAST_FADE_MS  = 220;

export function FreezeConsumedToast() {
  const notice = useStreakStore((s) => s.freezeConsumedNotice);
  const ack = useStreakStore((s) => s.acknowledgeFreezeUsed);

  const opacity = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);
  const ackRef = useRef(ack);
  ackRef.current = ack;

  useEffect(() => {
    if (!notice) return;
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: TOAST_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const holdId = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: TOAST_FADE_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        ackRef.current();
      });
    }, TOAST_HOLD_MS);

    return () => clearTimeout(holdId);
  }, [notice, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.toastWrap, { opacity }]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <SnowflakeIcon
          size={14}
          weight="fill"
          color="rgba(255,255,255,0.85)"
        />
        <Text style={styles.toastText}>
          Your streak was saved by a freeze yesterday.
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Snowflake glyph for the header (only when a freeze is held) ───

export function HeaderFreezeIndicator() {
  const freezesAvailable = useStreakStore((s) => s.freezesAvailable);
  if (freezesAvailable < 1) return null;
  return (
    <SnowflakeIcon
      size={14}
      weight="fill"
      color="rgba(255,255,255,0.7)"
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────

function ymd(d: Date): string {
  const p = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ── Styles ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // At-risk chip — no background, no border, no warning color.
  chip: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  chipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },

  // Freeze toast — absolutely positioned at the bottom of the
  // scroll content's parent.
  toastWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#141414',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '500',
  },
});
