import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar } from 'react-native';

import Logo from '../components/brand/Logo';

/**
 * Onboarding screen 1 — logo splash.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md (D1) + ONBOARDING_AUDIT.md
 * follow-up: brief brand flash, auto-advance to screen 2, NOT
 * skippable (too fast to justify a skip button). Logo fades in over
 * ~300 ms. Hold time tuned to 900 ms — long enough to register the
 * logo, short enough to feel like a quick flash rather than a wait.
 */

const ONBOARDING_BG = '#000000';   // Pip brand — pure black (locked 2026-05-12)
const SPLASH_DURATION_MS = 900;
const FADE_IN_MS = 300;

interface Props {
  navigation: any;
}

export default function OnboardingSplashScreen({ navigation }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_IN_MS,
      useNativeDriver: true,
    }).start();

    const t = setTimeout(() => {
      navigation.replace('OnboardingPremise');
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(t);
    // navigation + opacity refs are stable; intentional empty-deps mount-only effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={ONBOARDING_BG} />
      <Animated.View style={{ opacity }}>
        <Logo width={240} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ONBOARDING_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
