import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 11 — Save your progress (deferred-auth moment) —
 * PLACEHOLDER.
 *
 * Real content lands in the next prompt. Per the retention research,
 * this is the biggest single retention lift in the funnel — the user
 * has earned a badge + seen their progression, and is now asked to
 * save it.
 */

const BG = '#000000';

export default function OnboardingAuthScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 11 placeholder</Text>
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
