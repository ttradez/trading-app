import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { useXpStore } from '../store/xpStore';
import { getRankForXP } from '../data/rankConfig';
import StreakBadge from './StreakBadge';

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
  const rankInfo     = React.useMemo(() => getRankForXP(currentXP), [currentXP]);
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;

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
          <Text style={styles.identityDim}>{`  ·  ${rankInfo.label}`}</Text>
        </Text>
        <View style={styles.pips}>
          {[1, 2, 3].map((t) => (
            <View
              key={t}
              style={[
                styles.pip,
                t <= rankInfo.subTier ? styles.pipOn : styles.pipOff,
              ]}
            />
          ))}
        </View>
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
        >
          <StreakBadge count={streakCount} status={streakStatus} size="small" />
        </Pressable>
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
