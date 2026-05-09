import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import Logo from '../components/brand/Logo';
import { colors, radius, spacing, fontSize, fontWeight, letterSpacing } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email || !password) { Alert.alert('Fill in all fields'); return; }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      Alert.alert('Login failed', e.message);
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            <View style={styles.logoBlock}>
              <Logo width={180} />
              <Text style={styles.tagline}>WELCOME BACK</Text>
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View style={[styles.inputWrap, { marginTop: spacing.sm }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="go"
                onSubmitEditing={login}
              />
            </View>

            <TouchableOpacity style={styles.cta} onPress={login} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.ctaText}>LOG IN</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('AccountSetup')} style={styles.bottomLink}>
              <Text style={styles.linkText}>
                Don't have an account?{' '}
                <Text style={styles.linkBold}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xl },

  logoBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  wordmark: {
    color: colors.gold, fontSize: 18, fontWeight: fontWeight.bold,
    letterSpacing: 6, marginTop: spacing.md,
  },
  tagline: {
    color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.ultraWide, marginTop: spacing.sm,
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputIcon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, paddingVertical: 14 },

  cta: {
    marginTop: spacing.xl, backgroundColor: colors.gold,
    borderRadius: radius.lg, paddingVertical: 18, alignItems: 'center',
  },
  ctaText: { color: colors.bg, fontSize: fontSize.md, fontWeight: fontWeight.bold, letterSpacing: 2 },

  bottomLink: { marginTop: spacing.xl, alignItems: 'center' },
  linkText: { color: colors.textSecondary, fontSize: fontSize.sm },
  linkBold: { color: colors.gold, fontWeight: fontWeight.bold },
});
