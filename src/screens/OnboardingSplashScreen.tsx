import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 1 — logo splash.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md (D1): no cinematic intro,
 * 1.5 s branded splash, auto-advance to screen 2, NOT skippable (too
 * fast to justify a skip button). Logo fades in over ~300 ms.
 */

const ONBOARDING_BG = '#0A0E1A';   // Pocket Trade brand dark (per onboarding spec)
const SPLASH_DURATION_MS = 1500;
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
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: { width: 240, height: 240 },
});
