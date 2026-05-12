import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 4 — Identity selection ("Who do you want to
 * BECOME?") — PLACEHOLDER.
 *
 * Real content lands in the next prompt. For now we just verify the
 * archetype reveal's "Continue" CTA lands here cleanly.
 */

const BG = '#000000';

export default function OnboardingIdentityScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 4 placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
