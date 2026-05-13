import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore } from '../store/onboardingStore';

/**
 * Onboarding screen 6 — Select your evaluation account.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md Q4: prop-firm "evaluation
 * account" framing, preset chips matching Apex / Topstep canonical
 * sizes. Choices constrained to the 5 tiers — no custom input, so the
 * user can't pick an unrealistic number. Default $50K (most common
 * Combine size; teaches realistic position sizing).
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';

interface PresetOption {
  value: number;
  description: string;
}

const PRESETS: PresetOption[] = [
  { value: 10_000,  description: 'Small. Tight position sizes. Best for testing strategies.' },
  { value: 25_000,  description: "Beginner-friendly. Apex's smallest tier." },
  { value: 50_000,  description: 'The most common starter. Balanced risk.' },
  { value: 100_000, description: 'Larger size. More room to breathe.' },
  { value: 150_000, description: 'Maximum prop-firm tier. Serious size.' },
];

function formatUSD(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

interface Props {
  navigation: any;
}

function PresetCard({
  option, selected, onPress,
}: { option: PresetOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${formatUSD(option.value)} account`}
      accessibilityState={{ selected }}
    >
      <Text style={styles.cardAmount}>{formatUSD(option.value)}</Text>
      <Text style={styles.cardDescription}>{option.description}</Text>
    </Pressable>
  );
}

export default function OnboardingAccountSizeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const accountSize    = useOnboardingStore((s) => s.accountSize);
  const setAccountSize = useOnboardingStore((s) => s.setAccountSize);

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

  const handleSelectPreset = (value: number) => {
    if (value === accountSize) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAccountSize(value);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingTraderName');
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
          <Text style={styles.headline}>Select your evaluation account</Text>
          <Text style={styles.subheadline}>
            This is your starting balance. You can practice as much as you want
            with it — losses don't follow you home.
          </Text>

          <View style={styles.cards}>
            {PRESETS.map((opt, idx) => (
              <View key={opt.value} style={idx > 0 ? styles.cardGap : null}>
                <PresetCard
                  option={opt}
                  selected={accountSize === opt.value}
                  onPress={() => handleSelectPreset(opt.value)}
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
    fontSize: 31,
    fontWeight: '700',
    lineHeight: 38,
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

  cards: { marginTop: 24 },
  cardGap: { marginTop: 10 },

  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardSelected: {
    backgroundColor: CARD_BG_SEL,
    borderColor: GOLD,
    borderWidth: 2,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  cardPressed: { opacity: 0.85 },
  cardAmount: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  cardDescription: {
    marginTop: 4,
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
