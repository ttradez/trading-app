import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 2 — premise — PLACEHOLDER.
 *
 * Real content lands in the next prompt. For now we just verify the
 * splash auto-advances here cleanly.
 */

const ONBOARDING_BG = '#0A0E1A';

export default function OnboardingPremiseScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={ONBOARDING_BG} />
      <Text style={styles.text}>Screen 2 placeholder</Text>
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
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
