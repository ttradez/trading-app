import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';

import { SETUP_LIBRARY_COUNT } from '../data/setupLibrary';
import { colors, typography } from '../theme';

/**
 * Learn — the curriculum surface (5-tab restructure).
 *
 * Top: the Setup Library entry card (same component shape as the
 * old Dashboard hosted), tapping through to the existing
 * SetupLibrary route which is unchanged. Below: a placeholder for
 * the wider curriculum slots a follow-up will fill in.
 *
 * Visual treatment unchanged from the prior DashboardScreen — this
 * pass is purely content migration + nav restructure.
 */

const GOLD = '#FFB800';
const WHITE = colors.textPrimary;

function StackedCardsGlyph({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect x={6} y={4} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.18)" strokeWidth={1.2} fill="none" />
      <Rect x={4} y={7} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.22)" strokeWidth={1.2} fill="none" />
      <Rect x={2} y={10} width={16} height={14} rx={3} ry={3}
        stroke="rgba(255,255,255,0.32)" strokeWidth={1.4} fill="none" />
    </Svg>
  );
}

export default function LearnScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[typography.display, styles.headerTitle]}>Learn</Text>
        </View>

        {/* Setup Library entry card (same shape as the prior
            Dashboard hosted; deep-link to the existing SetupLibrary
            route which remains in the root stack). */}
        <Pressable
          style={styles.libCard}
          onPress={() => navigation.navigate('SetupLibrary')}
          accessibilityRole="button"
          accessibilityLabel={`Setup Library, ${SETUP_LIBRARY_COUNT} patterns to learn`}
        >
          <Ionicons name="book-outline" size={24} color={GOLD} />
          <View style={styles.libText}>
            <Text style={styles.libTitle}>Setup Library</Text>
            <Text style={styles.libSub}>
              {SETUP_LIBRARY_COUNT} patterns to learn
            </Text>
          </View>
          <View style={styles.libGlyph}>
            <StackedCardsGlyph size={36} />
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="rgba(255,255,255,0.3)"
          />
        </Pressable>

        {/* Placeholder — future curriculum slots (video lessons,
            written walkthroughs, drills) land here. */}
        <View style={[styles.placeholderCard, styles.sectionGap]}>
          <Text style={styles.placeholderEyebrow}>MORE LEARNING</Text>
          <Text style={[typography.body, styles.placeholderBody]}>
            Coming soon. Video lessons, written walkthroughs, and
            targeted drills land here next.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  header: { paddingTop: 8, paddingBottom: 12 },
  headerTitle: { color: WHITE },

  sectionGap: { marginTop: 24 },

  libCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    backgroundColor: '#0A0A0A',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
  },
  libText: { flex: 1 },
  libTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  libSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  libGlyph: { marginRight: 4 },

  placeholderCard: {
    backgroundColor: '#0A0A0A',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
  },
  placeholderEyebrow: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  placeholderBody: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.65)',
  },
});
