import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAccount, getTrades } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { EquityCurve, WinLossBar, DailyPnlSpark, StreakTracker } from '../components/DashboardCharts';
import StreakBadge from '../components/StreakBadge';
import TradeCard from '../components/TradeCard';
import { computeRank } from '../utils/ranks';

type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Archetype display name + sigil glyph. Same 4-entry mapping the
 *  archetype reveal screen + Plan Summary screen use. Inlined here
 *  (third inline copy) per the convention established earlier:
 *  the mapping is short, stable, and consolidating it would require
 *  touching the onboarding screens — explicitly out of scope for
 *  this prompt. The convergence pass is logged as a follow-up. */
const ARCHETYPE_META: Record<Archetype, { name: string; icon: MCIName }> = {
  scalper:         { name: 'Scalper',         icon: 'lightning-bolt' },
  day_trader:      { name: 'Day Trader',      icon: 'clock-outline' },
  swing_trader:    { name: 'Swing Trader',    icon: 'chart-line-variant' },
  position_trader: { name: 'Position Trader', icon: 'anchor' },
};

const RANK_COLORS: Record<string, string> = {
  'Gambler':       colors.rankGambler,
  'Paper Hands':   colors.rankPaperHands,
  'Sniper':        colors.rankSniper,
  'Inside Trader': colors.rankInsideTrader,
  'Market Maker':  colors.rankMarketMaker,
};

const RANK_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Gambler':       'dice-outline',
  'Paper Hands':   'hand-left-outline',
  'Sniper':        'locate-outline',
  'Inside Trader': 'eye-outline',
  'Market Maker':  'diamond-outline',
};

