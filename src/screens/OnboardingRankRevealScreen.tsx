import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 10 — Rank reveal + badge ceremony — PLACEHOLDER.
 *
 * Real content lands in the next prompt. For now just verifies the
 * First Trade result Continue lands here cleanly.
 */

const BG = '#000000';

export default function OnboardingRankRevealScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 10 placeholder</Text>
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
