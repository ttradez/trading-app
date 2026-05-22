import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  CLASSIC_SETUPS, ICT_SETUPS, LibrarySetup, SetupCategory, SetupSection,
  CATEGORY_COLOR, CATEGORY_LABEL, DIFFICULTY_COLOR,
  CLASSIC_CATEGORY_ORDER, ICT_CATEGORY_ORDER,
} from '../data/setupLibrary';
import { useXpStore } from '../store/xpStore';
import { useJournalStore } from '../store/journalStore';
import { RANK_BEATS, RankId } from '../data/rankConfig';
import { typography } from '../theme';
import Button from '../components/ui/Button';
import FilterChip from '../components/ui/FilterChip';
import NumericText from '../components/NumericText';
import {
  getSetupStatsMap, SetupStats,
} from '../lib/setupPerformance';

/**
 * SetupLibraryScreen — the pattern encyclopedia. A Classic/ICT
 * segmented control swaps the dataset + category chips. ICT
 * concepts carry a soft rank gate: locked cards render dimmed with
 * a lock and open an "unlock at rank" modal instead of the detail.
 */

const BG          = '#000000';
// Setup list cards are secondary — L1 in the layered surface system.
const CARD_BG     = '#0A0A0A';
// Modal surface — L3 (separate from the list card color).
const MODAL_BG    = '#141414';
const CARD_BORDER = '#1F1F1F';
const GOLD        = '#FFB800';
const WHITE       = '#FFFFFF';

const RANK_LABEL: Record<RankId, string> = {
  gambler: 'Gambler',
  paper_hands: 'Paper Hands',
  sniper: 'Sniper',
  inside_trader: 'Inside Trader',
  market_maker: 'Market Maker',
};

/** Lifetime XP at which a rank is entered (its sub-tier I beat). */
function unlockThreshold(rank: RankId): number {
  const b = RANK_BEATS.find((x) => x.rank === rank && x.subTier === 1);
  return b ? b.cumulativeXP : 0;
}

type Filter = 'all' | SetupCategory;
interface LockInfo { rankLabel: string; xpAway: number; }

