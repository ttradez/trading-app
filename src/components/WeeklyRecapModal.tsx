import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, Animated, Easing, StyleSheet, ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StreakBadge from './StreakBadge';
import { WeeklyRecap } from '../utils/weeklyRecap';

/**
 * WeeklyRecapModal — full-screen "Sunday Wrap". Reused by the
 * auto-trigger (MainTabs) and the Journal review path (tap a past
 * recap). Pure presentation: takes a `recap` + `onClose`.
 *
 * Entrance choreography (~1.7 s total):
 *   container fade (400 ms) → hero P&L counts up from $0 (700 ms,
 *   JS-driver Animated.Value + listener, same pattern as the
 *   screen-9 First Strike result) → 2×2 stats fade in staggered →
 *   training/streak row → edge-insight card slides up from below →
 *   Continue CTA.
 */

const BG    = '#000000';
// Modal surface — L3 in the layered system.
const CARD  = '#141414';
const BORDER = '#1F1F1F';
const GOLD  = '#FFB800';
const GREEN = '#00D395';
const RED   = '#FF4757';
const WHITE = '#FFFFFF';

function formatUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

function pnlColor(n: number): string {
  if (n > 0) return GREEN;
  if (n < 0) return RED;
  return WHITE;
}

function trainingLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} min this week`;
  return `${h} hr ${m} min this week`;
}

interface Props {
  visible: boolean;
  recap: WeeklyRecap | null;
  onClose: () => void;
}

export default function WeeklyRecapModal({ visible, recap, onClose }: Props) {
  const fadeIn      = useRef(new Animated.Value(0)).current;
  const pnlValue    = useRef(new Animated.Value(0)).current;
  const statsOp     = useRef(new Animated.Value(0)).current;
  const trainOp     = useRef(new Animated.Value(0)).current;
  const insightOp   = useRef(new Animated.Value(0)).current;
  const insightY    = useRef(new Animated.Value(24)).current;
  const ctaOp       = useRef(new Animated.Value(0)).current;
  const [displayPnl, setDisplayPnl] = useState(0);

  useEffect(() => {
    if (!visible || !recap) return;

    fadeIn.setValue(0);
    pnlValue.setValue(0);
    statsOp.setValue(0);
    trainOp.setValue(0);
    insightOp.setValue(0);
    insightY.setValue(24);
    ctaOp.setValue(0);
    setDisplayPnl(0);

    const id = pnlValue.addListener(({ value }) => setDisplayPnl(value));

    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1, duration: 400, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(pnlValue, {
          toValue: recap.totalPnL,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // JS driver — listener mirrors to state
        }),
      ]),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(statsOp, {
          toValue: 1, duration: 350, useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(950),
        Animated.timing(trainOp, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(1100),
        Animated.parallel([
          Animated.timing(insightOp, {
            toValue: 1, duration: 350, useNativeDriver: true,
          }),
          Animated.timing(insightY, {
            toValue: 0, duration: 350,
            easing: Easing.out(Easing.cubic), useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(1350),
        Animated.timing(ctaOp, {
          toValue: 1, duration: 300, useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => pnlValue.removeListener(id);
    // re-run when a different week's recap is shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, recap?.weekId]);

  if (!recap) return null;

  const winRateColor =
    recap.winRate == null ? WHITE
      : recap.winRate >= 50 ? GREEN : RED;

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[styles.root, { opacity: fadeIn }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* a. Header */}
          <Text style={styles.eyebrow}>WEEK IN REVIEW</Text>
          <Text style={styles.dateRange}>{recap.dateRange}</Text>

          {/* b. Hero P&L */}
          <Text
            style={[styles.heroPnl, { color: pnlColor(recap.totalPnL) }]}
            allowFontScaling={false}
          >
            {formatUSD(displayPnl)}
          </Text>
          <Text style={styles.heroLabel}>total P&L this week</Text>

          {/* c. Stats grid (2×2) */}
          <Animated.View style={[styles.statsGrid, { opacity: statsOp }]}>
            <StatCell label="Trades" value={String(recap.totalTrades)} />
            <StatCell
              label="Win Rate"
              value={recap.winRate == null ? '—' : `${recap.winRate}%`}
              color={recap.winRate == null ? undefined : winRateColor}
            />
            <StatCell
              label="Best Trade"
              value={recap.bestTrade ? formatUSD(recap.bestTrade.pnl) : '—'}
              sub={recap.bestTrade?.symbol}
              color={recap.bestTrade ? GREEN : undefined}
            />
            <StatCell
              label="Worst Trade"
              value={recap.worstTrade ? formatUSD(recap.worstTrade.pnl) : '—'}
              sub={recap.worstTrade?.symbol}
              color={recap.worstTrade ? RED : undefined}
            />
          </Animated.View>

          {/* d. Training + streak row */}
          <Animated.View style={[styles.trainRow, { opacity: trainOp }]}>
            <View style={styles.trainItem}>
              <MaterialCommunityIcons name="fire" size={20} color={GOLD} />
              <Text style={styles.trainText}>
                {trainingLabel(recap.totalTrainingMinutes)}
              </Text>
            </View>
            <View style={styles.trainItem}>
              <StreakBadge
                count={recap.currentStreak}
                status={recap.currentStreak > 0 ? 'active' : 'new'}
                size="small"
              />
              <Text style={styles.trainText}>
                {recap.currentStreak} day streak
              </Text>
            </View>
          </Animated.View>

          {/* e. Edge insight */}
          {recap.edgeInsight && (
            <Animated.View
              style={[
                styles.insightCard,
                { opacity: insightOp, transform: [{ translateY: insightY }] },
              ]}
            >
              <View style={styles.insightAccent} />
              <View style={styles.insightBody}>
                <Text style={styles.insightLabel}>INSIGHT</Text>
                <Text style={styles.insightText}>{recap.edgeInsight}</Text>
              </View>
            </Animated.View>
          )}

          {/* f. Dismiss */}
          <Animated.View style={{ opacity: ctaOp }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function StatCell({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text
        style={[styles.statValue, color ? { color } : null]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
    alignItems: 'center',
  },

  eyebrow: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  dateRange: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '600',
  },

  heroPnl: {
    marginTop: 28,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },

  statsGrid: {
    marginTop: 36,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignSelf: 'stretch',
  },
  statCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  statValue: {
    color: WHITE,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  statSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  statLabel: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },

  trainRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  trainItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trainText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },

  insightCard: {
    marginTop: 28,
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  insightAccent: { width: 3, backgroundColor: GOLD },
  insightBody: { flex: 1, padding: 16 },
  insightLabel: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  insightText: {
    marginTop: 8,
    color: WHITE,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },

  cta: {
    marginTop: 36,
    alignSelf: 'stretch',
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
