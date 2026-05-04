import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from 'react-native';
import { fetchLeaderboard, getFeed, createGroup, joinGroup, getGroupLeaderboard } from '../services/api';
import { useAuthStore } from '../store/authStore';

type Tab = 'global' | 'feed' | 'groups';
type Period = 'weekly' | 'monthly' | 'alltime';

const PERIODS: Period[] = ['weekly', 'monthly', 'alltime'];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { uid } = useAuthStore();
  const [tab, setTab]     = useState<Tab>('global');
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData]   = useState<any[]>([]);
  const [feed, setFeed]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Groups state
  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [groupLb, setGroupLb] = useState<any[]>([]);
  const [myGroupId, setMyGroupId] = useState<number | null>(null);

  const loadGlobal = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchLeaderboard(period));
    } catch {}
    setLoading(false);
  }, [period]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await getFeed(50));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'global') loadGlobal();
    if (tab === 'feed')   loadFeed();
  }, [tab, period]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'global') await loadGlobal();
    if (tab === 'feed')   await loadFeed();
    if (tab === 'groups' && myGroupId) {
      setGroupLb(await getGroupLeaderboard(myGroupId).catch(() => []));
    }
    setRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!uid || !groupName.trim()) return;
    try {
      const res = await createGroup(uid, groupName.trim());
      setMyGroupId(res.group_id);
      setGroupLb(await getGroupLeaderboard(res.group_id));
      Alert.alert('Group created!', `Invite code: ${res.invite_code}`);
      setGroupName('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleJoinGroup = async () => {
    if (!uid || !inviteCode.trim()) return;
    try {
      const res = await joinGroup(uid, inviteCode.trim().toUpperCase());
      setMyGroupId(res.group_id);
      setGroupLb(await getGroupLeaderboard(res.group_id));
      setInviteCode('');
    } catch (e: any) {
      Alert.alert('Invalid code', e.message);
    }
  };

  const renderGlobalRow = ({ item, index }: any) => (
    <View style={styles.row}>
      <Text style={styles.rankNum}>{index < 3 ? MEDALS[index] : `#${index + 1}`}</Text>
      <View style={styles.info}>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.sub}>
          {item.symbol} · {item.total_trades} trades · {(item.win_rate * 100).toFixed(1)}% WR
        </Text>
      </View>
      <Text style={[styles.returnPct, item.return_pct >= 0 ? styles.green : styles.red]}>
        {item.return_pct >= 0 ? '+' : ''}{item.return_pct.toFixed(2)}%
      </Text>
    </View>
  );

  const renderFeedRow = ({ item }: any) => (
    <View style={styles.feedCard}>
      <View style={styles.feedTop}>
        <Text style={styles.feedUser}>@{item.username}</Text>
        <Text style={[styles.feedSide, item.side === 'buy' ? styles.green : styles.red]}>
          {item.side.toUpperCase()} {item.symbol}
        </Text>
        <Text style={[styles.feedPnl, item.pnl >= 0 ? styles.green : styles.red]}>
          {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
        </Text>
      </View>
      <Text style={styles.feedSub}>
        {item.pips.toFixed(1)} pips{item.r_multiple != null ? `  ·  ${item.r_multiple > 0 ? '+' : ''}${item.r_multiple}R` : ''}
      </Text>
    </View>
  );

  const renderGroupRow = ({ item, index }: any) => (
    <View style={styles.row}>
      <Text style={styles.rankNum}>{index < 3 ? MEDALS[index] : `#${index + 1}`}</Text>
      <View style={styles.info}>
        <Text style={styles.username}>@{item.username}</Text>
        <Text style={styles.sub}>{item.total_trades} trades · {(item.win_rate * 100).toFixed(1)}% WR · {item.rank}</Text>
      </View>
      <Text style={[styles.returnPct, item.total_pnl >= 0 ? styles.green : styles.red]}>
        {item.total_pnl >= 0 ? '+' : ''}${item.total_pnl.toFixed(0)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Leaderboard</Text>

      {/* Main tab bar */}
      <View style={styles.tabBar}>
        {(['global', 'feed', 'groups'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'global' ? 'Global' : t === 'feed' ? 'Feed' : 'Groups'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period tabs (global only) */}
      {tab === 'global' && (
        <View style={styles.periodBar}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#58a6ff" style={{ marginTop: 40 }} />
      ) : tab === 'global' ? (
        <FlatList
          data={data}
          keyExtractor={(_, i) => `${i}`}
          renderItem={renderGlobalRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58a6ff" />}
          ListEmptyComponent={<Text style={styles.emptyText}>No results yet — start trading!</Text>}
        />
      ) : tab === 'feed' ? (
        <FlatList
          data={feed}
          keyExtractor={(_, i) => `${i}`}
          renderItem={renderFeedRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58a6ff" />}
          ListEmptyComponent={<Text style={styles.emptyText}>No public trades yet.</Text>}
        />
      ) : (
        // Groups tab
        <FlatList
          data={groupLb}
          keyExtractor={(_, i) => `${i}`}
          renderItem={renderGroupRow}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#58a6ff" />}
          ListHeaderComponent={
            <View style={styles.groupActions}>
              <Text style={styles.groupLabel}>Create a group</Text>
              <View style={styles.groupRow}>
                <TextInput
                  style={[styles.groupInput, { flex: 1 }]}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder="Group name"
                  placeholderTextColor="#555"
                />
                <TouchableOpacity style={styles.groupBtn} onPress={handleCreateGroup}>
                  <Text style={styles.groupBtnText}>Create</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.groupLabel, { marginTop: 12 }]}>Join with code</Text>
              <View style={styles.groupRow}>
                <TextInput
                  style={[styles.groupInput, { flex: 1 }]}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="XXXXXXXX"
                  placeholderTextColor="#555"
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.groupBtn} onPress={handleJoinGroup}>
                  <Text style={styles.groupBtnText}>Join</Text>
                </TouchableOpacity>
              </View>
              {groupLb.length > 0 && <Text style={[styles.groupLabel, { marginTop: 16 }]}>Group Rankings</Text>}
            </View>
          }
          ListEmptyComponent={!myGroupId ? <Text style={styles.emptyText}>Create or join a group above.</Text> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117', paddingHorizontal: 16, paddingTop: 16 },
  header: { color: '#e6edf3', fontSize: 26, fontWeight: '900', marginBottom: 16, marginTop: 8 },

  tabBar: { flexDirection: 'row', backgroundColor: '#161b22', borderRadius: 10, padding: 4, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#1f6feb' },
  tabText: { color: '#8b949e', fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  periodBar: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, backgroundColor: '#161b22' },
  periodActive: { backgroundColor: '#21262d' },
  periodText: { color: '#8b949e', fontWeight: '600', fontSize: 13 },
  periodTextActive: { color: '#e6edf3' },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#161b22',
    borderRadius: 10, padding: 14, marginBottom: 8,
  },
  rankNum: { fontSize: 18, width: 38 },
  info: { flex: 1 },
  username: { color: '#e6edf3', fontWeight: '700', fontSize: 15 },
  sub: { color: '#8b949e', fontSize: 12, marginTop: 2 },
  returnPct: { fontSize: 17, fontWeight: '900' },

  feedCard: { backgroundColor: '#161b22', borderRadius: 10, padding: 12, marginBottom: 8 },
  feedTop: { flexDirection: 'row', alignItems: 'center' },
  feedUser: { color: '#e6edf3', fontWeight: '700', flex: 1 },
  feedSide: { fontWeight: '600', marginRight: 10 },
  feedPnl: { fontWeight: '800', fontSize: 15 },
  feedSub: { color: '#8b949e', fontSize: 11, marginTop: 4 },

  groupActions: { paddingBottom: 8 },
  groupLabel: { color: '#8b949e', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  groupRow: { flexDirection: 'row', gap: 8 },
  groupInput: {
    backgroundColor: '#161b22', color: '#e6edf3', borderRadius: 8,
    padding: 10, borderWidth: 1, borderColor: '#30363d',
  },
  groupBtn: { backgroundColor: '#1f6feb', paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  groupBtnText: { color: '#fff', fontWeight: '700' },

  emptyText: { color: '#8b949e', textAlign: 'center', marginTop: 40, fontSize: 15 },

  green: { color: '#3fb950' },
  red: { color: '#f85149' },
});
