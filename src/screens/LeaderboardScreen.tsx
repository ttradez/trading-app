import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Alert, RefreshControl, ScrollView,
  Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { fetchLeaderboard, getFeed, createGroup, joinGroup, getGroupLeaderboard } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useBadgeStore } from '../store/badgeStore';
import {
  BADGES, BADGE_COUNT, CATEGORY_ORDER, CATEGORY_LABEL,
  RARITY_COLOR, Badge,
} from '../data/badges';
import { getBadgeProgress } from '../utils/badgeChecker';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';

type Tab = 'leaderboard' | 'feed' | 'friends';
type Period = 'weekly' | 'monthly' | 'alltime';

const PERIODS: Period[] = ['weekly', 'monthly', 'alltime'];

const RANK_COLORS: Record<string, string> = {
  'Gambler':       colors.rankGambler,
  'Paper Hands':   colors.rankPaperHands,
  'Sniper':        colors.rankSniper,
  'Inside Trader': colors.rankInsideTrader,
  'Market Maker':  colors.rankMarketMaker,
};

export default function LeaderboardScreen({ route }: any) {
  const { uid } = useAuthStore();
  const [view, setView] = useState<'rankings' | 'badges'>(
    route?.params?.initialSegment === 'badges' ? 'badges' : 'rankings',
  );
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [period, setPeriod] = useState<Period>('weekly');
  const [data, setData] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [groupLb, setGroupLb] = useState<any[]>([]);
  const [myGroupId, setMyGroupId] = useState<number | null>(null);

  const loadGlobal = useCallback(async () => {
    setLoading(true);
    try { setData(await fetchLeaderboard(period)); } catch {}
    setLoading(false);
  }, [period]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try { setFeed(await getFeed(50)); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'leaderboard') loadGlobal();
    if (tab === 'feed') loadFeed();
  }, [tab, period]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === 'leaderboard') await loadGlobal();
    if (tab === 'feed') await loadFeed();
    if (tab === 'friends' && myGroupId) {
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
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleJoinGroup = async () => {
    if (!uid || !inviteCode.trim()) return;
    try {
      const res = await joinGroup(uid, inviteCode.trim().toUpperCase());
      setMyGroupId(res.group_id);
      setGroupLb(await getGroupLeaderboard(res.group_id));
      setInviteCode('');
    } catch (e: any) { Alert.alert('Invalid code', e.message); }
  };

  const renderLeaderboardRow = ({ item, index }: any) => {
    const isFirst = index === 0;
    const rankColor = RANK_COLORS[item.rank] || colors.textSecondary;
    return (
      <View style={[styles.lbRow, isFirst && styles.lbRowFirst]}>
        <Text style={[styles.lbRank, isFirst && styles.lbRankFirst]}>{index + 1}</Text>
        <View style={styles.lbTraderCol}>
          <Text style={[styles.lbTraderName, isFirst && styles.lbTraderNameFirst]}>{item.username}</Text>
          <Text style={[styles.lbTraderRank, { color: rankColor }]}>{item.rank || 'Gambler'}</Text>
        </View>
        <Text style={[styles.lbEquity, isFirst && styles.lbEquityFirst]}>
          ${(item.account_size + (item.account_size * item.return_pct / 100)).toLocaleString('en-US', { maximumFractionDigits: 2 })}
        </Text>
        <Text style={[styles.lbScore, isFirst && styles.lbScoreFirst]}>
          {item.return_pct.toFixed(2)}
        </Text>
      </View>
    );
  };

  const renderFeedRow = ({ item }: any) => (
    <View style={styles.feedCard}>
      <View style={styles.feedTop}>
        <Text style={styles.feedUser}>@{item.username}</Text>
        <View style={[styles.feedSideBadge, item.side === 'buy' ? styles.feedBadgeLong : styles.feedBadgeShort]}>
          <Text style={styles.feedSideText}>{item.side === 'buy' ? 'LONG' : 'SHORT'} {item.symbol}</Text>
        </View>
        <Text style={[styles.feedPnl, item.pnl >= 0 ? styles.green : styles.red]}>
          {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
        </Text>
      </View>
      <Text style={styles.feedMeta}>
        {item.pips.toFixed(1)} pips
        {item.r_multiple != null ? `  ·  ${item.r_multiple > 0 ? '+' : ''}${item.r_multiple}R` : ''}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Trophy header */}
      <View style={styles.trophyHeader}>
        <Ionicons name="trophy" size={32} color={colors.gold} />
      </View>

      {/* Top tab bar */}
      <View style={styles.tabBar}>
        {(['leaderboard', 'feed', 'friends'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'leaderboard' ? 'LEADERBOARD' : t === 'feed' ? 'TRADE FEED' : 'FRIENDS'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period sub-tabs (only on leaderboard tab) */}
      {tab === 'leaderboard' && (
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                {p === 'weekly' ? 'WEEKLY' : p === 'monthly' ? 'MONTHLY' : 'ALL TIME'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tournament card (only on leaderboard tab) */}
      {tab === 'leaderboard' && (
        <View style={styles.tourneyCard}>
          <View style={styles.tourneyHeader}>
            <Ionicons name="trophy" size={20} color={colors.gold} />
            <Text style={styles.tourneyTitle}>MAY TOURNAMENT</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <View style={styles.tourneyStats}>
            <View style={styles.tourneyStat}>
              <Text style={styles.tourneyStatLabel}>ENDS IN</Text>
              <Text style={styles.tourneyStatValue}>12D 18H 47M</Text>
            </View>
            <View style={[styles.tourneyStat, { alignItems: 'flex-end' }]}>
              <Text style={styles.tourneyStatLabel}>PRIZE POOL</Text>
              <Text style={[styles.tourneyStatValue, { color: colors.gold }]}>$2,500 USD</Text>
            </View>
          </View>
        </View>
      )}

      {/* Leaderboard column headers */}
      {tab === 'leaderboard' && data.length > 0 && (
        <View style={styles.lbHeader}>
          <Text style={[styles.lbHeaderText, { width: 32 }]}>RANK</Text>
          <Text style={[styles.lbHeaderText, { flex: 1, marginLeft: spacing.sm }]}>TRADER</Text>
          <Text style={[styles.lbHeaderText, { width: 80, textAlign: 'right' }]}>EQUITY</Text>
          <Text style={[styles.lbHeaderText, { width: 60, textAlign: 'right' }]}>SCORE</Text>
        </View>
      )}

      {/* Friends tab inputs */}
      {tab === 'friends' && (
        <View style={styles.friendsBox}>
          <Text style={styles.fieldLabel}>CREATE A GROUP</Text>
          <View style={styles.friendsInputRow}>
            <TextInput
              style={[styles.friendsInput, { flex: 1 }]}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group name"
              placeholderTextColor={colors.textTertiary}
            />
            <TouchableOpacity style={styles.friendsBtn} onPress={handleCreateGroup}>
              <Text style={styles.friendsBtnText}>CREATE</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>JOIN WITH CODE</Text>
          <View style={styles.friendsInputRow}>
            <TextInput
              style={[styles.friendsInput, { flex: 1 }]}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="XXXXXXXX"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.friendsBtn} onPress={handleJoinGroup}>
              <Text style={styles.friendsBtnText}>JOIN</Text>
            </TouchableOpacity>
          </View>

          {groupLb.length > 0 && (
            <Text style={[styles.fieldLabel, { marginTop: spacing.xl }]}>GROUP RANKINGS</Text>
          )}
        </View>
      )}
    </>
  );

  const segmentToggle = (
    <View style={styles.segmentRow}>
      {(['rankings', 'badges'] as const).map((v) => (
        <TouchableOpacity
          key={v}
          style={[styles.segBtn, view === v && styles.segBtnActive]}
          onPress={() => setView(v)}
        >
          <Text style={[styles.segText, view === v && styles.segTextActive]}>
            {v === 'rankings' ? 'LEADERBOARD' : 'BADGES'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (view === 'badges') {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {segmentToggle}
        <TrophyCase />
      </SafeAreaView>
    );
  }

  if (loading && data.length === 0 && feed.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        {segmentToggle}
        {renderHeader()}
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
    {segmentToggle}
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
      data={tab === 'leaderboard' ? data : tab === 'feed' ? feed : groupLb}
      keyExtractor={(_, i) => `${i}`}
      renderItem={tab === 'feed' ? renderFeedRow : renderLeaderboardRow}
      ListHeaderComponent={renderHeader}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {tab === 'leaderboard' ? 'No results yet — start trading!' :
               tab === 'feed' ? 'No public trades yet.' :
               !myGroupId ? 'Create or join a group above.' : ''}
            </Text>
          </View>
        ) : null
      }
    />
    </SafeAreaView>
  );
}

/** Trophy case — progress bar + category-grouped 4-per-row grid.
 *  Tap any badge → detail modal (unlocked: description + date;
 *  locked: condition + numeric progress when applicable). */
function TrophyCase() {
  const unlockedMap = useBadgeStore((s) => s.unlockedBadges);
  const unlockedCount = Object.keys(unlockedMap).length;
  const [selected, setSelected] = useState<Badge | null>(null);

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.tcCount}>
          {unlockedCount} / {BADGE_COUNT} unlocked
        </Text>
        <View style={styles.tcBarTrack}>
          <View
            style={[
              styles.tcBarFill,
              { width: `${Math.round((unlockedCount / BADGE_COUNT) * 100)}%` },
            ]}
          />
        </View>

        {CATEGORY_ORDER.map((cat) => (
          <View key={cat} style={styles.tcCatBlock}>
            <Text style={styles.tcCatLabel}>{CATEGORY_LABEL[cat]}</Text>
            <View style={styles.tcGrid}>
              {BADGES.filter((b) => b.category === cat).map((b) => {
                const unlocked = !!unlockedMap[b.id];
                const accent = RARITY_COLOR[b.rarity];
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={styles.tcCell}
                    activeOpacity={0.8}
                    onPress={() => setSelected(b)}
                  >
                    <View
                      style={[
                        styles.tcIconWrap,
                        unlocked
                          ? { borderColor: accent }
                          : styles.tcIconWrapLocked,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={unlocked ? b.icon : 'lock'}
                        size={26}
                        color={unlocked ? accent : 'rgba(255,255,255,0.3)'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.tcName,
                        !unlocked && styles.tcNameLocked,
                      ]}
                      numberOfLines={1}
                    >
                      {unlocked ? b.name : '???'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <BadgeDetailModal
        badge={selected}
        unlockedAt={selected ? unlockedMap[selected.id] ?? null : null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function BadgeDetailModal({
  badge, unlockedAt, onClose,
}: { badge: Badge | null; unlockedAt: string | null; onClose: () => void }) {
  if (!badge) return null;
  const unlocked = unlockedAt !== null;
  const accent = RARITY_COLOR[badge.rarity];
  const progress = !unlocked ? getBadgeProgress(badge.id) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.bdBackdrop} onPress={onClose}>
        <Pressable style={styles.bdCard} onPress={() => {}}>
          <View
            style={[
              styles.bdIconWrap,
              { borderColor: unlocked ? accent : '#2A2A2A' },
            ]}
          >
            <MaterialCommunityIcons
              name={unlocked ? badge.icon : 'lock'}
              size={44}
              color={unlocked ? accent : 'rgba(255,255,255,0.3)'}
            />
          </View>
          <Text style={styles.bdName}>{unlocked ? badge.name : '???'}</Text>
          <View style={[styles.bdRarity, { borderColor: accent }]}>
            <Text style={[styles.bdRarityText, { color: accent }]}>
              {badge.rarity.toUpperCase()}
            </Text>
          </View>

          {unlocked ? (
            <>
              <Text style={styles.bdDesc}>{badge.description}</Text>
              {unlockedAt && (
                <Text style={styles.bdDate}>
                  Unlocked {new Date(unlockedAt).toLocaleDateString()}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.bdDesc}>{badge.condition}</Text>
              {progress && (
                <Text style={styles.bdProgress}>
                  {progress.current} / {progress.target}
                </Text>
              )}
            </>
          )}

          <TouchableOpacity style={styles.bdClose} onPress={onClose}>
            <Text style={styles.bdCloseText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  trophyHeader: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.md },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.md },
  tabBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.gold },
  tabText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
  tabTextActive: { color: colors.gold },

  periodRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  periodBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.sm, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
  },
  periodBtnActive: { backgroundColor: colors.cardAlt, borderColor: colors.gold },
  periodText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  periodTextActive: { color: colors.gold },

  tourneyCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.gold,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  tourneyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  tourneyTitle: { color: colors.textPrimary, fontWeight: fontWeight.black, letterSpacing: 1.5, fontSize: fontSize.md, marginLeft: spacing.sm, flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.redDim, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red, marginRight: 4 },
  liveText: { color: '#fff', fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1 },
  tourneyStats: { flexDirection: 'row', justifyContent: 'space-between' },
  tourneyStat: { flex: 1 },
  tourneyStatLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 1.2, marginBottom: 2 },
  tourneyStatValue: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },

  lbHeader: { flexDirection: 'row', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.sm },
  lbHeaderText: { color: colors.textSecondary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1.2 },

  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbRowFirst: { backgroundColor: colors.cardAlt, borderRadius: radius.md, paddingHorizontal: spacing.sm, borderColor: colors.gold, borderWidth: 1, marginBottom: spacing.sm },
  lbRank: { color: colors.textSecondary, width: 32, fontSize: fontSize.md, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  lbRankFirst: { color: colors.gold },
  lbTraderCol: { flex: 1, marginLeft: spacing.sm },
  lbTraderName: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  lbTraderNameFirst: { fontWeight: fontWeight.bold, color: colors.gold },
  lbTraderRank: { fontSize: fontSize.xs, marginTop: 2, fontWeight: fontWeight.semibold },
  lbEquity: { color: colors.textPrimary, width: 80, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  lbEquityFirst: { color: colors.gold },
  lbScore: { color: colors.textPrimary, width: 60, textAlign: 'right', fontSize: fontSize.sm, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  lbScoreFirst: { color: colors.gold },

  feedCard: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  feedTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: spacing.sm },
  feedUser: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  feedSideBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  feedBadgeLong: { backgroundColor: colors.greenDim },
  feedBadgeShort: { backgroundColor: colors.redDim },
  feedSideText: { color: '#fff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  feedPnl: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  feedMeta: { color: colors.textSecondary, fontSize: fontSize.xs },

  friendsBox: { paddingBottom: spacing.md },
  fieldLabel: { ...labelStyle, marginBottom: spacing.sm },
  friendsInputRow: { flexDirection: 'row', gap: spacing.sm },
  friendsInput: {
    backgroundColor: colors.card, color: colors.textPrimary,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border, fontSize: fontSize.md,
  },
  friendsBtn: {
    backgroundColor: colors.gold, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, justifyContent: 'center',
  },
  friendsBtnText: { color: colors.bg, fontWeight: fontWeight.bold, letterSpacing: 1.5, fontSize: fontSize.xs },

  emptyBox: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.sm },

  green: { color: colors.green },
  red:   { color: colors.red },

  // Segment toggle (Leaderboard | Badges)
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  segBtnActive: { backgroundColor: colors.cardAlt },
  segText: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.2,
  },
  segTextActive: { color: colors.gold },

  // Trophy case
  tcCount: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
    fontVariant: ['tabular-nums'],
  },
  tcBarTrack: {
    marginTop: spacing.sm,
    height: 5,
    backgroundColor: '#1F1F1F',
    borderRadius: 3,
    overflow: 'hidden',
  },
  tcBarFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 3,
  },
  tcCatBlock: { marginTop: spacing.xl },
  tcCatLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  tcGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tcCell: {
    width: '25%',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: 4,
  },
  tcIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  tcIconWrapLocked: {
    borderColor: '#2A2A2A',
    opacity: 0.6,
  },
  tcName: {
    marginTop: 6,
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  tcNameLocked: { color: 'rgba(255,255,255,0.3)' },

  // Badge detail modal
  bdBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  bdCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F0F0F',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 18,
    padding: spacing.xl,
    alignItems: 'center',
  },
  bdIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bdName: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    letterSpacing: -0.3,
  },
  bdRarity: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bdRarityText: {
    fontSize: 10,
    fontWeight: fontWeight.black,
    letterSpacing: 1,
  },
  bdDesc: {
    marginTop: spacing.lg,
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  bdDate: {
    marginTop: spacing.md,
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  bdProgress: {
    marginTop: spacing.md,
    color: colors.gold,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
    fontVariant: ['tabular-nums'],
  },
  bdClose: {
    marginTop: spacing.xl,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
  },
  bdCloseText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
});
