import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { TradeGrade } from '../store/tradeJournalStore';

/**
 * TradeJournalModal — auto-popup after a trade closes. Captures
 * three things: execution grade (required), 0-3 emotion tags
 * (optional), and a short note (optional, capped at 280 chars).
 *
 * The trade-closing handler in TradingScreen feeds the closed
 * trade's `id` / symbol / direction / pnl in. On Save, the
 * consumer writes to `tradeJournalStore` (or wherever); on Skip,
 * nothing is persisted. This component is presentation only — it
 * doesn't touch any store directly so it stays easy to test /
 * re-skin / reuse.
 *
 * Onboarding screen 9's activation-event close has its OWN result
 * overlay (`ResultOverlay` in `OnboardingFirstTradeScreen.tsx`)
 * and never reaches this component — guaranteed because the
 * onboarding stack never mounts `TradingScreen`.
 */

const BG_OVERLAY     = 'rgba(0,0,0,0.85)';
const CARD_BG        = '#0F0F0F';
const CARD_BORDER    = '#1F1F1F';
const CHIP_BG        = '#1A1A1A';
const CHIP_BORDER    = '#2A2A2A';
const GOLD           = '#FFB800';
const GREEN          = '#00D395';
const RED            = '#FF4757';
const WHITE          = '#FFFFFF';
const TEXT_FADED_60  = 'rgba(255,255,255,0.6)';
const TEXT_FADED_40  = 'rgba(255,255,255,0.4)';
const TEXT_FADED_30  = 'rgba(255,255,255,0.3)';

const GRADES: TradeGrade[] = ['A+', 'A', 'B', 'C', 'F'];

const POSITIVE_EMOTIONS = ['Calm', 'Confident', 'Patient', 'Focused'];
const NEGATIVE_EMOTIONS = ['Anxious', 'FOMO', 'Revenge', 'Impulsive'];
const ALL_EMOTIONS = [...POSITIVE_EMOTIONS, ...NEGATIVE_EMOTIONS];

const MAX_EMOTIONS = 3;
const MAX_NOTE_LEN = 280;

export interface TradeSummary {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  pnl: number;
}

interface Props {
  visible: boolean;
  trade: TradeSummary | null;
  onSave: (data: {
    grade: TradeGrade;
    emotions: string[];
    note: string | null;
  }) => void;
  onSkip: () => void;
}

