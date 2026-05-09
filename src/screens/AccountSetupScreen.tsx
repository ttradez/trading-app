import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../services/firebase';
import { upsertUser } from '../services/api';
import { colors, radius, spacing, fontSize, fontWeight, letterSpacing, labelStyle } from '../theme';

type Goal = 'learn' | 'prop' | 'track' | 'leaderboard';

const GOALS: { id: Goal; icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
  { id: 'learn',       icon: 'school-outline',     title: 'Learn the Basics',           subtitle: "I'm new to trading and want to learn." },
  { id: 'prop',        icon: 'business-outline',   title: 'Prep for Prop Firm Evaluation', subtitle: 'I want to practice for a challenge.' },
  { id: 'track',       icon: 'trending-up',        title: 'Build a Track Record',        subtitle: 'I want to improve and document progress.' },
  { id: 'leaderboard', icon: 'trophy-outline',     title: 'Chase the Leaderboard',       subtitle: 'I want to compete and rank up.' },
];

const BALANCES = [10000, 25000, 50000, 100000];

interface Props {
  navigation: any;
}

export default function AccountSetupScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [balance, setBalance] = useState(25000);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameValid = username.length >= 3;
  const emailValid = /\S+@\S+\.\S+/.test(email);
  const passwordValid = password.length >= 6;
  const canSubmit = usernameValid && emailValid && passwordValid && goal !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      await upsertUser(cred.user.uid, username, email);
      navigation.replace('FeatureTour');
    } catch (e: any) {
      Alert.alert('Sign-up failed', e.message ?? 'Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ACCOUNT SETUP</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <ProgressDots active={0} total={4} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Username */}
        <Text style={styles.fieldLabel}>CHOOSE A USERNAME</Text>
        <View style={[styles.inputWrap, usernameValid && styles.inputWrapValid]}>
          <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="MarketSniper"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {usernameValid && <Ionicons name="checkmark-circle" size={20} color={colors.green} style={styles.inputCheck} />}
        </View>

        {/* Email + Password */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>EMAIL & PASSWORD</Text>
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
          />
        </View>

        {/* Starting balance */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.xl }]}>STARTING BALANCE</Text>
        <View style={styles.balanceRow}>
          {BALANCES.map((b) => {
            const active = balance === b;
            return (
              <TouchableOpacity
                key={b}
                style={[styles.balancePill, active && styles.balancePillActive]}
                onPress={() => setBalance(b)}
              >
                <Text style={[styles.balanceText, active && styles.balanceTextActive]}>
                  ${(b / 1000).toFixed(0)},000
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Goals */}
        <View style={styles.goalsHeaderRow}>
          <Text style={styles.fieldLabel}>WHAT ARE YOUR GOALS?</Text>
          <Text style={styles.fieldHint}>Select one</Text>
        </View>
        {GOALS.map((g) => {
          const active = goal === g.id;
          return (
            <TouchableOpacity
              key={g.id}
              style={[styles.goalRow, active && styles.goalRowActive]}
              onPress={() => setGoal(g.id)}
              activeOpacity={0.7}
            >
              <View style={styles.goalIconWrap}>
                <Ionicons name={g.icon} size={22} color={active ? colors.gold : colors.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.goalTitle, active && { color: colors.textPrimary }]}>{g.title}</Text>
                <Text style={styles.goalSubtitle}>{g.subtitle}</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          disabled={!canSubmit || loading}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={[styles.ctaText, !canSubmit && styles.ctaTextDisabled]}>CONTINUE</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>
            Already have an account?{' '}
            <Text style={styles.loginLinkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProgressDots({ active, total }: { active: number; total: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View style={[styles.dot, i === active && styles.dotActive, i < active && styles.dotDone]}>
            <Text style={[styles.dotText, i === active && styles.dotTextActive]}>{i + 1}</Text>
          </View>
          {i < total - 1 && <View style={styles.dotConnector} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.ultraWide,
  },

  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  dotActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  dotDone: { borderColor: colors.gold, backgroundColor: colors.gold },
  dotText: { color: colors.textSecondary, fontSize: 12, fontWeight: fontWeight.bold },
  dotTextActive: { color: colors.bg },
  dotConnector: { width: 24, height: 1.5, backgroundColor: colors.border },

  body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },

  fieldLabel: { ...labelStyle, marginBottom: spacing.sm, marginTop: spacing.md },
  fieldHint: { color: colors.textTertiary, fontSize: fontSize.xs, fontStyle: 'italic' },
  goalsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputWrapValid: { borderColor: colors.green },
  inputIcon: { marginRight: spacing.sm },
  input: {
    flex: 1, color: colors.textPrimary, fontSize: fontSize.md,
    paddingVertical: 14,
  },
  inputCheck: { marginLeft: spacing.sm },

  balanceRow: { flexDirection: 'row', gap: spacing.sm },
  balancePill: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    alignItems: 'center',
  },
  balancePillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  balanceText: { color: colors.textSecondary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  balanceTextActive: { color: colors.bg, fontWeight: fontWeight.bold },

  goalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  goalRowActive: { borderColor: colors.gold, backgroundColor: colors.cardAlt },
  goalIconWrap: { width: 36, alignItems: 'center' },
  goalTitle: { color: colors.textPrimary, fontWeight: fontWeight.semibold, fontSize: fontSize.md, marginBottom: 2 },
  goalSubtitle: { color: colors.textSecondary, fontSize: fontSize.sm },

  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: colors.gold },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold },

  cta: {
    marginTop: spacing.xl, backgroundColor: colors.gold,
    borderRadius: radius.lg, paddingVertical: 18, alignItems: 'center',
  },
  ctaDisabled: { backgroundColor: colors.cardAlt },
  ctaText: { color: colors.bg, fontSize: fontSize.md, fontWeight: fontWeight.bold, letterSpacing: 2 },
  ctaTextDisabled: { color: colors.textTertiary },

  loginLink: { marginTop: spacing.lg, alignItems: 'center', paddingVertical: spacing.sm },
  loginLinkText: { color: colors.textSecondary, fontSize: fontSize.sm },
  loginLinkBold: { color: colors.gold, fontWeight: fontWeight.bold },
});
