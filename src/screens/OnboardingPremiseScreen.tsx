import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

/**
 * Onboarding screen 2 — The Premise.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md §D2 (fear-naming /
 * trust-building): be honest about how hard trading is. Competitors
 * won't say this; we do.
 *
 * Pure black background, white bold headline, regular-weight body for
 * visual hierarchy. Single gold CTA. No back button. 400 ms fade-in,
 * no other motion.
 */

const BG = '#000000';
const FADE_IN_MS = 400;

interface Props {
  navigation: any;
}

export default function OnboardingPremiseScreen({ navigation }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingArchetype');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <Animated.View style={[styles.content, { opacity }]}>
        <Text style={styles.headline}>
          95% of new traders blow their account in their first year.
        </Text>
        <View style={styles.headlineToBodyGap} />
        <Text style={styles.body}>
          You're not weak for being nervous. You're smart.
        </Text>
        <View style={styles.bodyGap} />
        <Text style={styles.body}>
          Pocket Trade is where you fail 1,000 times — without losing a dollar.
        </Text>
      </Animated.View>

      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel="I'm in"
        >
          <Text style={styles.ctaText}>I'm in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 41,        // ~1.2× — tighter, headline-appropriate
    letterSpacing: -0.5,
  },
  headlineToBodyGap: { height: 28 },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 19,
    fontWeight: '400',      // regular weight by design — creates hierarchy under bold headline
    lineHeight: 27,         // ~1.4× per spec
  },
  bodyGap: { height: 18 },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  cta: {
    backgroundColor: '#FFB800',
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
