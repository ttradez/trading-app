import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { getAccount, getTrades } from '../services/api';
import { useAuthStore } from '../store/authStore';

const RANK_COLORS: Record<string, string> = {
  'Gambler':       '#8b949e',
  'Paper Hands':   '#f0883e',
  'Sniper':        '#58a6ff',
  'Inside Trader': '#d2a8ff',
  'Market Maker':  '#ffd700',
};

export default function DashboardScreen({ navigation }: any) {
  const { uid, username } = useAuthStore();
  const [account, setAccount] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!uid) return;
    try {
      const [acc, trs] = await Promise.all([getAccount(uid), getTrades(uid, 50)]);
      setAccount(acc);
      setTrades(trs);
    } catch {}
  };

  useEffect(() => { load(); }, [uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!account) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  const wins   = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  const avgWin  = wins   > 0 ? trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins   : 0;
  const avgLoss = losses > 0 ? Math.abs(trades.filter((t) => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0) / losses) : 0;
  const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';

  const rankColor = RANK_COLORS[account.rank] ?? '#e6edf3';

  const stat = (label: string, value: string, color = '#e6edf3') => (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58a6ff" />}
    >
      {/* Header */}
      <View style={styles.profileRow}>
        <View>
          <Text style={styles.username}>@{username}</Text>
          <Text style={[styles.rank, { color: rankColor }]}>{account.rank}</Text>
        </View>
        <TouchableOpacity style={styles.newSessionBtn} onPress={() => navigation.navigate('Markets')}>
          <Text style={styles.newSessionText}>+ New Session</Text>
        </TouchableOpacity>
      </View>

      {/* Account */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.row}>
          {stat('Total P&L', `${account.total_pnl >= 0 ? '+' : ''}$${account.total_pnl.toFixed(2)}`, account.total_pnl >= 0 ? '#3fb950' : '#f85149')}
          {stat('Win Rate', `${(account.win_rate * 100).toFixed(1)}%`, '#3fb950')}
        </View>
        <View style={styles.row}>
          {stat('Total Trades', `${account.total_trades}`)}
          {stat('Risk:Reward', `1:${rr}`)}
        </View>
      </View>

      {/* Recent Trades journal */}
      {trades.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trade Journal</Text>
          {trades.slice(0, 20).map((t) => (
            <View key={t.id} style={styles.tradeCard}>
              <View style={styles.tradeTop}>
                <Text style={styles.tradeSymbol}>{t.symbol}</Text>
                <Text style={[styles.tradeSide, t.side === 'buy' ? styles.green : styles.red]}>
                  {t.side.toUpperCase()}
                </Text>
                <Text style={[styles.tradePnl, t.pnl >= 0 ? styles.green : styles.red]}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                </Text>
              </View>
              <View style={styles.tradeBottom}>
                <Text style={styles.tradeMeta}>
                  {t.lots} lots  ·  {t.pips.toFixed(1)} pips
                  {t.r_multiple != null ? `  ·  ${t.r_multiple > 0 ? '+' : ''}${t.r_multiple}R` : ''}
                </Text>
                {t.news_snapshot && JSON.parse(t.news_snapshot).length > 0 && (
                  <Text style={styles.newsHeadline} numberOfLines={1}>
                    "{JSON.parse(t.news_snapshot)[0]}"
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', padding: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d1117' },
  emptyText: { color: '#8b949e' },

  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  username: { color: '#e6edf3', fontSize: 22, fontWeight: '900' },
  rank: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  newSessionBtn: { backgroundColor: '#1f6feb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  newSessionText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  section: { marginBottom: 24 },
  sectionTitle: { color: '#8b949e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#161b22', borderRadius: 10, padding: 14 },
  statLabel: { color: '#8b949e', fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },

  tradeCard: { backgroundColor: '#161b22', borderRadius: 10, padding: 12, marginBottom: 8 },
  tradeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  tradeSymbol: { color: '#e6edf3', fontWeight: '700', flex: 1 },
  tradeSide: { fontWeight: '600', marginRight: 12 },
  tradePnl: { fontWeight: '800', fontSize: 15 },
  tradeBottom: {},
  tradeMeta: { color: '#8b949e', fontSize: 11 },
  newsHeadline: { color: '#6e7681', fontSize: 11, fontStyle: 'italic', marginTop: 4 },

  green: { color: '#3fb950' },
  red: { color: '#f85149' },
});