export default function DashboardScreen({ navigation }: any) {
  const { uid, username } = useAuthStore();
  const streakCount  = useStreakStore((s) => s.currentStreak);
  // Derived from currentStreak + lastCompletedDate + frozenToday.
  // computeDisplayStatus reads `new Date()` so the badge always
  // reflects the device's current day, not a stale persisted status.
  const streakStatus = useStreakStore(computeDisplayStatus);
  const archetype    = useOnboardingStore((s) => s.archetype);
  const archetypeMeta = archetype ? ARCHETYPE_META[archetype] : null;
  const [account, setAccount] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [acc, trs] = await Promise.all([getAccount(uid), getTrades(uid, 50)]);
      setAccount(acc);
      setTrades(trs);
    } catch {}
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!account) return (
    <SafeAreaView edges={['top']} style={styles.empty}>
      <Text style={styles.emptyText}>Loading…</Text>
    </SafeAreaView>
  );

  const wins   = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const avgWin  = wins.length   ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.pnl, 0)) / losses.length : 0;
  const profitFactor = avgLoss > 0 ? avgWin / avgLoss * (wins.length / Math.max(losses.length, 1)) : 0;
  const expectancy = trades.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0;

  const rank = account.rank || 'Gambler';
  const rankColor = RANK_COLORS[rank];
  const rankIcon = RANK_ICONS[rank];

  const rankInfo = computeRank({
    totalTrades: account.total_trades ?? 0,
    winRate: account.win_rate ?? 0,
    totalPnl: account.total_pnl ?? 0,
    startingBalance: account.starting_balance ?? 10000,
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      {/* Header — archetype identity (left) balances StreakBadge (right).
          The archetype is the user's "who am I" anchor; identity-based
          motivation only works if the identity is invoked repeatedly. */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.username}>@{username}</Text>
          {archetypeMeta && (
            <View style={styles.archetypeRow}>
              <MaterialCommunityIcons
                name={archetypeMeta.icon}
                size={20}
                color={colors.gold}
                style={styles.archetypeIcon}
              />
              <Text style={styles.archetypeName} numberOfLines={1}>
                {archetypeMeta.name}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <StreakBadge count={streakCount} status={streakStatus} size="small" />
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('Chart')}>
            <Ionicons name="add" size={22} color={colors.bg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Rank Badge — driven by XP from total trades / win rate / return */}
      <View style={[styles.rankBadge, { borderColor: rankInfo.current.color }]}>
        <View style={[styles.rankIconWrap, {
          backgroundColor: rankInfo.current.color + '22',
          borderColor: rankInfo.current.color,
        }]}>
          <Ionicons name={rankInfo.current.icon as any} size={32} color={rankInfo.current.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rankLabel}>CURRENT RANK</Text>
          <Text style={[styles.rankName, { color: rankInfo.current.color }]}>
            {rankInfo.current.label.toUpperCase()}
          </Text>
          <View style={styles.xpRow}>
            <Text style={styles.xpText}>{rankInfo.xp} XP</Text>
            {rankInfo.next && (
              <Text style={styles.xpNext}>{rankInfo.next.minXp - rankInfo.xp} TO {rankInfo.next.label.toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.xpBarTrack}>
            <View style={[styles.xpBarFill, {
              width: `${Math.round(rankInfo.progressPct * 100)}%`,
              backgroundColor: rankInfo.current.color,
            }]} />
          </View>
        </View>
      </View>

      {/* Top stats row */}
      <View style={styles.statsRow}>
        <StatCard
          label="TOTAL P&L"
          value={`${account.total_pnl >= 0 ? '+' : ''}$${account.total_pnl.toFixed(2)}`}
          color={account.total_pnl >= 0 ? colors.green : colors.red}
        />
        <StatCard
          label="WIN RATE"
          value={`${(account.win_rate * 100).toFixed(1)}%`}
          color={colors.green}
        />
      </View>

      {/* Detailed stats */}
      <View style={styles.statsRow}>
        <StatCard
          label="TOTAL TRADES"
          value={`${account.total_trades}`}
        />
        <StatCard
          label="PROFIT FACTOR"
          value={isFinite(profitFactor) && profitFactor > 0 ? profitFactor.toFixed(2) : '—'}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label="AVG WIN"
          value={`$${avgWin.toFixed(2)}`}
          color={colors.green}
        />
        <StatCard
          label="AVG LOSS"
          value={`-$${avgLoss.toFixed(2)}`}
          color={colors.red}
        />
      </View>

      <View style={styles.statsRow}>
        <StatCard
          label="EXPECTANCY"
          value={`$${expectancy.toFixed(2)}`}
          color={expectancy >= 0 ? colors.green : colors.red}
        />
        <StatCard
          label="EQUITY"
          value={`$${(10000 + account.total_pnl).toFixed(0)}`}
        />
      </View>

      {/* Charts */}
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <EquityCurve trades={trades} startBalance={(account.starting_balance ?? 10000)} />
        <WinLossBar trades={trades} />
        <DailyPnlSpark trades={trades} />
        <StreakTracker trades={trades} />
      </View>

      {/* Recent trades */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RECENT TRADES</Text>
      </View>

      {trades.length === 0 ? (
        <View style={styles.emptyTradesBox}>
          <Text style={styles.emptyTradesText}>
            No trades yet. Start a replay session to place your first trade.
          </Text>
        </View>
      ) : (
        <View style={styles.tradeList}>
          {trades.slice(0, 20).map((t) => (
            <TradeCard
              key={t.id}
              symbol={t.symbol}
              direction={t.side === 'buy' ? 'long' : 'short'}
              entryPrice={t.entryPrice}
              exitPrice={t.exitPrice}
              pnl={t.pnl}
              entryTime={t.openedAt}
              exitTime={t.closedAt}
              contracts={t.lots}
              status="closed"
            />
          ))}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  empty: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textSecondary },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  headerLeft: { flexShrink: 1, paddingRight: 12 },
  username: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  // Archetype identity — gold sigil + bold name. Sits where the
  // generic "Your trading dashboard" subtitle used to live.
  archetypeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  archetypeIcon: { marginRight: 6 },
  archetypeName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
  },

  rankBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  rankIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  rankLabel: { ...labelStyle, marginBottom: 4 },
  rankName: { fontSize: fontSize.xl, fontWeight: fontWeight.black, letterSpacing: 1.5 },
  xpRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  xpText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  xpNext: { color: colors.textTertiary, fontSize: 9, fontWeight: fontWeight.semibold, letterSpacing: 0.5 },
  xpBarTrack: {
    height: 4, borderRadius: 2, backgroundColor: colors.cardAlt, marginTop: 4, overflow: 'hidden',
  },
  xpBarFill: { height: '100%', borderRadius: 2 },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  statLabel: { ...labelStyle, fontSize: 9, marginBottom: 4 },
  statValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  sectionHeader: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { ...labelStyle, color: colors.textPrimary },

  // Recent-trades section
  emptyTradesBox: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTradesText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  // 10 px vertical gap between cards, matching the spec.
  tradeList: { gap: 10 },

  green: { color: colors.green },
  red:   { color: colors.red },
});
