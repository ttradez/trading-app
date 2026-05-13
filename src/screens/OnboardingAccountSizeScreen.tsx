import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, AccountSizeType } from '../store/onboardingStore';

/**
 * Onboarding screen 6 — Select your evaluation account.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md Q4: prop-firm "evaluation
 * account" framing, preset chips matching Apex / Topstep canonical
 * sizes. Default is $50K — the most common Combine size; teaches
 * realistic position sizing. "Custom" is a secondary text link so we
 * don't nudge users into unrealistic numbers.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const CTA_DISABLED_BG = '#2A2A2A';

const CUSTOM_MIN = 1_000;
const CUSTOM_MAX = 500_000;

interface PresetOption {
  value: number;
  description: string;
}

const PRESETS: PresetOption[] = [
  { value: 10_000,  description: 'Small. Tight position sizes. Best for testing strategies.' },
  { value: 25_000,  description: "Beginner-friendly. Apex's smallest tier." },
  { value: 50_000,  description: 'The most common starter. Balanced risk.' },
  { value: 100_000, description: 'Larger size. More room to breathe.' },
  { value: 150_000, description: 'Maximum prop-firm tier. Serious size.' },
];

function formatUSD(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

interface Props {
  navigation: any;
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function PresetCard({
  option, selected, onPress,
}: { option: PresetOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${formatUSD(option.value)} account`}
      accessibilityState={{ selected }}
    >
      <Text style={styles.cardAmount}>{formatUSD(option.value)}</Text>
      <Text style={styles.cardDescription}>{option.description}</Text>
    </Pressable>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────────

export default function OnboardingAccountSizeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const accountSize     = useOnboardingStore((s) => s.accountSize);
  const accountSizeType = useOnboardingStore((s) => s.accountSizeType);
  const setAccountSize  = useOnboardingStore((s) => s.setAccountSize);

  const [customOpen, setCustomOpen]   = useState(false);
  const [customInput, setCustomInput] = useState(String(accountSize));
  const [customError, setCustomError] = useState<string | null>(null);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // mount-once fade-in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPreset = (value: number) => {
    if (accountSizeType === 'preset' && value === accountSize) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAccountSize(value, 'preset');
  };

  const openCustomModal = () => {
    setCustomInput(String(accountSize));
    setCustomError(null);
    setCustomOpen(true);
  };

  const handleCustomConfirm = () => {
    const cleaned = customInput.replace(/[^\d]/g, '');
    const n = parseInt(cleaned, 10);
    if (isNaN(n) || n < CUSTOM_MIN || n > CUSTOM_MAX) {
      setCustomError(
        `Must be between ${formatUSD(CUSTOM_MIN)} and ${formatUSD(CUSTOM_MAX)}`
      );
      return;
    }
    setAccountSize(n, 'custom' as AccountSizeType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCustomOpen(false);
    setCustomError(null);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingTraderName');
  };

  const selectedPreset = accountSizeType === 'preset' ? accountSize : null;
  const isCustom       = accountSizeType === 'custom';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <Animated.View style={[styles.fader, { opacity }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          alwaysBounceVertical={false}
        >
          <Text style={styles.headline}>Select your evaluation account</Text>
          <Text style={styles.subheadline}>
            This is your starting balance. You can practice as much as you want
            with it — losses don't follow you home.
          </Text>

          <View style={styles.cards}>
            {PRESETS.map((opt, idx) => (
              <View key={opt.value} style={idx > 0 ? styles.cardGap : null}>
                <PresetCard
                  option={opt}
                  selected={selectedPreset === opt.value}
                  onPress={() => handleSelectPreset(opt.value)}
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={openCustomModal}
            hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
            accessibilityRole="link"
            accessibilityLabel="Choose your own amount"
            style={styles.customLinkWrap}
          >
            <Text style={styles.customLink}>Choose your own amount</Text>
          </Pressable>
        </ScrollView>
      </Animated.View>

      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {isCustom && (
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>
              Custom: {formatUSD(accountSize)} selected
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>

      {/* Custom amount modal */}
      <Modal
        visible={customOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCustomOpen(false)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter your starting balance</Text>
            <TextInput
              style={[styles.modalInput, customError && styles.modalInputError]}
              value={customInput}
              onChangeText={(t) => {
                setCustomInput(t);
                if (customError) setCustomError(null);
              }}
              keyboardType="number-pad"
              autoFocus
              placeholder="50000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={9}
              selectionColor={GOLD}
            />
            {customError && (
              <Text style={styles.modalError}>{customError}</Text>
            )}
            <View style={styles.modalButtonRow}>
              <Pressable
                onPress={() => setCustomOpen(false)}
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCustomConfirm}
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  fader: { flex: 1 },

  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  headline: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  cards: { marginTop: 24 },
  cardGap: { marginTop: 10 },

  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  cardSelected: {
    backgroundColor: CARD_BG_SEL,
    borderColor: GOLD,
    borderWidth: 2,
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  cardPressed: { opacity: 0.85 },
  cardAmount: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  cardDescription: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  customLinkWrap: {
    marginTop: 20,
    alignSelf: 'center',
  },
  customLink: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '400',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: BG,
  },
  customBadge: {
    alignSelf: 'center',
    backgroundColor: '#1A1A1A',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
  },
  customBadgeText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  cta: {
    backgroundColor: GOLD,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: CTA_DISABLED_BG },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  ctaTextDisabled: { color: 'rgba(255,255,255,0.5)' },

  // Custom amount modal
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#0F0F0F',
    borderColor: '#1F1F1F',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: '88%',
    maxWidth: 420,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  modalInput: {
    marginTop: 20,
    backgroundColor: '#0A0A0A',
    borderColor: '#2A2A2A',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  modalInputError: { borderColor: '#FF4757' },
  modalError: {
    marginTop: 10,
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalButtonRow: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    backgroundColor: GOLD,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
