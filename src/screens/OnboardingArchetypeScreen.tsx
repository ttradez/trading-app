import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 3 — Archetype Quiz — PLACEHOLDER.
 *
 * Real content lands in the next prompt. For now we just verify
 * The Premise → here flow works on tap of the "I'm in" CTA.
 */

const BG = '#000000';

export default function OnboardingArchetypeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 3 placeholder</Text>
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