function DifficultyBadge({ difficulty }: { difficulty: LibrarySetup['difficulty'] }) {
  const color = DIFFICULTY_COLOR[difficulty];
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return (
    <View style={[styles.diffBadge, { borderColor: color }]}>
      <Text style={[styles.diffBadgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ── Per-card user stats ────────────────────────────────────────────

const GREEN = '#00D395';
const RED   = '#FF4757';

/** Directional tint applied only at sample ≥ 3 (avoid one-trade
 *  noise). Profit factor ≥ 1 reads green; < 1 reads red. Null /
 *  small sample → no tint. */
function pickTint(stats: SetupStats | null): { bg: string; border: string } | null {
  if (!stats || stats.tradeCount < 3) return null;
  if (stats.profitFactor === null) return null;
  const positive = stats.profitFactor === 'inf' || stats.profitFactor >= 1;
  return positive
    ? { bg: 'rgba(0, 211, 149, 0.04)', border: 'rgba(0, 211, 149, 0.12)' }
    : { bg: 'rgba(255, 71, 87, 0.04)', border: 'rgba(255, 71, 87, 0.12)' };
}

function StatsRow({ stats }: { stats: SetupStats }) {
  const pnlColor =
    stats.netPnl > 0 ? GREEN :
    stats.netPnl < 0 ? RED   :
    'rgba(255,255,255,0.8)';
  const sign = stats.netPnl > 0 ? '+' : stats.netPnl < 0 ? '-' : '';
  const pfDisplay =
    stats.profitFactor === null  ? null :
    stats.profitFactor === 'inf' ? 'PF ∞' :
    `PF ${stats.profitFactor.toFixed(1)}`;

  return (
    <View style={styles.statsRow}>
      <NumericText style={styles.statText}>
        {stats.tradeCount} {stats.tradeCount === 1 ? 'trade' : 'trades'}
      </NumericText>
      <Text style={styles.statSep}>·</Text>
      <NumericText style={styles.statText}>
        {Math.round(stats.winRate)}% win
      </NumericText>
      <Text style={styles.statSep}>·</Text>
      <NumericText bold style={[styles.statText, { color: pnlColor }]}>
        {sign}${Math.round(Math.abs(stats.netPnl)).toLocaleString('en-US')}
      </NumericText>
      {pfDisplay && (
        <>
          <Text style={styles.statSep}>·</Text>
          <NumericText style={styles.statText}>{pfDisplay}</NumericText>
        </>
      )}
    </View>
  );
}

export default function SetupLibraryScreen({ navigation, route }: any) {
  // Optional route-param pre-selection — the Learn screen's path
  // cards pass these in so a tap lands on the right tab + filter
  // chip without the user having to re-click them. Absent params
  // fall through to the existing default (Classic / All).
  const initialTab: SetupSection =
    route?.params?.tab === 'ict' ? 'ict' : 'classic';
  const initialFilter: Filter = route?.params?.filter ?? 'all';

  const [section, setSection] = useState<SetupSection>(initialTab);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [lock, setLock] = useState<LockInfo | null>(null);

  const currentXP = useXpStore((s) => s.currentXP);

  // Per-user setup performance — computed once per render at the
  // screen level instead of per-card so the 28-card list stays
  // O(1) per cell. `getSetupStatsMap` filters trades-without-setupId
  // out internally.
  const trades = useJournalStore((s) => s.entries);
  const statsById = useMemo(() => getSetupStatsMap(trades), [trades]);

  const filters: { id: Filter; label: string }[] = useMemo(() => {
    const order: SetupCategory[] =
      section === 'classic'
        ? [...CLASSIC_CATEGORY_ORDER]
        : [...ICT_CATEGORY_ORDER];
    return [
      { id: 'all' as Filter, label: 'All' },
      ...order.map((c) => ({
        id: c as Filter,
        label: c.charAt(0).toUpperCase() + c.slice(1),
      })),
    ];
  }, [section]);

  const setups = useMemo(() => {
    const src = section === 'classic' ? CLASSIC_SETUPS : ICT_SETUPS;
    return filter === 'all' ? src : src.filter((s) => s.category === filter);
  }, [section, filter]);

  const switchSection = (next: SetupSection) => {
    setSection(next);
    setFilter('all');
  };

  const openSetup = (s: LibrarySetup) => {
    if (s.unlock) {
      const threshold = unlockThreshold(s.unlock);
      if (currentXP < threshold) {
        setLock({
          rankLabel: RANK_LABEL[s.unlock],
          xpAway: threshold - currentXP,
        });
        return;
      }
    }
    navigation.navigate('SetupDetail', { setupId: s.id });
  };

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

        {/* Classic / ICT segmented control */}
        <View style={styles.segments}>
          {(['classic', 'ict'] as SetupSection[]).map((seg) => {
            const active = section === seg;
            return (
              <Pressable
                key={seg}
                onPress={() => switchSection(seg)}
                style={styles.segment}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${seg === 'ict' ? 'ICT' : 'Classic'} setups`}
              >
                <Text
                  style={[
                    styles.segmentText,
                    active && styles.segmentTextActive,
                  ]}
                >
                  {seg === 'ict' ? 'ICT' : 'Classic'}
                </Text>
                <View
                  style={[
                    styles.segmentUnderline,
                    active && styles.segmentUnderlineActive,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Category filter chips — locked FilterChip (DESIGN_AUDIT §2.4) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {filters.map((f) => (
            <FilterChip
              key={f.id}
              label={f.label}
              selected={filter === f.id}
              onPress={() => setFilter(f.id)}
              accessibilityLabel={`${f.label} setups`}
            />
          ))}
        </ScrollView>

        {/* Setup cards */}
        <View style={styles.list}>
          {setups.map((s) => {
            const locked =
              !!s.unlock && currentXP < unlockThreshold(s.unlock);
            const stats = statsById[s.id] ?? null;
            const tint = pickTint(stats);
            return (
              <Pressable
                key={s.id}
                onPress={() => openSetup(s)}
                style={({ pressed }) => [
                  styles.card,
                  tint && {
                    backgroundColor: tint.bg,
                    borderColor: tint.border,
                  },
                  locked && styles.cardLocked,
                  pressed && !locked && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  locked
                    ? `${s.name}, locked, unlock at ${RANK_LABEL[s.unlock!]}`
                    : `${s.name}, ${s.difficulty}`
                }
              >
                {locked && (
                  <Ionicons
                    name="lock-closed"
                    size={16}
                    color="rgba(255,255,255,0.6)"
                    style={styles.lockIcon}
                  />
                )}
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
                {stats && !locked && <StatsRow stats={stats} />}
                {locked ? (
                  <Text style={styles.cardLockText}>
                    Unlock at {RANK_LABEL[s.unlock!]}
                  </Text>
                ) : (
                  <View style={styles.cardLinkWrap}>
                    <Button
                      label="Learn & Practice"
                      variant="tertiary"
                      onPress={() => openSetup(s)}
                    />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Rank-gate modal */}
      <Modal
        visible={lock !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLock(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setLock(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Ionicons name="lock-closed" size={28} color={GOLD} />
            <Text style={styles.modalTitle}>
              Reach {lock?.rankLabel} to access this concept
            </Text>
            <Text style={styles.modalBody}>
              You're {lock?.xpAway.toLocaleString('en-US')} XP away.
            </Text>
            <Pressable
              onPress={() => setLock(null)}
              style={({ pressed }) => [
                styles.modalBtn,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <Text style={styles.modalBtnText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Screen title — locked 6-step scale: `typography.display`.
  title: {
    ...typography.display,
    color: WHITE,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },

  // Segmented control
  segments: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 28,
  },
  segment: {
    alignItems: 'center',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingBottom: 8,
  },
  segmentTextActive: { color: WHITE },
  segmentUnderline: {
    height: 2,
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 1,
  },
  segmentUnderlineActive: { backgroundColor: GOLD },

  filterRow: {
    marginTop: 16,
    paddingRight: 8,
    gap: 8,
  },

  list: { marginTop: 20, gap: 12 },
  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    // Design-system hairline highlight (tokens.colors.hairlineHighlight).
    borderTopColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 16,
  },
  cardLocked: { opacity: 0.5 },
  lockIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
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
  cardLinkWrap: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },

  // Per-user stats row inside each card. Sits below the description
  // and above the "Learn & Practice" link. Hidden entirely when the
  // user has no trades on this pattern.
  statsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  statSep: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginHorizontal: 6,
  },
  cardLockText: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
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

  // Lock modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: MODAL_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    marginTop: 14,
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalBody: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBtn: {
    marginTop: 20,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  modalBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
