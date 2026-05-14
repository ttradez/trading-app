import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  useOnboardingStore, Identity, GoalCategory,
} from '../store/onboardingStore';

/**
 * Onboarding screen 4 — Identity selection (Atomic Habits framing).
 *
 * Per docs/ONBOARDING_AUDIT.md: the audit flagged this screen as the
 * worst scannability problem in the flow — 5 prose cards required
 * scrolling, and grey multi-line descriptions made at-a-glance
 * differentiation nearly impossible. This rebuild trades the prose
 * for an accordion pattern:
 *
 *   collapsed = gold icon + bold name + 3-6 word trait line
 *   selected  = gold border + full description revealed beneath
 *
 * At most one card is ever expanded — selection and expansion are
 * unified, so tapping any card both selects it and reveals its
 * description while collapsing the previous one.
 *
 * No new dependency: `MaterialCommunityIcons` is bundled in
 * `@expo/vector-icons`, which is already in the project.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const CARD_BG     = '#0F0F0F';
const CARD_BG_SEL = '#0A0A0A';
const CARD_BORDER = '#1F1F1F';
const CTA_DISABLED_BG = '#2A2A2A';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IdentityOption {
  id: Identity;
  title: string;
  /** Punchy 3-6 word trait shown in the collapsed card. */
  trait: string;
  /** Full description shown only when this card is selected (expanded). */
  description: string;
  goal: GoalCategory;
  /** MaterialCommunityIcons glyph name. */
  icon: IconName;
}

const IDENTITIES: IdentityOption[] = [
  {
    id: 'patient_sniper',
    title: 'The Patient Sniper',
    trait: 'Waits. Strikes. Wins.',
    description: "You wait for A+ setups. Most of the day, you're not in a trade. When you strike, it counts.",
    goal: 'psychology',
    icon: 'crosshairs',
  },
  {
    id: 'process_machine',
    title: 'The Process Machine',
    trait: 'Same setup. Same size. Every time.',
    description: 'Same setup, same size, same risk, every time. Your edge is showing up exactly the same way every day.',
    goal: 'consistency',
    icon: 'cog',
  },
  {
    id: 'risk_surgeon',
    title: 'The Risk Surgeon',
    trait: 'Tight stops. Never bleeds out.',
    description: 'You manage risk like a surgeon manages a scalpel. Tight stops, exact sizing, never bleeds out.',
    goal: 'risk',
    icon: 'pulse',
  },
  {
    id: 'calm_operator',
    title: 'The Calm Operator',
    trait: 'Steady nerves when others panic.',
    description: "Losses don't shake you. Wins don't inflate you. Your edge is steady nerves when everyone else is panicking.",
    goal: 'psychology',
    icon: 'waves',
  },
  {
    id: 'profit_compounder',
    title: 'The Profit Compounder',
    trait: 'Slow gains. Heavy compound.',
    description: 'You play the long game. Steady gains, reinvested. Your edge is patience with capital growth.',
    goal: 'profitability',
    icon: 'trending-up',
  },
];

interface Props {
  navigation: any;
}

function IdentityCard({
  option, selected, onPress,
}: { option: IdentityOption; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      accessibilityHint={option.trait}
      accessibilityState={{ selected }}
    >
      <View style={styles.cardRow}>
        <MaterialCommunityIcons
          name={option.icon}
          size={26}
          color={GOLD}
          style={styles.icon}
        />
        <View style={styles.textBlock}>
          <Text style={styles.cardTitle}>{option.title}</Text>
          <Text style={styles.cardTrait}>{option.trait}</Text>
          {selected && (
            <Text style={styles.cardDescription}>{option.description}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default function OnboardingIdentityScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const setIdentity = useOnboardingStore((s) => s.setIdentity);

  const [selectedId, setSelectedId] = useState<Identity | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: Identity) => {
    if (id === selectedId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedId(id);
  };

  const handleContinue = () => {
    if (!selectedId) return;
    const chosen = IDENTITIES.find((o) => o.id === selectedId);
    if (!chosen) return;
    setIdentity(chosen.id, chosen.goal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingExperience');
  };

  const ctaEnabled = selectedId !== null;
  const ctaLabel = ctaEnabled ? 'Continue' : 'Pick a path to continue';

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
          <Text style={styles.headline}>Who do you want to BECOME?</Text>
          <Text style={styles.subheadline}>
            Pick the identity you're working toward. Not what you are today.
          </Text>

          <View style={styles.cards}>
            {IDENTITIES.map((opt, idx) => (
              <View key={opt.id} style={idx > 0 ? styles.cardGap : null}>
                <IdentityCard
                  option={opt}
                  selected={selectedId === opt.id}
                  onPress={() => handleSelect(opt.id)}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </Animated.View>

      {/* CTA — anchored at bottom, gated by selection. Label flips
          from "Pick a path to continue" → "Continue" to give the
          disabled state explicit guidance. */}
      <View style={[styles.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={handleContinue}
          disabled={!ctaEnabled}
          style={({ pressed }) => [
            styles.cta,
            !ctaEnabled && styles.ctaDisabled,
            ctaEnabled && pressed && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: !ctaEnabled }}
        >
          <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextDisabled]}>
            {ctaLabel}
          </Text>
        </Pressable>
      </View>
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
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  cards: { marginTop: 24 },
  cardGap: { marginTop: 10 },

  card: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardSelected: {
    backgroundColor: CARD_BG_SEL,
    borderColor: GOLD,
    borderWidth: 2,
    // Compensate paddings so the layout doesn't jump on selection.
    paddingHorizontal: 13,
    paddingVertical: 13,
  },
  cardPressed: { opacity: 0.85 },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 12,
    // Nudge the icon down slightly so it lines up with the title's
    // cap-height instead of its line-box top.
    marginTop: 1,
  },
  textBlock: {
    flex: 1,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  cardTrait: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 17,
  },
  cardDescription: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: BG, // hide ScrollView content peeking behind on overscroll
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
});
