import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
  TextInput, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Filter: any = require('bad-words');
import { useOnboardingStore, Archetype } from '../store/onboardingStore';
import PlayerCardPreview from '../components/onboarding/PlayerCardPreview';

/** Single shared filter instance — bad-words@3 default export is a
 *  constructable class; `isProfane()` is the side-effect-free check
 *  we want (vs `clean()` which substitutes). v3 was pinned (not v4)
 *  because v4.0.0 ships a broken dist/index.js that fails Metro
 *  resolution — see WORK_LOG for details. */
const profanityFilter = new Filter();

/** Returns true if the input contains profanity OR if its
 *  separator-stripped form does. Handles allow `.` and `_`, so an
 *  obvious evasion like `f.u.c.k` or `sh_it` would slip past
 *  `isProfane(rawInput)` — strip those characters and re-check. */
function containsProfanity(input: string): boolean {
  if (!input) return false;
  if (profanityFilter.isProfane(input)) return true;
  const stripped = input.replace(/[._]/g, '');
  if (stripped.length > 0 && profanityFilter.isProfane(stripped)) return true;
  return false;
}

/** Safety pass over the archetype suggestion pools at module load.
 *  Pools are hand-curated and shouldn't trip the filter, but if a
 *  future contributor adds an entry that does, this drops it silently
 *  rather than offering it to the user. */
function sanitizePool(pool: string[]): string[] {
  return pool.filter((s) => !containsProfanity(s));
}

/**
 * Onboarding screen 7 — Pick your trader name.
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md Q5: two-field model
 * (handle + display name) modelled after Twitter / Discord. Handle
 * is the unique URL/leaderboard identifier; display name is friendlier
 * and shown on profile cards.
 *
 * Uniqueness is DEFERRED to signup (screen 11) — here we only format-
 * validate. If a handle collides on signup we'll prompt at that point.
 */

const BG          = '#000000';
const GOLD        = '#FFB800';
const GREEN       = '#00D395';
const RED         = '#FF4757';
const CARD_BG     = '#0F0F0F';
const CARD_BORDER = '#1F1F1F';
const CTA_DISABLED_BG = '#2A2A2A';

const HANDLE_MIN = 3;
const HANDLE_MAX = 20;
const NAME_MIN = 1;
const NAME_MAX = 24;

/** Archetype-tied suggestion pools — 8 per archetype, all
 *  pre-validated against `isHandleValid` (lowercase, periods + letters
 *  + digits, 3-20 chars, no leading/trailing/consecutive separators).
 *  Per audit: handles should reflect *who the user just typed as*,
 *  not generic animal-noun chaff. The refresh button shuffles 3 out
 *  of the pool, so each tap shows a different cut. */
const ARCHETYPE_SUGGESTIONS: Record<Archetype, string[]> = {
  scalper: sanitizePool([
    'scalp.07', 'tick.hunter', 'fast.hands', 'quick.draw',
    'blade.runner', 'micro.moves', 'knife.edge', 'in.n.out',
  ]),
  day_trader: sanitizePool([
    'tape.reader', 'intraday.ace', 'price.action', 'the.close',
    'session.07', 'chart.eyes', 'day.grind', 'market.hours',
  ]),
  swing_trader: sanitizePool([
    'trend.rider', 'swing.state', 'multi.day', 'wave.rider',
    'the.swing', 'hold.steady', 'trend.07', 'swing.king',
  ]),
  position_trader: sanitizePool([
    'big.picture', 'long.game', 'the.thesis', 'conviction',
    'macro.mind', 'long.haul', 'position.07', 'slow.steady',
  ]),
};

/** Generic fallback pool used if `archetype` is somehow null on entry
 *  (shouldn't happen — quiz runs before this screen — but keep the
 *  fallback so the chips never render empty). Reuses the prior
 *  animal+number pattern as a safety net. */
const FALLBACK_ANIMALS = [
  'wolf', 'hawk', 'fox', 'shark', 'bear', 'bull', 'tiger', 'lion',
  'raven', 'viper', 'falcon', 'panther', 'eagle', 'cobra', 'jaguar', 'owl',
];

/** Pick a separator with weighted probability for the fallback pool:
 *  60% none ("wolf42"), 30% underscore ("fox_15"), 10% period ("shark.88"). */
function pickSeparator(): '' | '_' | '.' {
  const r = Math.random();
  if (r < 0.6) return '';
  if (r < 0.9) return '_';
  return '.';
}

function generateFallbackSuggestions(): string[] {
  const shuffled = [...FALLBACK_ANIMALS].sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map((a) => {
    const n = Math.floor(Math.random() * 90) + 10; // 10-99
    return `${a}${pickSeparator()}${n}`;
  });
}

function generateSuggestions(archetype: Archetype | null): string[] {
  if (!archetype) return generateFallbackSuggestions();
  // Defensively filter against the validation rules — pools are
  // hand-curated to satisfy them, but the filter keeps this honest
  // if anyone ever extends a pool without re-checking.
  const pool = ARCHETYPE_SUGGESTIONS[archetype].filter(isHandleValid);
  if (pool.length < 3) return generateFallbackSuggestions();
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
}

// Format rules per spec — does NOT check uniqueness.
function isHandleValid(h: string): boolean {
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX) return false;
  if (!/^[a-z0-9._]+$/.test(h)) return false;
  if (/^[._]|[._]$/.test(h)) return false;       // no leading/trailing . or _
  if (/[._]{2}/.test(h)) return false;           // no consecutive . or _
  return true;
}

