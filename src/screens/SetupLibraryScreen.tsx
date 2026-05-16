import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  SETUP_LIBRARY, SETUP_LIBRARY_COUNT, LibrarySetup, SetupCategory,
  CATEGORY_COLOR, CATEGORY_LABEL, CATEGORY_ORDER, DIFFICULTY_COLOR,
} from '../data/setupLibrary';

/**
 * SetupLibraryScreen — the pattern encyclopedia index. Pushed onto
 * the root stack (own back button) from the dashboard card and the
 * chart header book icon. Filterable by category; tapping a card
 * opens SetupDetailScreen.
 */

const BG          = '#000000';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const GOLD        = '#FFB800';
const WHITE       = '#FFFFFF';

type Filter = 'all' | SetupCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...CATEGORY_ORDER.map((c) => ({
    id: c,
    label: c.charAt(0).toUpperCase() + c.slice(1),
  })),
];

function DifficultyBadge({ difficulty }: { difficulty: LibrarySetup['difficulty'] }) {
  const color = DIFFICULTY_COLOR[difficulty];
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return (
    <View style={[styles.diffBadge, { borderColor: color }]}>
      <Text style={[styles.diffBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function SetupLibraryScreen({ navigation }: any) {
  const [filter, setFilter] = useState<Filter>('all');

  const setups = useMemo(
    () =>
      filter === 'all'
        ? SETUP_LIBRARY
        : SETUP_LIBRARY.filter((s) => s.category === filter),
    [filter],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={WHITE} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Setup Library</Text>
        <Text style={styles.subtitle}>
          Learn the patterns. Practice on real history.
        </Text>

        {/* Category filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={({ pressed }) => [
                  styles.filterChip,
                  active && styles.filterChipActive,
                  pressed && !active && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label} setups`}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Setup cards */}
        <View style={styles.list}>
          {setups.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => navigation.navigate('SetupDetail', { setupId: s.id })}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${s.name}, ${s.difficulty}`}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardName}>{s.name}</Text>
                <DifficultyBadge difficulty={s.difficulty} />
              </View>
              <Text
                style={[
                  styles.cardCategory,
                  { color: CATEGORY_COLOR[s.category] },
                ]}
              >
                {CATEGORY_LABEL[s.category]}
              </Text>
              <Text style={styles.cardDesc}>{s.description}</Text>
              <Text style={styles.cardLink}>Learn &amp; Practice →</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  headerBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6 },

  title: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },

  filterRow: {
    marginTop: 18,
    paddingRight: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  filterChipTextActive: { color: '#000000' },

  list: { marginTop: 20, gap: 12 },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardName: {
    flexShrink: 1,
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardCategory: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  cardDesc: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
  },
  cardLink: {
    marginTop: 14,
    color: GOLD,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },

  diffBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  diffBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
