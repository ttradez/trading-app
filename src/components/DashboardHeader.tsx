import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import StreakBadge from './StreakBadge';
import TrainingTimeRing from './TrainingTimeRing';
import { HeaderFreezeIndicator } from './HomeStreakSignals';

/**
 * Shared identity header (DESIGN_AUDIT §3.1 — 5-tab restructure).
 * Lives on both Home and Stats so the user identity / rank / streak
 * row is consistent across the "what to do" and "how am I doing"
 * surfaces. Extracted from the old Dashboard so neither screen has
 * to duplicate ~60 lines of header markup.
 */

const GOLD = '#FFB800';
const WHITE = '#FFFFFF';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const ARCHETYPE_META: Record<Archetype, { name: string; icon: MCIName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

interface Props {
  onSettingsPress: () => void;
}

export default function DashboardHeader({ onSettingsPress }: Props) {
  const streakCount  = useStreakStore((s) => s.currentStreak);
  const streakStatus = useStreakStore(computeDisplayStatus);
  const archetype    = useOnboardingStore((s) => s.archetype);
  const displayName  = useOnboardingStore((s) => s.displayName);
  const currentXP    = useXpStore((s) => s.currentXP);
  const serverXp     = useXpStore((s) => s.serverXp);
  const serverRank   = useXpStore((s) => s.serverRank);
  // Backend doesn't track local challenge XP yet, so server total
  // can lag behind currentXP after a challenge completes. Use max so
  // local progress is never hidden by a smaller server return.
  const xpForRank    = Math.max(serverXp ?? 0, currentXP);
  const rankInfo     = React.useMemo(() => getRankForXP(xpForRank), [xpForRank]);
  // Phase 2: when the backend's rank object is available, show the
  // server-authoritative level name (the new 7-tier ladder has labels
  // the local 5-rank derivation can't produce). The pip-row still
  // uses the local sub-tier so the dot visual stays correct.
  const rankLabel    = serverRank ? serverRank.level_name : rankInfo.label;
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

  // Daily time-goal ring lives in the header now (was a standalone
  // card on Home before the polish pass). 36pt diameter, 8pt
  // gradient stroke. Tap is a no-op here — popover deferred.
  const minutesToday = useStreakStore((s) => s.todayTrainingMinutes);
  const dailyGoalMin = useOnboardingStore((s) => s.dailyTimeGoalMinutes);

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {archetypeMeta && (
          <MaterialCommunityIcons
            name={archetypeMeta.icon}
            size={18}
            color={GOLD}
            style={styles.archetypeIcon}
          />
        )}
        <Text style={styles.identityText} numberOfLines={1}>
          <Text style={styles.identityStrong}>
            {archetypeMeta ? archetypeMeta.name : 'Trader'}
          </Text>
          {displayName ? (
            <Text style={styles.identityDim}>{`  ·  ${displayName}`}</Text>
          ) : null}
          <Text style={styles.identityDim}>{`  ·  ${rankLabel}`}</Text>
        </Text>
        {/* Divisions removed (Phase 4): pip row deleted — ranks no
            longer have I/II/III sub-tiers. */}
      </View>
      <View style={styles.headerRight}>
        <Pressable
          onPress={() => {
            if (streakCount === 0) {
              Alert.alert('Streak', 'Train today to start your streak.');
            }
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={
            streakCount === 0
              ? 'No streak yet — train today to start'
              : `${streakCount}-day streak`
          }
          style={styles.streakWrap}
        >
          <StreakBadge count={streakCount} status={streakStatus} size="small" />
          {/* Snowflake sits to the right of the flame when the user
              holds a freeze. No count needed — cap is 1. */}
          <HeaderFreezeIndicator />
        </Pressable>
        <TrainingTimeRing
          minutes={minutesToday}
          goal={dailyGoalMin}
          size={36}
          stroke={8}
        />
        <Pressable
          onPress={onSettingsPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.gearBtn}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color="rgba(255,255,255,0.5)"
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  streakWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gearBtn: { padding: 2 },
  archetypeIcon: { marginRight: 6 },
  identityText: {
    flexShrink: 1,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  identityStrong: { color: WHITE, fontWeight: '700' },
  identityDim: { color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  pips: { flexDirection: 'row', alignItems: 'center', marginLeft: 6, gap: 3 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  pipOn: { backgroundColor: GOLD },
  pipOff: { backgroundColor: 'rgba(255,255,255,0.2)' },
});
