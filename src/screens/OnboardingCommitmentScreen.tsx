import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, DailyCommitment } from '../store/onboardingStore';

/**
 * Onboarding screen 8 — Daily commitment (Light / Steady / Pro).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md: habit-anchor screen. The
 * chosen cadence sets the user's streak target (and later, the
 * cadence of any notifications). Middle option pre-selected per
 * Duolingo — aspirational nudge; user can downgrade if it feels heavy.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';

interface CommitmentOption {
  id: DailyCommitment;
  title: string;
  description: string;
}

const OPTIONS: CommitmentOption[] = [
  {
    id: 'light',
    title: 'Light',
    description: '3 sessions a week. Build the habit without overcommitting.',
  },
  {
    id: 'steady',
    title: 'Steady',
    description: 'One session a day. Steady reps build pattern recognition.',
  },
  {
    id: 'pro',
    title: 'Pro',
    description: "Multiple sessions a day. You're treating this like a job.",
  },
];

interface Props {
  navigation: any;
}

function CommitmentCard({
  option, selected, onPress,
}: { option: CommitmentOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      accessibilityState={{ selected }}
    >
      <Text style={styles.cardTitle}>{option.title}</Text>
      <Text style={styles.cardDescription}>{option.description}</Text>
    </Pressable>
  );
}

export default function OnboardingCommitmentScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const dailyCommitment    = useOnboardingStore((s) => s.dailyCommitment);
  const setDailyCommitment = useOnboardingStore((s) => s.setDailyCommitment);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // mount-once fade-in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: DailyCommitment) => {
    if (id === dailyCommitment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDailyCommitment(id);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingFirstTrade');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <Animated.View style={[styles.fader, { opacity }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <Text style={styles.headline}>How often will you train?</Text>
          <Text style={styles.subheadline}>
            Streaks build skill. Pick a pace you'll actually stick to.
          </Text>

          <View style={styles.cards}>
            {OPTIONS.map((opt, idx) => (
              <View key={opt.id} style={idx > 0 ? styles.cardGap : null}>
                <CommitmentCard
                  option={opt}
                  selected={dailyCommitment === opt.id}
                  onPress={() => handleSelect(opt.id)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  fader: { flex: 1 },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  headline: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  cards: { marginTop: 32 },
  cardGap: { marginTop: 12 },

  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  cardSelected: {
    backgroundColor: CARD_BG_SEL,
    borderColor: GOLD,
    borderWidth: 2,
    paddingHorizontal: 17,
    paddingVertical: 15,
  },
  cardPressed: { opacity: 0.85 },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 27,
  },
  cardDescription: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

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
