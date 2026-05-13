import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useOnboardingStore, Identity, GoalCategory,
} from '../store/onboardingStore';

/**
 * Onboarding screen 4 — Identity selection (Atomic Habits framing).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md: highest-leverage retention
 * move per James Clear — identity-based habits beat outcome-based
 * habits if the identity gets reinforced with small wins. The chosen
 * identity also maps to a goal category that drives later coaching
 * tips, push copy, and personalized challenges.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const CTA_DISABLED_BG = '#2A2A2A';

interface IdentityOption {
  id: Identity;
  title: string;
  description: string;
  goal: GoalCategory;
}

const IDENTITIES: IdentityOption[] = [
  {
    id: 'patient_sniper',
    title: 'The Patient Sniper',
    description: "You wait for A+ setups. Most of the day, you're not in a trade. When you strike, it counts.",
    goal: 'psychology',
  },
  {
    id: 'process_machine',
    title: 'The Process Machine',
    description: 'Same setup, same size, same risk, every time. Your edge is showing up exactly the same way every day.',
    goal: 'consistency',
  },
  {
    id: 'risk_surgeon',
    title: 'The Risk Surgeon',
    description: 'You manage risk like a surgeon manages a scalpel. Tight stops, exact sizing, never bleeds out.',
    goal: 'risk',
  },
  {
    id: 'calm_operator',
    title: 'The Calm Operator',
    description: "Losses don't shake you. Wins don't inflate you. Your edge is steady nerves when everyone else is panicking.",
    goal: 'psychology',
  },
  {
    id: 'profit_compounder',
    title: 'The Profit Compounder',
    description: 'You play the long game. Steady gains, reinvested. Your edge is patience with capital growth.',
    goal: 'profitability',
  },
];

interface Props {
  navigation: any;
}

function IdentityCard({
  option, selected, onPress,
}: { option: IdentityOption; selected: boolean; onPress: () => void }) {
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

export default function OnboardingIdentityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setIdentity = useOnboardingStore((s) => s.setIdentity);

  const [selectedId, setSelectedId] = useState<Identity | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: Identity) => {
    if (id === selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedId(id);
  };

  const handleContinue = () => {
    if (!selectedId) return;
    const chosen = IDENTITIES.find((o) => o.id === selectedId);
    if (!chosen) return;
    setIdentity(chosen.id, chosen.goal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingExperience');
  };

  const ctaEnabled = selectedId !== null;

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
          <Text style={styles.headline}>Who do you want to BECOME?</Text>
          <Text style={styles.subheadline}>
            Pick the identity you're working toward. Not what you are today.
          </Text>

          <View style={styles.cards}>
            {IDENTITIES.map((opt, idx) => (
              <View key={opt.id} style={idx > 0 ? styles.cardGap : null}>
                <IdentityCard
                  option={opt}
                  selected={selectedId === opt.id}
                  onPress={() => handleSelect(opt.id)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* CTA — anchored at bottom, gated by selection. */}
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!ctaEnabled}
          style={({ pressed }) => [
            styles.cta,
            !ctaEnabled && styles.ctaDisabled,
            ctaEnabled && pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !ctaEnabled }}
        >
          <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextDisabled]}>
            Continue
          </Text>
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
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  cards: { marginTop: 28 },
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
    // Compensate paddings so the layout doesn't jump when border grows
    paddingHorizontal: 17,
    paddingVertical: 15,
  },
  cardPressed: { opacity: 0.85 },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 26,
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
    paddingTop: 16,
    backgroundColor: BG, // hide ScrollView content peeking behind on overscroll
  },
  cta: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: CTA_DISABLED_BG },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaTextDisabled: { color: 'rgba(255,255,255,0.5)' },
});