function formatUSD(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs  = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${abs}`;
}

function pnlColor(pnl: number): string {
  if (pnl > 0) return GREEN;
  if (pnl < 0) return RED;
  return WHITE;
}

export default function TradeJournalModal({
  visible, trade, onSave, onSkip,
}: Props) {
  const [grade, setGrade]     = useState<TradeGrade | null>(null);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [note, setNote]       = useState('');

  // Reset state every time the modal opens for a new trade so we
  // don't bleed selections from the previous trade.
  useEffect(() => {
    if (visible) {
      setGrade(null);
      setEmotions([]);
      setNote('');
    }
  }, [visible, trade?.id]);

  if (!trade) return null;

  const toggleEmotion = (tag: string) => {
    setEmotions((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      // Cap at MAX_EMOTIONS by dropping the oldest selection so the
      // user can keep tapping without hitting a silent dead end.
      if (prev.length >= MAX_EMOTIONS) {
        return [...prev.slice(1), tag];
      }
      return [...prev, tag];
    });
  };

  const handleSave = () => {
    if (!grade) return;
    onSave({
      grade,
      emotions,
      note: note.trim().length > 0 ? note.trim() : null,
    });
  };

  const isLong = trade.direction === 'long';
  const saveEnabled = grade !== null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onSkip}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onSkip}>
          <Pressable
            style={styles.card}
            onPress={() => { /* swallow taps so the backdrop press doesn't fire */ }}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Trade summary — symbol + direction pill + P&L on one line */}
              <View style={styles.summaryRow}>
                <Text style={styles.summarySymbol}>{trade.symbol}</Text>
                <View
                  style={[
                    styles.dirPill,
                    isLong ? styles.dirPillLong : styles.dirPillShort,
                  ]}
                >
                  <Text
                    style={[
                      styles.dirPillText,
                      isLong ? styles.dirPillTextLong : styles.dirPillTextShort,
                    ]}
                  >
                    {isLong ? 'LONG' : 'SHORT'}
                  </Text>
                </View>
                <View style={{ flex: 1 }} />
                <Text
                  style={[styles.summaryPnl, { color: pnlColor(trade.pnl) }]}
                  allowFontScaling={false}
                >
                  {formatUSD(trade.pnl)}
                </Text>
              </View>

              {/* GRADE — required */}
              <Text style={styles.sectionLabel}>GRADE YOUR EXECUTION</Text>
              <View style={styles.gradeRow}>
                {GRADES.map((g) => {
                  const selected = grade === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setGrade(g)}
                      style={({ pressed }) => [
                        styles.gradeChip,
                        selected && styles.gradeChipSelected,
                        pressed && !selected && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Grade ${g}`}
                      accessibilityState={{ selected }}
                    >
                      <Text style={styles.gradeChipText}>{g}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* EMOTIONS — multi-select up to 3 */}
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
                HOW DID YOU FEEL?
              </Text>
              <View style={styles.emotionGrid}>
                {ALL_EMOTIONS.map((tag) => {
                  const isPositive = POSITIVE_EMOTIONS.includes(tag);
                  const selected = emotions.includes(tag);
                  const accent = isPositive ? GREEN : RED;
                  return (
                    <Pressable
                      key={tag}
                      onPress={() => toggleEmotion(tag)}
                      style={({ pressed }) => [
                        styles.emotionChip,
                        selected && { borderColor: accent, borderWidth: 1 },
                        pressed && !selected && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={tag}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.emotionChipText,
                          selected && { color: accent },
                        ]}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* NOTE — optional, tweet-length */}
              <Text style={[styles.sectionLabel, { marginTop: 22 }]}>
                QUICK NOTE
              </Text>
              <TextInput
                value={note}
                onChangeText={(t) => setNote(t.slice(0, MAX_NOTE_LEN))}
                placeholder="What did you learn?"
                placeholderTextColor={TEXT_FADED_30}
                style={styles.noteInput}
                multiline
                maxLength={MAX_NOTE_LEN}
                selectionColor={GOLD}
                returnKeyType="done"
                blurOnSubmit
              />

              {/* SAVE — gated by grade */}
              <Pressable
                onPress={handleSave}
                disabled={!saveEnabled}
                style={({ pressed }) => [
                  styles.saveBtn,
                  !saveEnabled && styles.saveBtnDisabled,
                  saveEnabled && pressed && styles.saveBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Save journal entry"
                accessibilityState={{ disabled: !saveEnabled }}
              >
                <Text
                  style={[
                    styles.saveBtnText,
                    !saveEnabled && styles.saveBtnTextDisabled,
                  ]}
                >
                  Save
                </Text>
              </Pressable>

              {/* SKIP */}
              <Pressable
                onPress={onSkip}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Skip journal"
              >
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: BG_OVERLAY,
  },
  backdropPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
  },

  // Trade summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    marginBottom: 18,
  },
  summarySymbol: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dirPill: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  dirPillLong:  { backgroundColor: GREEN },
  dirPillShort: { backgroundColor: RED },
  dirPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dirPillTextLong:  { color: '#000000' },
  dirPillTextShort: { color: WHITE },
  summaryPnl: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },

  // Section labels (shared across grade / emotions / note)
  sectionLabel: {
    color: TEXT_FADED_60,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },

  // Grade chips — single-select radio row
  gradeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  gradeChip: {
    flex: 1,
    height: 48,
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeChipSelected: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  gradeChipText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipPressed: {
    opacity: 0.7,
  },

  // Emotion chips — multi-select wrapping grid
  emotionGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionChip: {
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emotionChipText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Note input
  noteInput: {
    marginTop: 10,
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    color: WHITE,
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Save / Skip
  saveBtn: {
    marginTop: 24,
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#2A2A2A',
  },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  saveBtnTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },

  skipBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: TEXT_FADED_40,
    fontSize: 14,
    fontWeight: '500',
  },
});
