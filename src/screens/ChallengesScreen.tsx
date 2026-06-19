import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useXpStore } from '../store/xpStore';
import { RANK_ORDER, RankId } from '../data/rankConfig';
import {
  useChallengeStore, ChallengeInstance,
} from '../store/challengeStore';
import {
  DAILY_POOL, WEEKLY_POOL, MONTHLY_POOL,
  DETECTABLE_CONDITIONS, getTemplate, rankAtLeast,
  ChallengeTemplate, ChallengeType,
} from '../data/challengePool';

/**
 * Challenges screen — the standalone destination behind the
 * "Challenges" banner on Home. Active rows at the top + a rank-by-
 * rank preview of what unlocks at each higher rank. Pulls live
 * progress from useChallengeStore.
 */

const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';
const BG    = '#000000';
const GAIN  = '#00D395';

export default function ChallengesScreen({ navigation }: any) {
  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={WHITE} />
        </Pressable>
        <Text style={styles.title}>Challenges</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ChallengesPane navigation={navigation} />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────

function ChallengesPane({ navigation }: { navigation: any }) {
  const dailies        = useChallengeStore((s) => s.activeDailies);
  const weekly         = useChallengeStore((s) => s.activeWeekly);
  const monthly        = useChallengeStore((s) => s.activeMonthly);
  const claimChallenge = useChallengeStore((s) => s.claimChallenge);
  const userRank       = useXpStore((s) => s.currentRank);

  // Shared claim handler — grants XP, then jumps the user to the
  // Ranks tab so they see the XP bar fill toward the next rank.
  const handleClaim = React.useCallback(
    (challengeId: string) => {
      claimChallenge(challengeId);
      try { navigation.navigate('Main', { screen: 'Ranks' }); }
      catch {
        try { navigation.navigate('Ranks'); }
        catch { /* non-fatal */ }
      }
    },
    [claimChallenge, navigation],
  );

  const activeItems = useMemo(() => {
    type Row = {
      instance: ChallengeInstance;
      template: ChallengeTemplate;
      typeTag: ChallengeType;
    };
    const items: Row[] = [];
    for (const d of dailies) {
      const t = getTemplate(d.challengeId);
      if (t) items.push({ instance: d, template: t, typeTag: 'daily' });
    }
    if (weekly) {
      const t = getTemplate(weekly.challengeId);
      if (t) items.push({ instance: weekly, template: t, typeTag: 'weekly' });
    }
    if (monthly) {
      const t = getTemplate(monthly.challengeId);
      if (t) items.push({ instance: monthly, template: t, typeTag: 'monthly' });
    }
    return items;
  }, [dailies, weekly, monthly]);

  const lockedGroups = useMemo(() => {
    const all = [...DAILY_POOL, ...WEEKLY_POOL, ...MONTHLY_POOL];
    const byRank = new Map<RankId, ChallengeTemplate[]>();
    for (const t of all) {
      if (!DETECTABLE_CONDITIONS.has(t.condition)) continue;
      if (rankAtLeast(userRank, t.minRank)) continue;
      const arr = byRank.get(t.minRank) ?? [];
      arr.push(t);
      byRank.set(t.minRank, arr);
    }
    return RANK_ORDER
      .filter((r) => byRank.has(r))
      .map((r) => ({ rank: r, templates: byRank.get(r)! }));
  }, [userRank]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeaderRow}>
        <Ionicons name="flame" size={14} color={GOLD} />
        <Text style={styles.sectionHeader}>ACTIVE</Text>
      </View>
      {activeItems.length === 0 ? (
        <Text style={styles.empty}>
          No active challenges. Start a session and they'll roll in.
        </Text>
      ) : (
        activeItems.map((row) => (
          <ChallengeRow
            key={row.instance.challengeId}
            template={row.template}
            typeTag={row.typeTag}
            instance={row.instance}
            locked={false}
            onClaim={() => handleClaim(row.instance.challengeId)}
          />
        ))
      )}

      {lockedGroups.length > 0 && (
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="lock-closed" size={13} color={WHITE} />
          <Text style={styles.sectionHeader}>UPCOMING</Text>
        </View>
      )}
      {lockedGroups.map((g) => (
        <View key={g.rank} style={styles.group}>
          <View style={styles.groupHeaderRow}>
            <Text style={styles.groupHeader}>
              UNLOCKS AT {g.rank.toUpperCase()}
            </Text>
            <Text style={styles.groupCount}>
              {g.templates.length}{' '}
              {g.templates.length === 1 ? 'challenge' : 'challenges'}
            </Text>
          </View>
          {g.templates.map((t) => (
            <ChallengeRow
              key={t.id}
              template={t}
              typeTag={t.type}
              instance={null}
              locked
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ChallengeRow({
  template, typeTag, instance, locked, onClaim,
}: {
  template: ChallengeTemplate;
  typeTag: ChallengeType;
  instance: ChallengeInstance | null;
  locked: boolean;
  onClaim?: () => void;
}) {
  const isComplete = instance?.completed ?? false;
  const isClaimed  = instance?.claimed  ?? false;
  const claimable  = isComplete && !isClaimed && !!onClaim;
  const progress = instance ? instance.progress : 0;
  const target = template.target;
  const ratio = target > 0 ? Math.min(1, progress / target) : 0;
  const typeColor =
    typeTag === 'daily'
      ? GOLD
      : typeTag === 'weekly'
        ? '#9B59B6'
        : '#4A9EFF';

  return (
    <View
      style={[
        styles.row,
        locked && styles.rowLocked,
        isComplete && styles.rowComplete,
        claimable && styles.rowClaimable,
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={[styles.typeChip, { borderColor: typeColor }]}>
          <Text style={[styles.typeChipText, { color: typeColor }]}>
            {typeTag.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.xp, locked && styles.xpLocked]}>
          +{template.xpReward} XP
        </Text>
        {isComplete && !claimable && (
          <Ionicons name="checkmark-circle" size={16} color={GAIN} />
        )}
      </View>
      <Text
        style={[styles.name, locked && styles.nameLocked]}
        numberOfLines={1}
      >
        {template.name}
      </Text>
      <Text
        style={[styles.desc, locked && styles.descLocked]}
        numberOfLines={2}
      >
        {template.description}
      </Text>
      {instance && (
        <View style={styles.progressRow}>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${ratio * 100}%`,
                  backgroundColor: isComplete ? GAIN : typeColor,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.toLocaleString('en-US')} / {target.toLocaleString('en-US')}
          </Text>
        </View>
      )}
      {claimable && (
        <Pressable
          onPress={onClaim}
          style={({ pressed }) => [
            styles.claimBtn,
            pressed && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Claim +${template.xpReward} XP for ${template.name}`}
        >
          <Ionicons name="gift" size={14} color="#000000" />
          <Text style={styles.claimBtnText}>
            CLAIM +{template.xpReward} XP
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerRightSpacer: { width: 40 },
  title: {
    flex: 1,
    color: GOLD,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2.4,
    textAlign: 'center',
  },

  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeader: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  empty: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },

  group: { marginTop: 18 },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  groupHeader: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  groupCount: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  row: {
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowLocked: { opacity: 0.55 },
  rowComplete: {
    borderColor: 'rgba(0,211,149,0.45)',
    backgroundColor: 'rgba(0,211,149,0.06)',
  },
  // Claimable: gold-tinted border + bg, swaps to the green-settled
  // state once the user actually claims the XP.
  rowClaimable: {
    borderColor: GOLD,
    backgroundColor: 'rgba(255,184,0,0.10)',
  },
  claimBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: GOLD,
  },
  claimBtnText: {
    color: '#000000',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  typeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  xp: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
  },
  xpLocked: { color: 'rgba(255,184,0,0.6)' },
  name: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  nameLocked: { color: 'rgba(255,255,255,0.65)' },
  desc: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  descLocked: { color: 'rgba(255,255,255,0.42)' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  progressText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 48,
    textAlign: 'right',
  },
});
