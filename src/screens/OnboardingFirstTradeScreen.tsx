import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';

/**
 * Onboarding screen 9 — First Trade activation event — PLACEHOLDER.
 *
 * This is the big one. Real content lands in the next prompt. For
 * now we just verify Daily Commitment → Continue lands here.
 */

const BG = '#000000';

export default function OnboardingFirstTradeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Text style={styles.text}>Screen 9 placeholder</Text>
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
