import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { PlanSetupType } from '../store/journalStore';

/**
 * PreTradeModal — the "Plan your trade" card. Appears when the
 * user taps BUY/SELL on the chart screen (when the pre-trade
 * checklist is enabled), BEFORE the order is staged.
 *
 * Trains the prop-firm habit of "plan the trade, trade the plan"
 * and enriches the journal with INTENT recorded alongside
 * OUTCOME. Setup type is required; stop and target are optional
 * free-text price levels (no validation against current price —
 * deferred). Presentation only: it never touches a store; the
 * consumer decides what to do with the plan.
 *
 * Onboarding screen 9 has its own guided flow and never mounts
 * TradingScreen, so this modal can't appear there.
 */

const BG_OVERLAY    = 'rgba(0,0,0,0.85)';
// Modal surface — L3 in the layered system.
const CARD_BG       = '#141414';
const CARD_BORDER   = '#1F1F1F';
const CHIP_BG       = '#1A1A1A';
const CHIP_BORDER   = '#2A2A2A';
const GOLD          = '#FFB800';
const GREEN         = '#00D395';
const RED           = '#FF4757';
const WHITE         = '#FFFFFF';
const TEXT_FADED_50 = 'rgba(255,255,255,0.5)';
const TEXT_FADED_40 = 'rgba(255,255,255,0.4)';
const TEXT_FADED_30 = 'rgba(255,255,255,0.3)';

const SETUP_TYPES: { id: PlanSetupType; label: string }[] = [
  { id: 'breakout', label: 'Breakout' },
  { id: 'reversal', label: 'Reversal' },
  { id: 'trend',    label: 'Trend' },
  { id: 'range',    label: 'Range' },
  { id: 'news',     label: 'News' },
  { id: 'other',    label: 'Other' },
];

export interface TradePlanInput {
  setupType: PlanSetupType;
  stopPrice: number | null;
  targetPrice: number | null;
}

interface Props {
  visible: boolean;
  direction: 'long' | 'short';
  /** Live price — used only to seed sensible placeholders. */
  currentPrice: number;
  /** Decimal places for the symbol (mirrors TradingScreen `fmt`). */
  pricePrecision: number;
  onPlace: (plan: TradePlanInput) => void;
  onSkip: () => void;
  /** Backdrop / hardware-back — abort, no trade placed. */
  onCancel: () => void;
}

/** "" / non-numeric → null; otherwise the parsed number. */
function parsePrice(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function PreTradeModal({
  visible, direction, currentPrice, pricePrecision,
  onPlace, onSkip, onCancel,
}: Props) {
  const [setupType, setSetupType] = useState<PlanSetupType | null>(null);
  const [stop, setStop]   = useState('');
  const [target, setTarget] = useState('');

  // Fresh state every time the card opens for a new trade.
  useEffect(() => {
    if (visible) {
      setSetupType(null);
      setStop('');
      setTarget('');
    }
  }, [visible, direction]);

  const isLong = direction === 'long';

  // Placeholder: current price ± ~0.5% in the "logical" direction
  // (long stop below / target above; short the inverse).
  const offset = Math.max(currentPrice * 0.005, 0);
  const fmt = (n: number) => n.toFixed(pricePrecision);
  const stopPh =
    currentPrice > 0
      ? fmt(isLong ? currentPrice - offset : currentPrice + offset)
      : 'Price';
  const targetPh =
    currentPrice > 0
      ? fmt(isLong ? currentPrice + offset : currentPrice - offset)
      : 'Price';

  const placeEnabled = setupType !== null;

  const handlePlace = () => {
    if (!setupType) return;
    onPlace({
      setupType,
      stopPrice: parsePrice(stop),
      targetPrice: parsePrice(target),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onCancel}>
          <Pressable style={styles.card} onPress={() => { /* swallow */ }}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <Text style={styles.title}>
                Plan your{' '}
                <Text style={{ color: isLong ? GREEN : RED }}>
                  {isLong ? 'LONG' : 'SHORT'}
                </Text>
              </Text>
              <Text style={styles.subtitle}>What's the setup?</Text>

              {/* FIELD 1 — Setup type (required) */}
              <View style={styles.chipGrid}>
                {SETUP_TYPES.map((s) => {
                  const selected = setupType === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSetupType(s.id)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected && styles.chipSelected,
                        pressed && !selected && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={s.label}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* FIELD 2 — Stop (optional) */}
              <Text style={styles.fieldLabel}>Where's your stop?</Text>
              <TextInput
                value={stop}
                onChangeText={setStop}
                placeholder={stopPh}
                placeholderTextColor={TEXT_FADED_30}
                style={styles.input}
                keyboardType="decimal-pad"
                selectionColor={GOLD}
                returnKeyType="done"
              />
              <Text style={styles.helper}>
                Price level where you'd exit if wrong
              </Text>

              {/* FIELD 3 — Target (optional) */}
              <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
                Where's your target?
              </Text>
              <TextInput
                value={target}
                onChangeText={setTarget}
                placeholder={targetPh}
                placeholderTextColor={TEXT_FADED_30}
                style={styles.input}
                keyboardType="decimal-pad"
                selectionColor={GOLD}
                returnKeyType="done"
              />
              <Text style={styles.helper}>
                Price level where you'd take profit
              </Text>

              {/* Place — gated by setup type */}
              <Pressable
                onPress={handlePlace}
                disabled={!placeEnabled}
                style={({ pressed }) => [
                  styles.placeBtn,
                  !placeEnabled && styles.placeBtnDisabled,
                  placeEnabled && pressed && styles.placeBtnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Place trade"
                accessibilityState={{ disabled: !placeEnabled }}
              >
                <Text
                  style={[
                    styles.placeBtnText,
                    !placeEnabled && styles.placeBtnTextDisabled,
                  ]}
                >
                  Place trade
                </Text>
              </Pressable>

              {/* Skip planning */}
              <Pressable
                onPress={onSkip}
                style={({ pressed }) => [
                  styles.skipBtn,
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Skip planning"
              >
                <Text style={styles.skipText}>Skip planning</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: BG_OVERLAY },
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
  scrollContent: { padding: 20 },

  title: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    color: TEXT_FADED_50,
    fontSize: 14,
    fontWeight: '600',
  },

  // Setup-type chips
  chipGrid: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  chipPressed: { opacity: 0.7 },
  chipText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chipTextSelected: { color: GOLD },

  // Stop / target
  fieldLabel: {
    marginTop: 22,
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    marginTop: 8,
    backgroundColor: CHIP_BG,
    borderColor: CHIP_BORDER,
    borderWidth: 1,
    borderRadius: 10,
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontVariant: ['tabular-nums'],
  },
  helper: {
    marginTop: 6,
    color: TEXT_FADED_40,
    fontSize: 12,
    fontWeight: '500',
  },

  // Place / Skip
  placeBtn: {
    marginTop: 26,
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBtnDisabled: { backgroundColor: '#2A2A2A' },
  placeBtnPressed: { opacity: 0.85 },
  placeBtnText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  placeBtnTextDisabled: { color: 'rgba(255,255,255,0.5)' },

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
