import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAccount, getTrades } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useStreakStore, computeDisplayStatus } from '../store/streakStore';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { EquityCurve, WinLossBar, DailyPnlSpark, StreakTracker } from '../components/DashboardCharts';
import StreakBadge from '../components/StreakBadge';
import { computeRank } from '../utils/ranks';

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.username}>@{username}</Text>
          <Text style={styles.subtitle}>Your trading dashboard</Text>
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
          <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyTradesText}>No trades yet</Text>
          <TouchableOpacity style={styles.startCta} onPress={() => navigation.navigate('Chart')}>
            <Text style={styles.startCtaText}>START TRADING</Text>
          </TouchableOpacity>
        </View>
      ) : (
        trades.slice(0, 20).map((t) => (
          <View key={t.id} style={styles.tradeCard}>
            <View style={styles.tradeRow1}>
              <View style={styles.tradeLeft}>
                <Text style={styles.tradeSymbol}>{t.symbol}</Text>
                <View style={[styles.tradeSideBadge, t.side === 'buy' ? styles.badgeLong : styles.badgeShort]}>
                  <Text style={styles.tradeSideText}>{t.side === 'buy' ? 'LONG' : 'SHORT'}</Text>
                </View>
              </View>
              <Text style={[styles.tradePnl, t.pnl >= 0 ? styles.green : styles.red]}>
                {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
              </Text>
            </View>
            <Text style={styles.tradeMeta}>
              {t.lots} lots · {t.pips.toFixed(1)} pips
              {t.r_multiple != null ? `  ·  ${t.r_multiple > 0 ? '+' : ''}${t.r_multiple}R` : ''}
            </Text>
          </View>
        ))
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
  username: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  subtitle: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
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

  emptyTradesBox: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.xxl, alignItems: 'center', gap: spacing.md,
  },
  emptyTradesText: { color: colors.textSecondary, fontSize: fontSize.md },
  startCta: {
    backgroundColor: colors.gold, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  startCtaText: { color: colors.bg, fontWeight: fontWeight.bold, letterSpacing: 1.5, fontSize: fontSize.sm },

  tradeCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  tradeRow1: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tradeLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tradeSymbol: { color: colors.textPrimary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  tradeSideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  badgeLong:  { backgroundColor: colors.greenDim },
  badgeShort: { backgroundColor: colors.redDim },
  tradeSideText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  tradePnl: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  tradeMeta: { color: colors.textSecondary, fontSize: fontSize.xs },

  green: { color: colors.green },
  red:   { color: colors.red },
});
