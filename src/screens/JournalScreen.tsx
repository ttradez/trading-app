import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { useJournalStore, JournalEntry, Emotion } from '../store/journalStore';
import TradeCard from '../components/TradeCard';
import SectionHeader from '../components/SectionHeader';
import MoneyText from '../components/MoneyText';
import { colors as JT } from '../theme/tokens';
import { useTradeJournalStore } from '../store/tradeJournalStore';
import { useRecapList } from '../store/recapStore';
import WeeklyRecapModal from '../components/WeeklyRecapModal';
import { WeeklyRecap } from '../utils/weeklyRecap';

const EMOTIONS: { id: Emotion; label: string; icon: string; color: string }[] = [
  { id: 'fear',         label: 'Fear',         icon: 'eye-off-outline',     color: '#A855F7' },
  { id: 'greed',        label: 'Greed',        icon: 'cash-outline',        color: '#F59E0B' },
  { id: 'revenge',      label: 'Revenge',      icon: 'flame-outline',       color: '#EF4444' },
  { id: 'fomo',         label: 'FOMO',         icon: 'trending-up-outline', color: '#EC4899' },
  { id: 'confidence',   label: 'Confidence',   icon: 'shield-checkmark-outline', color: '#22C55E' },
  { id: 'patience',     label: 'Patience',     icon: 'hourglass-outline',   color: '#3B82F6' },
  { id: 'frustration',  label: 'Frustration',  icon: 'alert-circle-outline', color: '#F97316' },
  { id: 'calm',         label: 'Calm',         icon: 'water-outline',       color: '#26A69A' },
];

type Filter = 'all' | 'wins' | 'losses';

