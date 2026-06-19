import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import JourneyRoad from '../components/JourneyRoad';

/**
 * Rank Journey — standalone stack-route variant. The trophy-road
 * body lives in `JourneyRoad` (shared with the Ranks tab's Journey
 * sub-tab); this screen wraps it in the back-arrow + title chrome
 * for the existing Dashboard "tap rank card → Journey" deep-link.
 */

const WHITE = '#FFFFFF';
const BG    = '#000000';

export default function JourneyScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={24} color={WHITE} />
        </Pressable>
        <Text style={styles.title}>Journey</Text>
        <View style={{ width: 24 }} />
      </View>

      <JourneyRoad />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
