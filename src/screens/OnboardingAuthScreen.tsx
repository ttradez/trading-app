import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, OAuthProvider, signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { useOnboardingStore } from '../store/onboardingStore';
import PlayerCardPreview from '../components/onboarding/PlayerCardPreview';

// Completes the OAuth redirect when the browser bounces back.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

/** Maps a Firebase auth error code → user-facing copy, and whether
 *  to flip the form between sign-up / sign-in. */
function mapAuthError(
  code: string,
): { msg: string; switchTo?: 'signup' | 'signin' } {
  switch (code) {
    case 'auth/email-already-in-use':
      return { msg: 'Account exists. Try signing in.', switchTo: 'signin' };
    case 'auth/weak-password':
      return { msg: 'Password must be at least 6 characters' };
    case 'auth/invalid-email':
      return { msg: 'Enter a valid email address' };
    case 'auth/user-not-found':
      return { msg: 'No account found. Try signing up.', switchTo: 'signup' };
    case 'auth/wrong-password':
      return { msg: 'Incorrect password' };
    case 'auth/invalid-credential':
      return { msg: 'Incorrect email or password' };
    case 'auth/too-many-requests':
      return { msg: 'Too many attempts. Try again in a moment.' };
    case 'auth/network-request-failed':
      return { msg: 'Network error. Check your connection.' };
    default:
      return { msg: 'Something went wrong. Try again.' };
  }
}

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
  // 'select' = SSO buttons + email link; 'email' = email/password form.
  const [mode, setMode] = useState<'select' | 'email'>('select');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState<string | null>(null);

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

  /** Persist onboarding profile to Firestore, flag onboarding
   *  complete, and hand off to the welcome screen. */
  const finishAuth = async (uid: string) => {
    const s = useOnboardingStore.getState();
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          displayName: s.displayName,
          handle: s.handle,
          archetype: s.archetype,
          identity: s.identity,
          experienceLevel: s.experienceLevel,
          accountSize: s.accountSize,
          dailyCommitment: s.dailyCommitment,
          dailyTimeGoalMinutes: s.dailyTimeGoalMinutes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      // Non-fatal: the account exists; profile sync can retry later.
      // eslint-disable-next-line no-console
      console.warn('[auth] Firestore profile save failed', e);
    }
    // `setAuth` keeps the store's authMethod/isAuthed set. Real
    // method ids (apple/google/email) are a follow-up per the
    // AuthMethod type comment; 'mock-email' is the closest existing
    // value and only feeds analytics, not routing.
    setAuth('mock-email');
    s.setOnboardingComplete(true);
    navigation.reset({ index: 0, routes: [{ name: 'OnboardingWelcome' }] });
  };

  const submitEmail = async () => {
    if (loading) return;
    const mail = email.trim();
    setError(null);

    if (!mail) { setError('Enter a valid email address'); return; }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const cred =
        authMode === 'signup'
          ? await createUserWithEmailAndPassword(auth, mail, password)
          : await signInWithEmailAndPassword(auth, mail, password);
      await finishAuth(cred.user.uid);
      // Leave `loading` true — the screen is being reset away.
    } catch (e: any) {
      const { msg, switchTo } = mapAuthError(e?.code ?? '');
      setError(msg);
      if (switchTo) setAuthMode(switchTo);
      setLoading(false);
    }
  };

  // ── Google (expo-auth-session) ──────────────────────────────────
  const [, googleRes, googlePrompt] = Google.useIdTokenAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!googleRes) return;
    if (googleRes.type === 'success') {
      const idToken = googleRes.params?.id_token;
      if (!idToken) {
        setLoading(false);
        Alert.alert('Google sign-in failed', 'No identity token returned.');
        return;
      }
      setLoading(true);
      const cred = GoogleAuthProvider.credential(idToken);
      signInWithCredential(auth, cred)
        .then((r) => finishAuth(r.user.uid))
        .catch(() => {
          setLoading(false);
          Alert.alert('Google sign-in failed', 'Google sign-in failed. Try again.');
        });
    } else if (googleRes.type === 'error') {
      setLoading(false);
      Alert.alert('Google sign-in failed', 'Could not complete Google sign-in.');
    } else {
      // 'dismiss' / 'cancel' — user backed out; just stop the spinner.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleRes]);

  const signInWithGoogle = async () => {
    if (loading) return;
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert(
        'Google sign-in unavailable',
        'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. Add it to .env and restart Metro with --clear.',
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    try {
      await googlePrompt();
    } catch {
      setLoading(false);
    }
  };

  // ── Apple (expo-apple-authentication) ───────────────────────────
  const signInWithApple = async () => {
    if (loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        Alert.alert(
          'Apple sign-in unavailable',
          'Apple Sign In is only available on iOS 13+ devices.',
        );
        return;
      }
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const appleCred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!appleCred.identityToken) {
        Alert.alert('Apple sign-in failed', 'No identity token returned.');
        return;
      }
      setLoading(true);
      const provider = new OAuthProvider('apple.com');
      const firebaseCred = provider.credential({
        idToken: appleCred.identityToken,
        rawNonce,
      });
      const r = await signInWithCredential(auth, firebaseCred);
      await finishAuth(r.user.uid);
    } catch (e: any) {
      // User-cancelled the Apple sheet → quiet no-op.
      if (e?.code === 'ERR_REQUEST_CANCELED') { setLoading(false); return; }
      setLoading(false);
      Alert.alert('Apple sign-in failed', 'Apple sign-in failed. Try again.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: 24, flexGrow: 1 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
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
        </Animated.View>

        <Animated.View style={[styles.buttonsWrap, { opacity: buttonsOp }]}>
          {mode === 'select' ? (
            <>
              <AuthButton
                variant="apple"
                disabled={loading}
                onPress={signInWithApple}
              />
              <View style={styles.btnGap} />
              <AuthButton
                variant="google"
                disabled={loading}
                onPress={signInWithGoogle}
              />

              <View style={styles.emailLinkGap} />
              <Pressable
                onPress={() => { setError(null); setMode('email'); }}
                disabled={loading}
                style={({ pressed }) => [
                  styles.emailLink,
                  pressed && !loading && styles.emailLinkPressed,
                ]}
                accessibilityRole="link"
                accessibilityLabel="Continue with email"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.emailLinkText}>Continue with email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                editable={!loading}
                returnKeyType="next"
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Password (6+ characters)"
                placeholderTextColor="rgba(255,255,255,0.35)"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={submitEmail}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                onPress={submitEmail}
                disabled={loading}
                style={({ pressed }) => [
                  styles.authBtn,
                  styles.ctaBtn,
                  loading && styles.btnDisabled,
                  pressed && !loading && styles.btnPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  authMode === 'signup' ? 'Sign Up' : 'Sign In'
                }
              >
                <Text style={[styles.authBtnText, styles.ctaBtnText]}>
                  {authMode === 'signup' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setError(null);
                  setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                }}
                disabled={loading}
                style={styles.toggleLink}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.toggleLinkText}>
                  {authMode === 'signup'
                    ? 'Already have an account? Sign In'
                    : "Don't have an account? Sign Up"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => { setError(null); setMode('select'); }}
                disabled={loading}
                style={styles.backLink}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.backLinkText}>← Back</Text>
              </Pressable>
            </>
          )}

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
      </KeyboardAvoidingView>

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

  // Auth buttons — kept close to the player card (helper caption
  // removed; no big dead gap pushing these to the bottom).
  buttonsWrap: { marginTop: 16 },
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
  ctaBtn: {
    backgroundColor: GOLD,
    marginTop: 4,
  },
  ctaBtnText: { color: '#000000' },
  btnDisabled: { opacity: 0.55 },
  btnPressed:  { opacity: 0.85 },
  btnIcon:     { marginRight: 10 },

  // Email/password form
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    paddingHorizontal: 16,
    color: WHITE,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  errorText: {
    color: '#FF4757',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: -2,
  },
  toggleLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  toggleLinkText: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  backLinkText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },

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
