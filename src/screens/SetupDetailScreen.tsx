import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  getLibrarySetup, CATEGORY_COLOR, CATEGORY_LABEL, DIFFICULTY_COLOR,
} from '../data/setupLibrary';
import { savedSetupStartUnixSeconds } from '../store/watchlistStore';
import { typography } from '../theme';

/**
 * SetupDetailScreen — full detail for one library setup. Reads
 * `route.params.setupId`. The practice examples deep-link into a
 * replay session via the same `dailySetup` route param Daily
 * Mission / Saved Setups use. Because this is a root-stack screen
 * (over the tab navigator), it navigates to the nested Chart tab
 * with `navigate('Main', { screen: 'Chart', params })`, which also
 * unwinds the library screens off the stack.
 */

const BG          = '#000000';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const GOLD        = '#FFB800';
const WHITE       = '#FFFFFF';

export default function SetupDetailScreen({ route, navigation }: any) {
  const setupId = route?.params?.setupId as string | undefined;
  const setup = setupId ? getLibrarySetup(setupId) : undefined;

  if (!setup) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={24} color={WHITE} />
          </Pressable>
        </View>
        <Text style={styles.missingText}>Setup not found.</Text>
      </SafeAreaView>
    );
  }

  const catColor = CATEGORY_COLOR[setup.category];
  const diffColor = DIFFICULTY_COLOR[setup.difficulty];

  const tradeThis = (ex: { symbol: string; date: string; timeframe: string }) => {
    navigation.navigate('Main', {
      screen: 'Chart',
      params: {
        dailySetup: {
          symbol: ex.symbol,
          timeframe: ex.timeframe,
          startTs: savedSetupStartUnixSeconds(ex.date),
          date: ex.date,
          key: `lib-${setup.id}-${ex.date}-${Date.now()}`,
        },
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={WHITE} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{setup.name}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.diffBadge, { borderColor: diffColor }]}>
            <Text style={[styles.diffBadgeText, { color: diffColor }]}>
              {setup.difficulty.charAt(0).toUpperCase()
                + setup.difficulty.slice(1)}
            </Text>
          </View>
          <Text style={[styles.categoryTag, { color: catColor }]}>
            {CATEGORY_LABEL[setup.category]}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>What is this setup?</Text>
        <Text style={styles.bodyText}>{setup.description}</Text>

        <Text style={styles.sectionLabel}>How to trade it</Text>
        <Text style={styles.bodyText}>{setup.howToTrade}</Text>

        <Text style={styles.sectionLabel}>Rules</Text>
        <View style={styles.rulesWrap}>
          {setup.keyRules.map((r, i) => (
            <View key={i} style={styles.ruleRow}>
              <Text style={styles.ruleNum}>{i + 1}</Text>
              <Text style={styles.ruleText}>{r}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Practice this setup</Text>
        <View style={styles.exampleList}>
          {setup.examples.map((ex, i) => (
            <View key={i} style={styles.exampleCard}>
              <Text style={styles.exampleHead}>
                {ex.symbol} · {ex.date} · {ex.timeframe}
              </Text>
              <Text style={styles.exampleContext}>{ex.context}</Text>
              <Pressable
                onPress={() => tradeThis(ex)}
                style={({ pressed }) => [
                  styles.tradeBtn,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Trade ${ex.symbol} ${ex.date}`}
              >
                <Text style={styles.tradeBtnText}>Trade this →</Text>
              </Pressable>
            </View>
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
  missingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    paddingHorizontal: 20,
  },

  // Screen title — locked 6-step scale: `typography.display`.
  title: {
    ...typography.display,
    color: WHITE,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  categoryTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    opacity: 0.6,
  },

  sectionLabel: {
    marginTop: 28,
    marginBottom: 8,
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bodyText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 23,
  },

  rulesWrap: { gap: 10 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ruleNum: {
    width: 24,
    color: GOLD,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  ruleText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },

  exampleList: { gap: 12 },
  exampleCard: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  exampleHead: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  exampleContext: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  tradeBtn: {
    marginTop: 14,
    height: 44,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
