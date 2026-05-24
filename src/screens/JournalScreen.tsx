import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle, typography } from '../theme';
import { useJournalStore, JournalEntry, Emotion } from '../store/journalStore';
import SectionHeader from '../components/SectionHeader';
import MoneyText from '../components/MoneyText';
import NumericText from '../components/NumericText';
import JournalEntryCard from '../components/JournalEntryCard';
import { colors as JT } from '../theme/tokens';
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

/**
 * Placeholder data for the new top-of-screen "Trade Journal"
 * section. The post-trade journal-with-screenshot flow isn't wired
 * yet — these mocks exist so the design intent is visible.
 *
 * When the entry-creation flow lands, this constant goes away and
 * the section reads from a real store (probably tradeJournalStore
 * extended with a screenshot URI).
 */
const PLACEHOLDER_JOURNAL_ENTRIES = [
  { id: 'mock-1', outcome: 'W' as const, symbol: 'NQ', entry: 19842.50, exit: 19891.25, pnl:  487.50, date: '2026-05-21' },
  { id: 'mock-2', outcome: 'L' as const, symbol: 'ES', entry:  5421.75, exit:  5419.50, pnl: -112.50, date: '2026-05-20' },
  { id: 'mock-3', outcome: 'W' as const, symbol: 'CL', entry:    74.32, exit:    74.81, pnl:  490.00, date: '2026-05-19' },
  { id: 'mock-4', outcome: 'W' as const, symbol: 'GC', entry:  2387.40, exit:  2392.10, pnl:  470.00, date: '2026-05-19' },
  { id: 'mock-5', outcome: 'L' as const, symbol: 'NQ', entry: 19720.00, exit: 19698.25, pnl: -217.50, date: '2026-05-18' },
];

export default function JournalScreen({ navigation, route }: any) {
  const { entries } = useJournalStore();
  const [openRecap, setOpenRecap] = useState<WeeklyRecap | null>(null);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  // Optional `openEntryId` route param — drilled in from the
  // DayDetailSheet on the calendar heatmap. When supplied (and the
  // entry exists), open the EntryEditModal on mount so the user
  // lands right on the trade they tapped. Clears the param after
  // consumption so subsequent visits don't re-open it.
  const openEntryId = route?.params?.openEntryId as string | undefined;
  React.useEffect(() => {
    if (!openEntryId) return;
    const target = entries.find((e) => e.id === openEntryId);
    if (target) setEditing(target);
    navigation.setParams?.({ openEntryId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntryId]);

  // Stats roll up the user's real journal data (not the placeholder
  // cards). All trades, no filter — the wins/losses filter row went
  // away with the real-trade list and will return when the post-
  // trade journal flow is wired and we have entries with
  // screenshots to filter.
  const totalPnl = entries.reduce((sum, e) => sum + e.pnl, 0);
  const wins    = entries.filter((e) => e.pnl > 0).length;
  const losses  = entries.filter((e) => e.pnl < 0).length;
  const winRate = entries.length ? Math.round((wins / entries.length) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Journal</Text>
          <Text style={styles.headerSub}>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>

        {/* 1. Stats block — promoted to the top. */}
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={[labelStyle, styles.summaryLabel]}>P&L</Text>
            <MoneyText
              value={totalPnl}
              size={fontSize.lg}
              // Zero P&L stays neutral white — green only for positive,
              // red only for negative.
              style={[
                styles.summaryValue,
                totalPnl > 0 && styles.green,
                totalPnl < 0 && styles.red,
              ]}
            />
          </View>
          <View style={styles.summaryItem}>
            <Text style={[labelStyle, styles.summaryLabel]}>WIN RATE</Text>
            <NumericText bold style={styles.summaryValue}>{winRate}%</NumericText>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[labelStyle, styles.summaryLabel]}>W/L</Text>
            <NumericText bold style={styles.summaryValue}>{wins}/{losses}</NumericText>
          </View>
        </View>

        {/* 2. Trade Journal — placeholder cards. Replaces the old
            real-trade FlatList until the post-trade journal-with-
            screenshot flow is wired. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionHeader
              title="Trade Journal"
              variant="eyebrow"
              icon={
                <MaterialCommunityIcons
                  name="notebook-outline"
                  size={13}
                  color={JT.textTertiary}
                />
              }
            />
          </View>
          <View style={styles.entryList}>
            {PLACEHOLDER_JOURNAL_ENTRIES.map((e) => (
              <JournalEntryCard
                key={e.id}
                outcome={e.outcome}
                symbol={e.symbol}
                entry={e.entry}
                exit={e.exit}
                pnl={e.pnl}
                date={e.date}
              />
            ))}
          </View>
        </View>

        {/* 3. Your Tendencies — entry to the Insights screen.
            Existing component preserved unchanged in its slot. */}
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

        {/* 4. Weekly Recap — demoted to the bottom. Was the
            ListHeaderComponent of the (removed) trade FlatList;
            now stands on its own as the final section. */}
        <View style={styles.bottomRecap}>
          <RecapsSection onOpen={setOpenRecap} />
        </View>
      </ScrollView>

      {/* Edit modal — left mounted but currently no trigger surface
          (the real-trade list is hidden). Re-wires for free when
          the journal-entry flow comes online and reintroduces the
          tap target. */}
      <EntryEditModal entry={editing} onClose={() => setEditing(null)} />

      {/* Tapped past-recap review — nav handlers preserved. */}
      <WeeklyRecapModal
        visible={openRecap !== null}
        recap={openRecap}
        onClose={() => setOpenRecap(null)}
        onOpenTrade={(tradeId) => {
          setOpenRecap(null);
          navigation.navigate('Journal', { openEntryId: tradeId });
        }}
        onOpenLesson={(setupId) =>
          navigation.navigate('SetupDetail', { setupId })
        }
        onStartSession={() => navigation.navigate('Chart')}
      />
    </SafeAreaView>
  );
}

/** "Weekly Recaps" section — compact rows (date range · win rate ·
 *  total P&L); tap → reopen the full recap modal for that week.
 *  Newest first. Was the ListHeaderComponent of the trade list; now
 *  rendered as a stand-alone section at the bottom of the screen. */
function RecapsSection({ onOpen }: { onOpen: (r: WeeklyRecap) => void }) {
  const recaps = useRecapList();
  return (
    <View style={styles.recapSection}>
      <View style={styles.recapHeader}>
        <SectionHeader
          title="Weekly Recap"
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
                <NumericText style={styles.recapSub}>
                  {recap.totalTrades} {recap.totalTrades === 1 ? 'trade' : 'trades'}
                  {recap.winRate != null ? `  ·  ${recap.winRate}% win` : ''}
                </NumericText>
              </View>
              <NumericText
                bold
                style={[styles.recapPnl, pnlPos ? styles.green : styles.red]}
                allowFontScaling={false}
              >
                {pnlPos ? '+' : '-'}${Math.abs(recap.totalPnL).toFixed(2)}
              </NumericText>
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

  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerTitle: { ...typography.display, color: colors.textPrimary },
  headerSub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },

  // Stats block — was below the recents/filter row; promoted to
  // the top of the page per the new layout.
  summary: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 9 },
  summaryValue: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold, fontVariant: ['tabular-nums'], marginTop: 2 },

  // Generic section wrapper — used by the new Trade Journal block.
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  entryList: {
    gap: 10,
  },

  insightsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
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

  // Weekly Recap bottom slot
  bottomRecap: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  recapSection: { marginBottom: spacing.lg },
  recapHeader: {
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
  editSheet: { backgroundColor: '#141414', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '90%' },
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