export default function JournalScreen({ navigation }: any) {
  const { entries } = useJournalStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openRecap, setOpenRecap] = useState<WeeklyRecap | null>(null);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  const filtered = useMemo(() => {
    let out = entries;
    if (filter === 'wins')    out = out.filter((e) => e.pnl > 0);
    if (filter === 'losses')  out = out.filter((e) => e.pnl < 0);
    if (search.trim())        out = out.filter((e) =>
      `${e.symbol} ${e.notes} ${e.strategy} ${e.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())
    );
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }, [entries, filter, search]);

  const totalPnl = filtered.reduce((sum, e) => sum + e.pnl, 0);
  const wins  = filtered.filter((e) => e.pnl > 0).length;
  const losses = filtered.filter((e) => e.pnl < 0).length;
  const winRate = filtered.length ? Math.round((wins / filtered.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
        <Text style={styles.headerSub}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by symbol, strategy, notes…"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {(['all', 'wins', 'losses'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={[labelStyle, styles.summaryLabel]}>P&L</Text>
          <MoneyText
            value={totalPnl}
            size={fontSize.lg}
            // Zero P&L stays neutral white — green only for positive,
            // red only for negative. Was painting $0.00 as a "win"
            // by accident. (DESIGN_AUDIT §3.3)
            style={[
              styles.summaryValue,
              totalPnl > 0 && styles.green,
              totalPnl < 0 && styles.red,
            ]}
          />
        </View>
        <View style={styles.summaryItem}>
          <Text style={[labelStyle, styles.summaryLabel]}>WIN RATE</Text>
          <Text style={styles.summaryValue}>{winRate}%</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[labelStyle, styles.summaryLabel]}>W/L</Text>
          <Text style={styles.summaryValue}>{wins}/{losses}</Text>
        </View>
      </View>

      {/* Your Tendencies — entry to the Insights screen. */}
      <TouchableOpacity
        style={styles.insightsCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Insights')}
        accessibilityRole="button"
        accessibilityLabel="Your Tendencies — see your trading patterns"
      >
        <View style={styles.insightsIconWrap}>
          <MaterialCommunityIcons name="brain" size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.insightsTitle}>Your Tendencies</Text>
          <Text style={styles.insightsSub}>See your trading patterns →</Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color="rgba(255,255,255,0.3)"
        />
      </TouchableOpacity>

      {/* List */}
      {filtered.length === 0 ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <RecapsSection onOpen={setOpenRecap} />
          <View style={styles.empty}>
            <Text style={styles.emptyMessage}>
              No trades yet. Start a session to place your first trade.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<RecapsSection onOpen={setOpenRecap} />}
          ItemSeparatorComponent={() => <View style={styles.listGap} />}
          renderItem={({ item }) => (
            <JournalTradeCard entry={item} onPress={() => setEditing(item)} />
          )}
        />
      )}

      {/* Edit modal */}
      <EntryEditModal entry={editing} onClose={() => setEditing(null)} />

      {/* Tapped past-recap review */}
      <WeeklyRecapModal
        visible={openRecap !== null}
        recap={openRecap}
        onClose={() => setOpenRecap(null)}
      />
    </SafeAreaView>
  );
}

/** "Weekly Recaps" section pinned above the trade list. Compact
 *  rows (date range · win rate · total P&L); tap → reopen the full
 *  recap modal for that week. Newest first. */
function RecapsSection({ onOpen }: { onOpen: (r: WeeklyRecap) => void }) {
  const recaps = useRecapList();
  return (
    <View style={styles.recapSection}>
      <View style={styles.recapHeader}>
        <SectionHeader
          title="Weekly Recaps"
          variant="eyebrow"
          icon={<MaterialCommunityIcons name="calendar-range" size={13} color={JT.textTertiary} />}
        />
      </View>
      {recaps.length === 0 ? (
        <Text style={styles.recapEmpty}>
          Complete your first week of trading to unlock your Weekly Recap.
        </Text>
      ) : (
        recaps.map(({ recap }) => {
          const pnlPos = recap.totalPnL >= 0;
          return (
            <TouchableOpacity
              key={recap.weekId}
              style={styles.recapRow}
              activeOpacity={0.8}
              onPress={() => onOpen(recap)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.recapRange}>{recap.dateRange}</Text>
                <Text style={styles.recapSub}>
                  {recap.totalTrades} {recap.totalTrades === 1 ? 'trade' : 'trades'}
                  {recap.winRate != null ? `  ·  ${recap.winRate}% win` : ''}
                </Text>
              </View>
              <Text
                style={[styles.recapPnl, pnlPos ? styles.green : styles.red]}
                allowFontScaling={false}
              >
                {pnlPos ? '+' : '-'}${Math.abs(recap.totalPnL).toFixed(2)}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color="rgba(255,255,255,0.3)"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

/** Per-row wrapper that looks the journaled grade up by entry id
 *  and forwards it into TradeCard. Defined as its own component so
 *  the hook call is legal (one per row, not one per iteration in
 *  a render callback). */
function JournalTradeCard({
  entry, onPress,
}: { entry: JournalEntry; onPress: () => void }) {
  const grade = useTradeJournalStore((s) => s.entries[entry.id]?.grade);
  return (
    <TradeCard
      symbol={entry.symbol}
      direction={entry.side === 'buy' ? 'long' : 'short'}
      entryPrice={entry.entryPrice}
      exitPrice={entry.exitPrice}
      pnl={entry.pnl}
      entryTime={entry.openedAt}
      exitTime={entry.closedAt}
      contracts={entry.lots}
      status="closed"
      grade={grade}
      planSetupType={entry.planSetupType}
      onPress={onPress}
    />
  );
}

function EntryEditModal({ entry, onClose }: { entry: JournalEntry | null; onClose: () => void }) {
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const [notes, setNotes]         = useState('');
  const [mistakes, setMistakes]   = useState('');
  const [wentWell, setWentWell]   = useState('');
  const [strategy, setStrategy]   = useState('');
  const [emotion, setEmotion]     = useState<Emotion | null>(null);
  const [confidence, setConf]     = useState<number | null>(null);

  React.useEffect(() => {
    if (!entry) return;
    setNotes(entry.notes); setMistakes(entry.mistakes); setWentWell(entry.wentWell);
    setStrategy(entry.strategy); setEmotion(entry.emotion); setConf(entry.confidence);
  }, [entry]);

  if (!entry) return null;

  const save = () => {
    updateEntry(entry.id, { notes, mistakes, wentWell, strategy, emotion, confidence });
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.editBackdrop} onPress={onClose}>
        <Pressable style={styles.editSheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>{entry.symbol}  ·  {entry.side.toUpperCase()}</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity>
            </View>

            <Text style={[labelStyle, styles.editLabel]}>Strategy used</Text>
            <TextInput style={styles.editInput} value={strategy} onChangeText={setStrategy}
                       placeholder="e.g. Liquidity sweep, FVG, etc." placeholderTextColor={colors.textTertiary} />

            <Text style={[labelStyle, styles.editLabel]}>Notes</Text>
            <TextInput style={[styles.editInput, { height: 70 }]} multiline value={notes} onChangeText={setNotes}
                       placeholder="What happened on this trade?" placeholderTextColor={colors.textTertiary} />

            <Text style={[labelStyle, styles.editLabel]}>What went well</Text>
            <TextInput style={[styles.editInput, { height: 60 }]} multiline value={wentWell} onChangeText={setWentWell}
                       placeholder="Things you executed correctly" placeholderTextColor={colors.textTertiary} />

            <Text style={[labelStyle, styles.editLabel]}>Mistakes</Text>
            <TextInput style={[styles.editInput, { height: 60 }]} multiline value={mistakes} onChangeText={setMistakes}
                       placeholder="What you'd do differently" placeholderTextColor={colors.textTertiary} />

            <Text style={[labelStyle, styles.editLabel]}>Emotional state</Text>
            <View style={styles.emotionGrid}>
              {EMOTIONS.map((em) => (
                <TouchableOpacity
                  key={em.id}
                  style={[styles.emotionPill, emotion === em.id && { backgroundColor: em.color, borderColor: em.color }]}
                  onPress={() => setEmotion(emotion === em.id ? null : em.id)}
                >
                  <Ionicons name={em.icon as any} size={12} color={emotion === em.id ? '#fff' : em.color} style={{ marginRight: 4 }} />
                  <Text style={[styles.emotionPillText, emotion === em.id && { color: '#fff' }]}>{em.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[labelStyle, styles.editLabel]}>Confidence</Text>
            <View style={styles.confRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setConf(confidence === n ? null : n)}>
                  <Ionicons name={confidence != null && confidence >= n ? 'star' : 'star-outline'}
                            size={28} color={colors.gold} style={{ marginRight: 4 }} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>SAVE</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerTitle: { color: colors.textPrimary, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  headerSub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.lg, marginVertical: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm },

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 6, marginBottom: spacing.sm },
  filterPill: {
    paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  filterTextActive: { color: colors.bg },

  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 9 },
  summaryValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginTop: 2 },

  insightsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderTopColor: JT.hairlineHighlight,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  insightsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: JT.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  insightsSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyMessage: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },

  // Trade-card list — vertical stack with 10 px gap, matching spec.
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  listGap: { height: 10 },

  // Weekly Recaps section (pinned above the trade list)
  recapSection: { marginBottom: spacing.lg },
  recapHeader: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  recapEmpty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    paddingVertical: 8,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  recapRange: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  recapSub: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  recapPnl: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Edit modal
  editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '90%' },
  editHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  editTitle: { flex: 1, color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  editLabel: { marginTop: spacing.md, marginBottom: spacing.xs },
  editInput: {
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.textPrimary, fontSize: fontSize.md,
  },

  emotionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emotionPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardAlt, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 6,
  },
  emotionPillText: { color: colors.textPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

  confRow: { flexDirection: 'row', marginTop: spacing.xs },

  saveBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.gold,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.bg, fontWeight: fontWeight.black, letterSpacing: 1.5, fontSize: fontSize.md },

  green: { color: colors.green },
  red:   { color: colors.red },
});
