import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore } from '../store/onboardingStore';

/**
 * Onboarding screen 12 — Welcome + daily training time goal.
 *
 * Final onboarding screen. Hand-off to `MainTabs`.
 *
 * The user picks a daily training time goal (minutes/day). Hitting
 * the goal in a day increments their streak; missing a day applies
 * a Streak Freeze (deferred streak-system follow-up) — copy here
 * promises the forgiveness model rather than the punitive
 * reset-to-zero one. Streak counter + dashboard display + actual
 * time tracking + freeze inventory are all follow-ups.
 */

import { DailyCommitment } from '../store/onboardingStore';

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const CHIP_BG     = '#1A1A1A';
const CHIP_BORDER = '#2A2A2A';

// 5 options post-audit ("3+ hours" dropped — outlier, almost no one
// picks it). Rendered as a single vertical stack.
const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 15,  label: '15 min'  },
  { value: 30,  label: '30 min'  },
  { value: 60,  label: '60 min'  },
  { value: 90,  label: '90 min'  },
  { value: 120, label: '2 hours' },
];

// Subheadline copy linked to the user's screen-8 pick. The two
// captures (frequency on screen 8 + duration here) read as one
// coherent contract rather than two disconnected questions.
const SUBHEAD_BY_COMMITMENT: Record<DailyCommitment, string> = {
  light:  "You're training 3 days a week. How long should each session be?",
  steady: "You're training once a day. How long should each session be?",
  pro:    "You're training multiple times a day. How long should each session be?",
};
const SUBHEAD_FALLBACK = 'How long should each training session be?';

interface Props {
  navigation: any;
}

function TimeChip({
  option, selected, onPress,
}: { option: { value: number; label: string }; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && !selected && styles.chipPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={option.label}
      accessibilityState={{ selected }}
    >
      <Text style={styles.chipText}>{option.label}</Text>
    </Pressable>
  );
}

export default function OnboardingWelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const dailyTimeGoalMinutes  = useOnboardingStore((s) => s.dailyTimeGoalMinutes);
  const dailyCommitment       = useOnboardingStore((s) => s.dailyCommitment);
  const setDailyTimeGoal      = useOnboardingStore((s) => s.setDailyTimeGoal);
  const setOnboardingComplete = useOnboardingStore((s) => s.setOnboardingComplete);

  const subheadText = dailyCommitment
    ? SUBHEAD_BY_COMMITMENT[dailyCommitment]
    : SUBHEAD_FALLBACK;

  // Staggered fade-ins.
  const headOp   = useRef(new Animated.Value(0)).current;
  const subOp    = useRef(new Animated.Value(0)).current;
  const cardOp   = useRef(new Animated.Value(0)).current;
  const buttonOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]);
    Animated.parallel([
      fadeIn(headOp,   0),
      fadeIn(subOp,    200),
      fadeIn(cardOp,   400),
      fadeIn(buttonOp, 600),
    ]).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (value: number) => {
    if (value === dailyTimeGoalMinutes) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDailyTimeGoal(value);
  };

  const handleEnter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setOnboardingComplete(true);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
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
          {subheadText}
        </Animated.Text>

        <Animated.View style={[styles.card, { opacity: cardOp }]}>
          <Text style={styles.cardLabel}>DAILY TRAINING GOAL</Text>

          <View style={styles.chipsStack}>
            {TIME_OPTIONS.map((opt) => (
              <TimeChip
                key={opt.value}
                option={opt}
                selected={dailyTimeGoalMinutes === opt.value}
                onPress={() => handleSelect(opt.value)}
              />
            ))}
          </View>

          <Text style={styles.cardBody}>
            Hit your goal → +1 to your streak. Miss a day → a Streak Freeze protects it automatically.
          </Text>
          <Text style={styles.cardBodyDim}>
            You start with 2 freezes.
          </Text>
        </Animated.View>

        {/* Streak teaser — small gold spark + line below the card.
            Intentionally NOT a StreakBadge with "0" here; a literal
            zero feels deflating right before the user enters the app
            for the first time. */}
        <Animated.View style={[styles.teaserRow, { opacity: buttonOp }]}>
          <MaterialCommunityIcons
            name="lightning-bolt"
            size={16}
            color={GOLD}
            style={styles.teaserIcon}
          />
          <Text style={styles.teaserText}>Your streak starts today.</Text>
        </Animated.View>
      </ScrollView>

      <Animated.View
        style={[
          styles.ctaWrap,
          { paddingBottom: Math.max(insets.bottom, 16), opacity: buttonOp },
        ]}
      >
        <Pressable
          onPress={handleEnter}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel="Enter app"
        >
          <Text style={styles.ctaText}>Enter app</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
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
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Goal card
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
  cardBody: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  cardBodyDim: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },

  // Streak teaser — small gold spark + muted line between the card
  // and the CTA. Deliberately fine-print weight; a literal "0"-count
  // StreakBadge here would read as deflating right before the user
  // enters the app.
  teaserRow: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserIcon: {
    marginRight: 6,
  },
  teaserText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // Chips — single vertical stack, full-width
  chipsStack: {
    marginTop: 14,
    gap: 10,
  },
  chip: {
    height: 56,
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: GOLD,
    borderWidth: 2,
    // (height stays fixed; the extra 1 px of border is absorbed into
    // the centered content area, so the row doesn't jump on selection.)
  },
  chipPressed: { opacity: 0.85 },
  chipText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },

  // CTA
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
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
