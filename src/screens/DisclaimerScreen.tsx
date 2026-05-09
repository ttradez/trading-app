import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Logo from '../components/brand/Logo';
import { colors, radius, spacing, fontSize, fontWeight, labelStyle } from '../theme';

interface Props {
  onAccept: () => void;
}

export default function DisclaimerScreen({ onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Logo block */}
        <View style={styles.logoBlock}>
          <Logo width={200} />
          <Text style={styles.tagline}>
            PAPER TRADING. REAL <Text style={{ color: colors.gold }}>DISCIPLINE</Text>.{'\n'}
            NO REAL <Text style={{ color: colors.gold }}>MONEY</Text>. NO FINANCIAL <Text style={{ color: colors.gold }}>ADVICE</Text>.
          </Text>
        </View>

        {/* Info cards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>THIS IS PAPER TRADING SIMULATOR</Text>
          <Text style={styles.cardBody}>
            All trades are simulated with virtual money. No real money is used and no real money can be withdrawn.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>NO FINANCIAL ADVICE</Text>
          <Text style={styles.cardBody}>
            Pocket Trade does not provide financial, investment, or trading advice. You are solely responsible for your own decisions.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>MARKET RISK</Text>
          <Text style={styles.cardBody}>
            Trading involves risk. Even though this is a simulator, it's designed to reflect real market conditions.
          </Text>
        </View>

        <Text style={styles.legalLine}>
          BY CONTINUING, YOU AGREE TO OUR{'\n'}
          <Text style={{ color: colors.gold }}>TERMS OF SERVICE</Text> AND <Text style={{ color: colors.gold }}>PRIVACY POLICY.</Text>
        </Text>

        {/* Agree checkbox */}
        <Pressable style={styles.agreeRow} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed && <Ionicons name="checkmark" size={16} color={colors.bg} />}
          </View>
          <Text style={styles.agreeText}>
            I have read and agree to the{' '}
            <Text style={styles.link}>Terms of Service</Text> and{' '}
            <Text style={styles.link}>Disclaimer</Text>.
          </Text>
        </Pressable>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, !agreed && styles.ctaDisabled]}
          disabled={!agreed}
          onPress={onAccept}
          activeOpacity={0.8}
        >
          <Text style={[styles.ctaText, !agreed && styles.ctaTextDisabled]}>ACCEPT & CONTINUE</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  container: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },

  logoBlock: { alignItems: 'center', marginBottom: spacing.xxl },
  wordmark: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: fontWeight.bold,
    letterSpacing: 6,
    marginTop: spacing.md,
  },
  tagline: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.lg,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...labelStyle,
    color: colors.gold,
    fontWeight: fontWeight.black,
    marginBottom: spacing.sm,
  },
  cardBody: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    lineHeight: 22,
  },

  legalLine: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    lineHeight: 16,
  },

  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xl },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  agreeText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, lineHeight: 20 },
  link: { color: colors.gold, fontWeight: fontWeight.semibold },

  cta: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ctaDisabled: { backgroundColor: colors.cardAlt },
  ctaText: {
    color: colors.bg,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  ctaTextDisabled: { color: colors.textTertiary },
});