function isNameValid(n: string): boolean {
  return n.length >= NAME_MIN && n.length <= NAME_MAX;
}

interface Props {
  navigation: any;
}

export default function OnboardingTraderNameScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const handle         = useOnboardingStore((s) => s.handle);
  const displayName    = useOnboardingStore((s) => s.displayName);
  const archetype      = useOnboardingStore((s) => s.archetype);
  const setHandle      = useOnboardingStore((s) => s.setHandle);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);

  const [handleFocused, setHandleFocused] = useState(false);
  const [nameFocused,   setNameFocused]   = useState(false);
  const [suggestions,   setSuggestions]   = useState<string[]>(() => generateSuggestions(archetype));

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

  const handleValid    = useMemo(() => isHandleValid(handle), [handle]);
  const nameValid      = useMemo(() => isNameValid(displayName), [displayName]);
  const handleProfane  = useMemo(() => containsProfanity(handle), [handle]);
  const nameProfane    = useMemo(() => containsProfanity(displayName), [displayName]);
  const ctaEnabled     = handleValid && nameValid && !handleProfane && !nameProfane;

  // Don't nag with red error text while the user is still typing from
  // empty — only show after they've typed at least one character.
  const handleHasInput = handle.length > 0;
  const nameHasInput   = displayName.length > 0;
  const nameTooLong    = displayName.length > NAME_MAX;

  const onHandleChange = (t: string) => {
    // Don't auto-correct or auto-cap — let users type what they typed.
    setHandle(t);
  };

  const onNameChange = (t: string) => setDisplayName(t);

  const refreshSuggestions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSuggestions(generateSuggestions(archetype));
  };

  const applySuggestion = (s: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setHandle(s);
  };

  const handleContinue = () => {
    if (!ctaEnabled) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    navigation.navigate('OnboardingCommitment');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.fader, { opacity }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: insets.top + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.headline}>Pick your trader name</Text>
              <Text style={styles.subheadline}>
                This is how other traders will find you on the leaderboard.
              </Text>

              {/* Live player-card preview — updates as the user types. */}
              <View style={styles.previewWrap}>
                <PlayerCardPreview
                  rank="gambler"
                  displayName={displayName}
                  handle={handle}
                />
              </View>

              {/* HANDLE */}
              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>HANDLE</Text>
              <View
                style={[
                  styles.inputWrap,
                  handleFocused && styles.inputWrapFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={handle}
                  onChangeText={onHandleChange}
                  onFocus={() => setHandleFocused(true)}
                  onBlur={() => setHandleFocused(false)}
                  placeholder="your.handle"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  spellCheck={false}
                  keyboardType="default"
                  maxLength={HANDLE_MAX}
                  selectionColor={GOLD}
                  returnKeyType="next"
                />
                {handleValid && !handleProfane && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={GREEN}
                    style={styles.inputAdornment}
                  />
                )}
              </View>
              {handleHasInput && handleProfane ? (
                <Text style={styles.errorText}>This name isn't allowed.</Text>
              ) : handleHasInput && !handleValid ? (
                <Text style={styles.errorText}>Invalid handle format</Text>
              ) : (
                <Text style={styles.helperText}>
                  3-20 characters. Lowercase letters, numbers, periods, and underscores only.
                </Text>
              )}

              {/* SUGGESTIONS */}
              <View style={styles.suggestionsHeader}>
                <Text style={styles.fieldLabel}>SUGGESTIONS</Text>
                <Pressable
                  onPress={refreshSuggestions}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh suggestions"
                  style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="refresh" size={16} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
              <View style={styles.suggestionsRow}>
                {suggestions.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => applySuggestion(s)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use suggestion ${s}`}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              {/* DISPLAY NAME */}
              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>DISPLAY NAME</Text>
              <View
                style={[
                  styles.inputWrap,
                  nameFocused && styles.inputWrapFocused,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={onNameChange}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  placeholder="What should we call you?"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  autoCapitalize="words"
                  autoCorrect={true}
                  maxLength={NAME_MAX + 4 /* allow brief overflow so the "Too long" error can show */}
                  selectionColor={GOLD}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
                {nameValid && !nameProfane && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={GREEN}
                    style={styles.inputAdornment}
                  />
                )}
              </View>
              {nameHasInput && nameProfane ? (
                <Text style={styles.errorText}>This name isn't allowed.</Text>
              ) : nameTooLong ? (
                <Text style={styles.errorText}>Too long</Text>
              ) : (
                <Text style={styles.helperText}>
                  1-24 characters. This is what shows on your profile.
                </Text>
              )}
            </ScrollView>
          </TouchableWithoutFeedback>
        </Animated.View>

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
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: !ctaEnabled }}
          >
            <Text style={[styles.ctaText, !ctaEnabled && styles.ctaTextDisabled]}>
              Continue
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  kav:  { flex: 1 },
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
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  previewWrap: { marginTop: 24 },

  fieldLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputWrapFocused: {
    borderColor: GOLD,
    borderWidth: 2,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 14,
  },
  inputAdornment: { marginLeft: 8 },

  helperText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 17,
  },
  errorText: {
    marginTop: 8,
    color: RED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  suggestionsHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshBtn: {
    width: 32,
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
    // pull up so the icon aligns with the label baseline
    marginBottom: 8,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BORDER,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '400',
  },

  ctaWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: BG,
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
