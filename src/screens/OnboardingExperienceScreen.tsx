import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, ExperienceLevel } from '../store/onboardingStore';

/**
 * Onboarding screen 5 — Experience level (calibration).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md: drives first-replay
 * difficulty, default contract size, and tooltip frequency. Same
 * card pattern as screen 4 (identity).
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const CTA_DISABLED_BG = '#2A2A2A';

interface ExperienceOption {
  id: ExperienceLevel;
  title: string;
  description: string;
}

const EXPERIENCE_OPTIONS: ExperienceOption[] = [
  {
    id: 'never',
    title: 'Never traded',
    description: "I'm here to learn before I risk anything.",
  },
  {
    id: 'beginner',
    title: 'Beginner',
    description: 'Less than 6 months in.',
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: '6 months to 2 years.',
  },
  {
    id: 'experienced',
    title: 'Experienced',
    description: '2+ years. I have a system.',
  },
];

interface Props {
  navigation: any;
}

function ExperienceCard({
  option, selected, onPress,
}: { option: ExperienceOption; selected: boolean; onPress: () => void }) {
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

export default function OnboardingExperienceScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);

  const [selectedId, setSelectedId] = useState<ExperienceLevel | null>(null);
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

  const handleSelect = (id: ExperienceLevel) => {
    if (id === selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedId(id);
  };

  const handleContinue = () => {
    if (!selectedId) return;
    setExperienceLevel(selectedId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingAccountSize');
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
          <Text style={styles.headline}>How long have you been trading?</Text>

          <View style={styles.cards}>
            {EXPERIENCE_OPTIONS.map((opt, idx) => (
              <View key={opt.id} style={idx > 0 ? styles.cardGap : null}>
                <ExperienceCard
                  option={opt}
                  selected={selectedId === opt.id}
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
    backgroundColor: BG,
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
