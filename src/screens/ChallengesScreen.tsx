import React, { useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { useChallengesStore, CHALLENGE_TEMPLATES, Challenge } from '../store/challengesStore';
import { useJournalStore } from '../store/journalStore';

export default function ChallengesScreen() {
  const { challenges, hydrate, joinChallenge, recompute, abandon } = useChallengesStore();
  const entries = useJournalStore((s) => s.entries);

  // Hydrate on mount + recompute progress whenever journal entries change.
  useEffect(() => { hydrate(); }, []);
  useEffect(() => { recompute(entries); }, [entries]);

  const active    = useMemo(() => challenges.filter((c) => c.status === 'active'),    [challenges]);
  const completed = useMemo(() => challenges.filter((c) => c.status === 'completed'), [challenges]);
  const joined    = new Set(challenges.map((c) => c.id));
  const available = CHALLENGE_TEMPLATES.filter((t) => !joined.has(t.id));

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Challenges</Text>
        <Text style={styles.sub}>Train discipline. Earn XP.</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Active */}
        {active.length > 0 && (
          <>
            <Text style={[labelStyle, { marginBottom: spacing.sm }]}>ACTIVE</Text>
            {active.map((c) => <ActiveCard key={c.id} c={c} onAbandon={() => abandon(c.id)} />)}
          </>
        )}

        {/* Available */}
        {available.length > 0 && (
          <>
            <Text style={[labelStyle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>AVAILABLE</Text>
            {available.map((t) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.row}>
                  <Ionicons name="medal-outline" size={22} color={colors.gold} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{t.title}</Text>
                    <Text style={styles.cardDesc}>{t.description}</Text>
                  </View>
                  <Text style={styles.xpReward}>+{t.reward.xp} XP</Text>
                </View>
                <TouchableOpacity style={styles.joinBtn} onPress={() => joinChallenge(t)}>
                  <Text style={styles.joinBtnText}>JOIN</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <>
            <Text style={[labelStyle, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>COMPLETED</Text>
            {completed.map((c) => (
              <View key={c.id} style={[styles.card, { opacity: 0.65, borderColor: colors.green }]}>
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.green} style={{ marginRight: spacing.sm }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{c.title}</Text>
                    <Text style={styles.cardDesc}>
                      Earned +{c.reward.xp} XP{c.reward.badge ? ` · ${c.reward.badge} badge` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {challenges.length === 0 && available.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>You've joined every challenge. New ones coming soon.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActiveCard({ c, onAbandon }: { c: Challenge; onAbandon: () => void }) {
  const pct = Math.min(1, c.progress / c.goal);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="flame-outline" size={22} color={colors.gold} style={{ marginRight: spacing.sm }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{c.title}</Text>
          <Text style={styles.cardDesc}>{c.description}</Text>
        </View>
        <TouchableOpacity onPress={onAbandon} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{Math.floor(c.progress)} / {c.goal}</Text>
        <Text style={styles.progressPct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  title: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  sub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  cardDesc:  { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  xpReward:  { color: colors.gold, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

  joinBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold, borderRadius: radius.sm,
    paddingVertical: 8, alignItems: 'center',
  },
  joinBtnText: { color: colors.bg, fontWeight: fontWeight.black, letterSpacing: 1.5, fontSize: fontSize.xs },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  progressText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  progressPct:  { color: colors.gold,        fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  barTrack: { height: 4, borderRadius: 2, backgroundColor: colors.cardAlt, marginTop: 4, overflow: 'hidden' },
  barFill:  { height: '100%', backgroundColor: colors.gold, borderRadius: 2 },

  empty: { alignItems: 'center', padding: spacing.xxl },
  emptyText: { color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center' },
});
