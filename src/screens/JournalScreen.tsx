import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';
import { useJournalStore, JournalEntry, Emotion } from '../store/journalStore';

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

export default function JournalScreen() {
  const { entries, removeEntry } = useJournalStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
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
          <Text style={[styles.summaryValue, totalPnl >= 0 ? styles.green : styles.red]}>
            {totalPnl >= 0 ? '+' : ''}${Math.abs(totalPnl).toFixed(2)}
          </Text>
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

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="journal-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptySub}>Close a trade and tap "Journal Trade" to save it here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
          renderItem={({ item }) => <EntryRow entry={item} onPress={() => setEditing(item)} onDelete={() => removeEntry(item.id)} />}
        />
      )}

      {/* Edit modal */}
      <EntryEditModal entry={editing} onClose={() => setEditing(null)} />
    </SafeAreaView>
  );
}

function EntryRow({ entry, onPress, onDelete }: { entry: JournalEntry; onPress: () => void; onDelete: () => void }) {
  const win = entry.pnl >= 0;
  return (
    <TouchableOpacity style={[styles.row, win ? styles.rowWin : styles.rowLoss]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.rowAccent, { backgroundColor: win ? colors.green : colors.red }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowSymbol}>{entry.symbol}</Text>
          <Text style={[styles.rowSide, { color: entry.side === 'buy' ? colors.green : colors.red }]}>
            {entry.side.toUpperCase()}
          </Text>
          <Text style={styles.rowDate}>{new Date(entry.closedAt).toLocaleDateString()}</Text>
        </View>
        <View style={styles.rowMid}>
          <Text style={[styles.rowPnl, win ? styles.green : styles.red]}>
            {win ? '+' : ''}${Math.abs(entry.pnl).toFixed(2)}
          </Text>
          {entry.rMultiple != null && (
            <Text style={[styles.rowR, win ? styles.green : styles.red]}>
              {entry.rMultiple >= 0 ? '+' : ''}{entry.rMultiple.toFixed(2)}R
            </Text>
          )}
          {entry.emotion && (
            <View style={styles.emotionTag}>
              <Text style={styles.emotionTagText}>{entry.emotion.toUpperCase()}</Text>
            </View>
          )}
        </View>
        {entry.notes ? <Text style={styles.rowNotes} numberOfLines={1}>{entry.notes}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.delBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emptyTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.md },
  emptySub:   { color: colors.textTertiary, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  rowWin:  { borderColor: '#1a3a25' },
  rowLoss: { borderColor: '#3a1a1a' },
  rowAccent: { width: 4, alignSelf: 'stretch' },
  rowTop:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm, paddingHorizontal: spacing.md },
  rowMid:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: 2 },
  rowSymbol: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  rowSide: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 },
  rowDate: { flex: 1, textAlign: 'right', color: colors.textTertiary, fontSize: fontSize.xs },
  rowPnl: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'] },
  rowR:   { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, fontVariant: ['tabular-nums'] },
  rowNotes: { color: colors.textSecondary, fontSize: fontSize.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, marginTop: 2 },
  delBtn: { padding: spacing.md },

  emotionTag: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3,
  },
  emotionTagText: { color: colors.textSecondary, fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

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
