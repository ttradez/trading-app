import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Pressable, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle, typography } from '../theme';
import { useJournalStore, JournalEntry, Emotion } from '../store/journalStore';
import { detectAfterJournalSave } from '../utils/challengeDetection';
import SectionHeader from '../components/SectionHeader';
import MoneyText from '../components/MoneyText';
import NumericText from '../components/NumericText';
import JournalEntryCard from '../components/JournalEntryCard';
import SelectCircle from '../components/SelectCircle';
import { colors as JT } from '../theme/tokens';

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
  { id: 'mock-3', outcome: 'W' as const, symbol: 'ES', entry:  5388.25, exit:  5398.00, pnl:  487.50, date: '2026-05-19' },
  { id: 'mock-4', outcome: 'W' as const, symbol: 'NQ', entry: 19551.75, exit: 19598.50, pnl:  467.50, date: '2026-05-19' },
  { id: 'mock-5', outcome: 'L' as const, symbol: 'NQ', entry: 19720.00, exit: 19698.25, pnl: -217.50, date: '2026-05-18' },
];

export default function JournalScreen({ navigation, route }: any) {
  const { entries } = useJournalStore();
  const removeMany = useJournalStore((s) => s.removeMany);
  const addEntry   = useJournalStore((s) => s.addEntry);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  // True when `editing` is a brand-new note that hasn't been
  // persisted yet — the modal's SAVE path adds it; closing without
  // saving discards it without touching the store.
  const [isDraftEntry, setIsDraftEntry] = useState(false);

  // Build a blank "note" entry (no trade) and open the edit modal on
  // it. tradeId prefix `note-` distinguishes manual notebook entries
  // from trade-close entries (`local-<closedAtMs>`) so future logic
  // (Stats filters, badges, etc.) can branch on it. The entry is NOT
  // added to the store here — that happens only if the user hits
  // SAVE in the modal, so closing the modal without saving leaves
  // no ghost entry behind.
  const handleNewNote = useCallback(() => {
    const now = Date.now();
    const id = `note-${now}`;
    const entry: JournalEntry = {
      id,
      tradeId: id,
      symbol: '',
      side: 'buy',
      lots: 0,
      entryPrice: 0,
      exitPrice: 0,
      stopLoss: null,
      takeProfit: null,
      pnl: 0,
      rMultiple: null,
      rrAchieved: null,
      riskAmount: null,
      openedAt: now,
      closedAt: now,
      planSetupType: null,
      planStopPrice: null,
      planTargetPrice: null,
      planSkipped: true,
      setupId: null,
      rating: null,
      checklistPassed: false,
      checklistSkipped: true,
      intendedStop: 0,
      intendedTarget: 0,
      positionSize: 0,
      intendedRisk: 0,
      intendedRR: 0,
      notes: '',
      mistakes: '',
      wentWell: '',
      emotion: null,
      confidence: null,
      strategy: '',
      tags: ['note'],
      savedAt: now,
      imageUri: null,
    };
    setIsDraftEntry(true);
    setEditing(entry);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditing(null);
    setIsDraftEntry(false);
  }, []);
  // iOS-style Edit/Done mode for bulk-delete. Circles only render
  // (and row taps are inert) while editMode is true.
  const [editMode, setEditMode] = useState(false);
  // Selection state for the bulk-delete UX. Mirrors the same
  // pattern used on SessionsScreen.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      `Delete ${ids.length} journal entr${ids.length === 1 ? 'y' : 'ies'}?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeMany(ids);
            setSelectedIds(new Set());
            setEditMode(false);
          },
        },
      ],
    );
  }, [selectedIds, removeMany]);

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
        {/* Header — iOS-style Edit/Done. Default mode shows a
            transparent "Edit" pill; edit mode swaps in a red
            "Delete (N)" pill + a "Done" pill. */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Journal</Text>
              <Text style={styles.headerSub}>
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            {!editMode ? (
              <View style={styles.headerActionsRow}>
                <Pressable
                  onPress={handleNewNote}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.newNoteBtn,
                    pressed && styles.newNoteBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="New journal entry"
                >
                  <Ionicons name="add" size={18} color={colors.bg} />
                  <Text style={styles.newNoteBtnLabel}>New</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditMode(true)}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.editBtn,
                    pressed && styles.editBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit journal entries"
                >
                  <Text style={styles.editBtnLabel}>Edit</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.editActionsRow}>
                <Pressable
                  onPress={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  style={({ pressed }) => [
                    styles.bulkDeleteBtn,
                    selectedIds.size === 0 && styles.bulkDeleteBtnDisabled,
                    pressed && selectedIds.size > 0 && styles.bulkDeleteBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedIds.size === 0
                      ? 'Delete (no entries selected)'
                      : `Delete ${selectedIds.size} selected journal entr${
                          selectedIds.size === 1 ? 'y' : 'ies'
                        }`
                  }
                  accessibilityState={{ disabled: selectedIds.size === 0 }}
                >
                  <Text style={styles.bulkDeleteLabel}>
                    {selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditMode(false);
                    setSelectedIds(new Set());
                  }}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.editBtn,
                    pressed && styles.editBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Done editing"
                >
                  <Text style={styles.editBtnLabel}>Done</Text>
                </Pressable>
              </View>
            )}
          </View>
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
            {entries.length === 0 ? (
              <Text style={styles.entryEmpty}>
                No journal entries yet — close a trade to log one here.
              </Text>
            ) : (
              entries.map((e) => (
                <View key={e.id} style={styles.entryRow}>
                  {editMode && (
                    <SelectCircle
                      selected={selectedIds.has(e.id)}
                      onPress={() => toggleSelect(e.id)}
                      accessibilityLabel={`Select ${e.symbol} journal entry`}
                    />
                  )}
                  <Pressable
                    style={styles.entryCardWrap}
                    onPress={editMode ? undefined : () => setEditing(e)}
                    disabled={editMode}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${e.symbol} journal entry`}
                  >
                    <JournalEntryCard
                      outcome={e.pnl >= 0 ? 'W' : 'L'}
                      symbol={e.symbol}
                      entry={e.entryPrice}
                      exit={e.exitPrice}
                      pnl={e.pnl}
                      date={new Date(e.closedAt || e.savedAt || Date.now()).toISOString().slice(0, 10)}
                      imageUri={e.imageUri}
                    />
                  </Pressable>
                </View>
              ))
            )}
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
      </ScrollView>

      {/* Edit modal — used both for editing existing entries and
          (when isDraft) for creating new "+ New" notes. The draft
          path persists only when SAVE is pressed; closing discards. */}
      <EntryEditModal
        entry={editing}
        isDraft={isDraftEntry}
        onClose={closeEditModal}
      />
    </SafeAreaView>
  );
}

function EntryEditModal({
  entry,
  isDraft,
  onClose,
}: {
  entry: JournalEntry | null;
  isDraft: boolean;
  onClose: () => void;
}) {
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const addEntry    = useJournalStore((s) => s.addEntry);
  const [notes, setNotes]         = useState('');
  const [mistakes, setMistakes]   = useState('');
  const [wentWell, setWentWell]   = useState('');
  const [strategy, setStrategy]   = useState('');
  const [emotion, setEmotion]     = useState<Emotion | null>(null);
  const [confidence, setConf]     = useState<number | null>(null);
  const [imageUri, setImageUri]   = useState<string | null>(null);
  // Self-rating drives the challenge grade conditions (grade_ab,
  // grade_aplus, good_grade_on_loss). Mapping mirrors the legacy
  // TradingScreen post-trade rating flow:
  //   good  → A   (counts toward grade_ab)
  //   ok    → B   (counts toward grade_ab)
  //   bad   → C   (no grade credit)
  // No A+ surface here — that grade is gated behind an explicit
  // future flow, so grade_aplus stays an aspirational ceiling.
  const [rating, setRating] = useState<'good' | 'ok' | 'bad' | null>(null);

  React.useEffect(() => {
    if (!entry) return;
    setNotes(entry.notes); setMistakes(entry.mistakes); setWentWell(entry.wentWell);
    setStrategy(entry.strategy); setEmotion(entry.emotion); setConf(entry.confidence);
    setImageUri(entry.imageUri ?? null);
    setRating(entry.rating);
  }, [entry]);

  if (!entry) return null;

  const save = () => {
    if (isDraft) {
      // Draft path: the entry isn't in the store yet. Merge the
      // form state onto the blank template and insert it now.
      addEntry({
        ...entry,
        notes, mistakes, wentWell, strategy, emotion, confidence, imageUri, rating,
        savedAt: Date.now(),
      });
    } else {
      updateEntry(entry.id, {
        notes, mistakes, wentWell, strategy, emotion, confidence, imageUri, rating,
      });
    }
    // Challenge engine — mirror the legacy TradingScreen call. Grade
    // derives from rating; emotions list is single-element (the
    // modal lets the user pick one emotion). When rating is null
    // (user hasn't rated yet), default to 'B' so neutral journaling
    // still credits journal_count without inflating grade_ab.
    // grade_ab fires for 'A' or 'B' only — 'C' is the no-credit path.
    const grade = rating === 'good' ? 'A'
                : rating === 'bad'  ? 'C'
                : 'B';
    detectAfterJournalSave(grade, emotion ? [emotion] : []);
    onClose();
  };

  async function pickScreenshot(source: 'library' | 'camera') {
    try {
      // Dynamic require so a missing native module in Expo Go can't
      // crash before our error handler runs.
      const ImagePicker = require('expo-image-picker');
      let perm;
      if (source === 'camera') {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm?.granted) {
        Alert.alert('Permission needed', 'Allow access to attach a screenshot.');
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? ['images'],
            quality: 0.85,
          });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (uri) setImageUri(uri);
    } catch (e: any) {
      Alert.alert(
        'Couldn’t attach image',
        e?.message ?? 'Image picker unavailable — a dev build may be required.',
      );
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.editBackdrop} onPress={onClose}>
        <Pressable style={styles.editSheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>
                {entry.symbol
                  ? `${entry.symbol}  ·  ${entry.side.toUpperCase()}`
                  : 'Note'}
              </Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity>
            </View>

            <Text style={[labelStyle, styles.editLabel]}>Screenshot</Text>
            {imageUri ? (
              <View style={styles.screenshotWrap}>
                {/* resizeMode="contain" so the WHOLE trade-card composite
                    is visible (no cropped corners). 4:5 aspect matches the
                    new trade-card image; chart-only screenshots still fit
                    cleanly thanks to contain mode. */}
                <Image source={{ uri: imageUri }} style={styles.screenshotImg} resizeMode="contain" />
                <TouchableOpacity
                  style={styles.screenshotRemove}
                  onPress={() => setImageUri(null)}
                  accessibilityLabel="Remove screenshot"
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.screenshotPickRow}>
                <TouchableOpacity
                  style={styles.screenshotPickBtn}
                  onPress={() => pickScreenshot('library')}
                  accessibilityRole="button"
                  accessibilityLabel="Pick screenshot from library"
                >
                  <Ionicons name="image-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.screenshotPickText}>From library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.screenshotPickBtn}
                  onPress={() => pickScreenshot('camera')}
                  accessibilityRole="button"
                  accessibilityLabel="Take photo"
                >
                  <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
                  <Text style={styles.screenshotPickText}>Take photo</Text>
                </TouchableOpacity>
              </View>
            )}

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

            {/* Self-rating — drives the challenge "grade" conditions.
                Three-button row; visually maps Good (green) / OK
                (white) / Bad (red) onto the underlying A/B/C grade
                used by the challenge engine. */}
            <Text style={[labelStyle, styles.editLabel]}>How did you trade it?</Text>
            <View style={styles.ratingRow}>
              {([
                { id: 'good', label: 'Good',  color: colors.green },
                { id: 'ok',   label: 'OK',    color: colors.textPrimary },
                { id: 'bad',  label: 'Bad',   color: colors.red },
              ] as const).map((r) => {
                const active = rating === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setRating(active ? null : r.id)}
                    style={[
                      styles.ratingBtn,
                      active && { borderColor: r.color, backgroundColor: `${r.color}26` },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate trade ${r.label}`}
                  >
                    <Text style={[styles.ratingBtnText, active && { color: r.color }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
  screenshotPickRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  screenshotPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed',
  },
  screenshotPickText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  screenshotWrap: {
    position: 'relative',
    marginTop: 4,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  screenshotImg: {
    width: '100%',
    // Chart screenshots are landscape (~16:10). With contain-mode
    // rendering, the chart fits horizontally with slight top/bottom
    // letterbox — no cropped corners.
    aspectRatio: 16 / 10,
    backgroundColor: '#000',
  },
  screenshotRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: { flex: 1, backgroundColor: colors.bg },

  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { ...typography.display, color: colors.textPrimary },
  headerSub: { color: colors.textTertiary, fontSize: fontSize.xs, marginTop: 2 },

  // Edit-mode header layout — Delete pill on the left, Done on
  // the right.
  editActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Default-mode header actions: [+ New] (gold primary) + [Edit].
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Gold "+ New" pill — primary action, top-right of the header.
  // Taps create a blank journal entry with no trade attached.
  newNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  newNoteBtnPressed: {
    opacity: 0.85,
  },
  newNoteBtnLabel: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  // Plain "Edit" / "Done" pill — transparent bg, white text.
  // Matches the iOS chrome the user expects without competing
  // with the primary gold/red controls.
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  editBtnPressed: {
    opacity: 0.6,
  },
  editBtnLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // Top-of-screen bulk-delete control. Loss-red when ≥1 selected;
  // 40% opacity + non-interactive when nothing's selected.
  bulkDeleteBtn: {
    backgroundColor: '#FF4757',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  bulkDeleteBtnDisabled: {
    opacity: 0.4,
  },
  bulkDeleteBtnPressed: {
    opacity: 0.85,
  },
  bulkDeleteLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

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
  // One row per journal entry — SelectCircle on the left, the
  // existing card body fills the rest.
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryCardWrap: {
    flex: 1,
  },
  entryEmpty: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    paddingVertical: 8,
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

  // Three-button self-rating row (Good / OK / Bad). Maps onto the
  // A/B/C grade used by the challenge engine. Active pill takes a
  // tinted backgound + colored border so the choice reads cleanly.
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs,
  },
  ratingBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingBtnText: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.8,
  },

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
