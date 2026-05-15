import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useOnboardingStore, AuthMethod } from '../store/onboardingStore';
import PlayerCardPreview from '../components/onboarding/PlayerCardPreview';

/**
 * Onboarding screen 11 — Save your progress (deferred-auth moment).
 *
 * Per docs/ONBOARDING_RETENTION_RESEARCH.md the single
 * highest-leverage retention move in the funnel (Duolingo's +20%
 * next-day retention). User has invested 10 screens of work, made
 * a first trade, earned a badge — signup is framed as "preserve
 * what you built," not "give us your email."
 *
 * v1 ships MOCK auth: tapping any of the 3 buttons spins for ~500 ms
 * and advances to the welcome screen. Real Firebase / Apple / Google
 * wire-up is a follow-up prompt; the UI shell is final.
 */

const BG    = '#000000';
const GOLD  = '#FFB800';
const WHITE = '#FFFFFF';

const MOCK_SPIN_MS = 500;

interface Props {
  navigation: any;
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface AuthButtonProps {
  variant: 'apple' | 'google';
  disabled: boolean;
  onPress: () => void;
}

/** SSO button — Apple / Google. Email was demoted to a text link
 *  below the SSO row per ONBOARDING_AUDIT.md (SSO-dominant layouts
 *  lift auth conversion 15-25%). */
function AuthButton({ variant, disabled, onPress }: AuthButtonProps) {
  let label: string;
  let icon: React.ReactNode;
  switch (variant) {
    case 'apple':
      label = 'Continue with Apple';
      icon = <Ionicons name="logo-apple" size={22} color="#000000" style={styles.btnIcon} />;
      break;
    case 'google':
      label = 'Continue with Google';
      icon = <Ionicons name="logo-google" size={20} color="#000000" style={styles.btnIcon} />;
      break;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.authBtn,
        styles.ssoBtn,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {icon}
      <Text style={[styles.authBtnText, styles.ssoBtnText]}>{label}</Text>
    </Pressable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function OnboardingAuthScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const handle      = useOnboardingStore((s) => s.handle);
  const displayName = useOnboardingStore((s) => s.displayName);
  const firstTrade  = useOnboardingStore((s) => s.firstTrade);
  const setAuth     = useOnboardingStore((s) => s.setAuth);

  const [loading, setLoading] = useState(false);

  // Staggered fade-ins.
  const headOp    = useRef(new Animated.Value(0)).current;
  const recapOp   = useRef(new Animated.Value(0)).current;
  const buttonsOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = (val: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]);
    Animated.parallel([
      fadeIn(headOp,    0),
      fadeIn(recapOp,   200),
      fadeIn(buttonsOp, 400),
    ]).start();
    // mount-once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAuth = (method: AuthMethod) => {
    if (loading) return;
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Mock latency so the spinner reads as a real network round-trip.
    setTimeout(() => {
      setAuth(method);
      navigation.navigate('OnboardingWelcome');
      // Intentionally leaving `loading` true — the screen unmounts
      // (or stays hidden under the next route) so the user never
      // sees the buttons re-enable.
    }, MOCK_SPIN_MS);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: headOp }}>
          <Text style={styles.headline}>Save your progress</Text>
          <Text style={styles.subheadline}>
            You've made your first trade and locked in your identity. Create your account to save your rank, climb the leaderboard, and pick up where you left off on any device.
          </Text>
        </Animated.View>

        {/* Recap — what they're saving */}
        <Animated.View style={[styles.recapWrap, { opacity: recapOp }]}>
          <PlayerCardPreview
            rank="gambler"
            displayName={displayName}
            handle={handle}
            badge={firstTrade?.badge ?? null}
            showYouIndicator={false}
          />
          <Text style={styles.recapNote}>
            Your trader name, rank, and first badge are saved when you sign up.
          </Text>
        </Animated.View>

        {/* Auth buttons */}
        <Animated.View style={[styles.buttonsWrap, { opacity: buttonsOp }]}>
          <AuthButton
            variant="apple"
            disabled={loading}
            onPress={() => handleAuth('mock-apple')}
          />
          <View style={styles.btnGap} />
          <AuthButton
            variant="google"
            disabled={loading}
            onPress={() => handleAuth('mock-google')}
          />

          {/* Email — demoted to a text link below the SSO row.
              Same mock-auth tap target as the buttons above. */}
          <View style={styles.emailLinkGap} />
          <Pressable
            onPress={() => handleAuth('mock-email')}
            disabled={loading}
            style={({ pressed }) => [
              styles.emailLink,
              pressed && !loading && styles.emailLinkPressed,
              loading && styles.emailLinkDisabled,
            ]}
            accessibilityRole="link"
            accessibilityLabel="Continue with email"
            accessibilityState={{ disabled: loading }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.emailLinkText}>Continue with email</Text>
          </Pressable>

          {/* Fine print */}
          <Text style={styles.finePrint}>
            By signing up you agree to our{' '}
            <Text
              style={styles.fineLink}
              onPress={() => console.log('[onboarding] Tap: Terms of Service (TODO: wire link)')}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.fineLink}
              onPress={() => console.log('[onboarding] Tap: Privacy Policy (TODO: wire link)')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Loading overlay — covers everything; disabled buttons are
          already non-interactive, this keeps the user from re-tapping
          anything else (e.g. fine-print links) while the mock spin runs. */}
      {loading && (
        <View pointerEvents="auto" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={GOLD} />
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
  },

  headline: {
    color: WHITE,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 39,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  subheadline: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,    // ~1.5×
    textAlign: 'center',
    paddingHorizontal: 4,
  },

  // Recap (player card + caption)
  recapWrap: { marginTop: 28 },
  recapNote: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Auth buttons
  buttonsWrap: { marginTop: 32 },
  btnGap: { height: 12 },

  authBtn: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ssoBtn: {
    backgroundColor: WHITE,
  },
  btnDisabled: { opacity: 0.55 },
  btnPressed:  { opacity: 0.85 },
  btnIcon:     { marginRight: 10 },

  authBtnText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ssoBtnText:   { color: '#000000' },

  // Email link — deliberately lighter than the SSO buttons. Centered,
  // underlined gold text; tap target padded out with `hitSlop`.
  emailLinkGap: { height: 16 },
  emailLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  emailLinkPressed:  { opacity: 0.55 },
  emailLinkDisabled: { opacity: 0.4 },
  emailLinkText: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
    textDecorationLine: 'underline',
  },

  // Fine print
  finePrint: {
    marginTop: 22,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    textAlign: 'center',
  },
  fineLink: {
    color: 'rgba(255,255,255,0.8)',
    textDecorationLine: 'underline',
  },

  // Loading overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
