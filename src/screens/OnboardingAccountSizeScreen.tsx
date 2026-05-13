import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 6 — Account size — PLACEHOLDER.
 *
 * Real content lands in the next prompt ($10K / $25K / $50K / $100K /
 * $150K, $50K default). For now just verifies Experience → Continue
 * navigates here cleanly.
 */

const BG = '#000000';

export default function OnboardingAccountSizeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 6 placeholder</Text>
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
